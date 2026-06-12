const S = { model:"sonnet46", gpu:"h100_neo", preset:"medium" };
const $ = id => document.getElementById(id);
const fmt = (n, d) => {
  if (!isFinite(n)) return "–";
  if (d === undefined) d = n >= 100 ? 0 : n >= 1 ? 2 : 4;
  return "$" + n.toLocaleString("en-US", {minimumFractionDigits:d, maximumFractionDigits:d});
};
const fmtTok = n => n >= 1e6 ? (n/1e6).toFixed(2)+"M" : n >= 1e3 ? (n/1e3).toFixed(1)+"k" : String(Math.round(n));

/* ============ WRAPPERS ============ */
function readParams() {
  const p = {};
  for (const s of SLIDERS) p[s.id] = +$(s.id).value;
  p.route = +$("routeShare").value;
  p.modelId = S.model;
  p.gpuId = S.gpu;
  p.gpuCount = +$("gpuCount").value;
  p.throughput = +$("throughput").value;
  p.utilization = +$("utilization").value;
  p.vectorFixed = +$("vectorFixed").value;
  p.saasFixed = +$("saasFixed").value;
  p.runtimeFixed = +$("runtimeFixed").value;
  p.obsPerTrace = +$("obsPerTrace").value;
  p.egressGB = +$("egressGB").value;
  p.egressCloud = +$("egressCloud").value;
  p.tools = {};
  for (const tl of DATA.tools) if (tl.on) p.tools[tl.id] = tl.calls;
  return p;
}

/* ============ RENDER ============ */
let breakChart, breakevenChart;
const COLORS = ["#5b9cff", "#34d399", "#fbbf24", "#f87171", "#a78bfa", "#22d3ee", "#f472b6"];

function compute() {
  return computeCosts(readParams(), DATA);
}

function render(){
  const r = compute();

  $("kpiTask").textContent = fmt(r.perTask);
  $("kpiTaskSub").textContent = fmt(r.llm.cost) + " of it is the model";
  $("kpiDay").textContent = fmt(r.perDay);
  $("kpiDaySub").textContent = r.p.tasksPerDay + " tasks";
  $("kpiMonth").textContent = fmt(r.totalMo);
  $("kpiMonthSub").textContent = fmtTok(r.monthlyTokens) + " tokens/mo";
  $("kpiSelf").textContent = fmt(r.shTotal);
  const diff = r.shTotal - r.totalMo;
  $("kpiSelfSub").innerHTML = diff <= 0
    ? '<span class="good">saves ' + fmt(-diff) + '/mo vs API</span>'
    : '<span class="warntx">' + fmt(diff) + '/mo more than API</span>';

  // breakdown doughnut
  const labels = ["Model: input","Model: output","Tools / MCP","Observability","Fixed infra","Egress"];
  const t = r.llm.t, h = r.p.cacheHit/100;
  const m = DATA.models.find(x=>x.id===S.model);
  const inCost = (t.totalInput * ((1-h)+h*m.cacheRead) * m.inP/1e6 + (m.cacheWrite>1&&h>0 ? t.newTokens*m.inP/1e6*(m.cacheWrite-1):0)) * r.tasksMo;
  const outCost = t.totalOutput * m.outP/1e6 * r.tasksMo;
  const scale = (inCost+outCost)>0 ? r.llmMo/(inCost+outCost) : 1; // adjust for routing blend
  const vals = [inCost*scale, outCost*scale, r.toolsMo, r.obsMo, r.fixedMo, r.egressMo];
  if (breakChart) { breakChart.data.datasets[0].data = vals; breakChart.update(); }
  else breakChart = new Chart($("breakChart"), {type:"doughnut",
    data:{labels, datasets:[{data:vals, backgroundColor:COLORS, borderWidth:0}]},
    options:{plugins:{legend:{position:"right", labels:{color:"#8b94a8", boxWidth:10, font:{size:11}}}}, maintainAspectRatio:false}});

  // breakdown list
  const total = vals.reduce((a,b)=>a+b,0) || 1;
  $("breakList").innerHTML = labels.map((l,i)=>
    '<div class="row"><span><span class="dot" style="background:'+COLORS[i]+'"></span>'+l+'</span><span>'+fmt(vals[i])+' <span class="pill">'+(100*vals[i]/total).toFixed(1)+'%</span></span></div>').join("");

  // breakeven chart: monthly cost vs tasks/day
  const maxTasks = Math.max(r.p.tasksPerDay*3, 100);
  const xs = []; for (let i=0;i<=20;i++) xs.push(Math.round(maxTasks*i/20));
  const perTaskAPI = r.llm.cost + r.tools + r.obs;
  const apiLine = xs.map(x=> x*30.4*perTaskAPI + r.fixedMo + r.egressMo);
  const shLine = xs.map(x=> r.sh.monthlyFixed + x*30.4*(r.tools + r.obs) + r.fixedMo + r.egressMo);
  const cfg = {labels:xs, datasets:[
    {label:"API ("+m.name+")", data:apiLine, borderColor:"#5b9cff", backgroundColor:"transparent", tension:.2, pointRadius:0},
    {label:"Self-hosted ("+r.sh.gpu.name.split(" · ")[0]+" ×"+r.sh.n+")", data:shLine, borderColor:"#34d399", backgroundColor:"transparent", tension:.2, pointRadius:0}
  ]};
  if (breakevenChart){ breakevenChart.data = cfg; breakevenChart.update(); }
  else breakevenChart = new Chart($("breakevenChart"), {type:"line", data:cfg,
    options:{plugins:{legend:{labels:{color:"#8b94a8", boxWidth:14, font:{size:11}}}},
      scales:{x:{title:{display:true,text:"tasks per day",color:"#8b94a8"}, ticks:{color:"#8b94a8"}, grid:{color:"#1f2735"}},
              y:{ticks:{color:"#8b94a8", callback:v=>"$"+(v>=1000?(v/1000)+"k":v)}, grid:{color:"#1f2735"}}},
      maintainAspectRatio:false}});

  // self-hosted note
  const capPct = r.monthlyTokens / r.sh.capacityTokens * 100;
  $("shNote").innerHTML =
    "Effective rate: <b>" + fmt(r.sh.perM,2) + "/M tokens</b> at " + $("utilization").value + "% utilization · " +
    "GPU rent " + fmt(r.sh.monthlyFixed,0) + "/mo · capacity " + fmtTok(r.sh.capacityTokens) + " tokens/mo. " +
    (r.sh.covered
      ? "Your workload uses <b>" + capPct.toFixed(1) + "%</b> of that capacity." + (capPct < 25 ? " <span class='warntx'>Heavily underused; the API will likely beat this.</span>" : "")
      : "<span class='badtx'>Workload exceeds capacity; add GPUs or raise throughput.</span>");

  // model comparison table
  const tb = $("modelTable").querySelector("tbody");
  tb.innerHTML = DATA.models.map(mm=>{
    const c = llmCostPerTask(r.p, mm);
    const mo = c.cost * r.tasksMo + r.toolsMo + r.obsMo + r.fixedMo + r.egressMo;
    return '<tr class="clickable'+(mm.id===S.model?' selected':'')+'" data-id="'+mm.id+'">'+
      '<td>'+mm.name+'</td><td class="num">'+fmt(mm.inP,2)+'</td><td class="num">'+fmt(mm.outP,2)+'</td>'+
      '<td class="num">'+fmt(c.cost)+'</td><td class="num">'+fmt(mo,0)+'</td></tr>';
  }).join("");
  tb.querySelectorAll("tr").forEach(tr=>tr.onclick=()=>{ S.model=tr.dataset.id; $("modelSelect").value=S.model; setPreset("custom"); render(); });

  // token math explainer
  $("tokenMath").innerHTML =
    "One task = <b>" + r.p.steps + " steps</b>. Each step re-sends the growing context, so input scales with steps squared.<br>" +
    "Total input: <b>" + fmtTok(t.totalInput) + "</b> tokens (" + fmtTok(t.totalInput/r.p.steps) + " avg/step) · " +
    "Total output: <b>" + fmtTok(t.totalOutput) + "</b> · New context written: " + fmtTok(t.newTokens) + ".<br>" +
    "At " + r.p.cacheHit + "% cache hit, " + fmtTok(t.totalInput*h) + " input tokens bill at " + (m.cacheRead*100) + "% of the input rate.<br>" +
    "Model cost per task: <b>" + fmt(r.llm.cost) + "</b> · Tools: " + fmt(r.tools) + " · Observability: " + fmt(r.obs) + ".";
}

/* ============ UI BUILD ============ */
function buildSliders(){
  $("workload-sliders").innerHTML = SLIDERS.map(s=>
    '<div class="slider-row"><div class="top"><label>'+s.label+' <span class="hint">'+s.hint+'</span></label>'+
    '<span class="val" id="'+s.id+'Val">'+(s.pct?s.val+"%":s.val.toLocaleString())+'</span></div>'+
    '<input type="range" id="'+s.id+'" min="'+s.min+'" max="'+s.max+'" step="'+s.step+'" value="'+s.val+'"></div>').join("");
  for (const s of SLIDERS) $(s.id).oninput = ()=>{ $(s.id+"Val").textContent = s.pct? $(s.id).value+"%" : (+$(s.id).value).toLocaleString(); setPreset("custom"); render(); };
}

function buildModels(){
  $("modelSelect").innerHTML = DATA.models.map(mm=>'<option value="'+mm.id+'">'+mm.name+' ('+fmt(mm.inP,2)+' / '+fmt(mm.outP,2)+' per M)</option>').join("");
  $("modelSelect").value = S.model;
  $("modelSelect").onchange = ()=>{ S.model = $("modelSelect").value; setPreset("custom"); render(); };
  $("routeShare").oninput = ()=>{ $("routeVal").textContent = $("routeShare").value+"%"; setPreset("custom"); render(); };
}

function buildTools(){
  $("tools").innerHTML = DATA.tools.map((tl,i)=>
    '<div class="tool-row">'+
    '<input type="checkbox" data-i="'+i+'" class="tl-on" '+(tl.on?"checked":"")+'>'+
    '<span class="name">'+tl.name+'</span>'+
    '<input type="number" class="small tl-price" data-i="'+i+'" value="'+tl.price+'" min="0" step="0.001">'+
    '<input type="number" class="small tl-calls" data-i="'+i+'" value="'+tl.calls+'" min="0" step="1">'+
    '</div>').join("");
  document.querySelectorAll(".tl-on").forEach(el=>el.onchange=()=>{ DATA.tools[+el.dataset.i].on=el.checked; setPreset("custom"); render(); });
  document.querySelectorAll(".tl-price").forEach(el=>el.oninput=()=>{ DATA.tools[+el.dataset.i].price=+el.value||0; render(); });
  document.querySelectorAll(".tl-calls").forEach(el=>el.oninput=()=>{ DATA.tools[+el.dataset.i].calls=+el.value||0; setPreset("custom"); render(); });
}

function buildGpus(){
  $("gpuSelect").innerHTML = DATA.gpus.map(g=>'<option value="'+g.id+'">'+g.name+' ('+fmt(g.rate,2)+'/hr)</option>').join("");
  $("gpuSelect").value = S.gpu;
  $("gpuSelect").onchange = ()=>{ S.gpu=$("gpuSelect").value; render(); };
  $("throughput").oninput = ()=>{ $("tpVal").textContent=(+$("throughput").value).toLocaleString(); render(); };
  $("utilization").oninput = ()=>{ $("utilVal").textContent=$("utilization").value+"%"; render(); };
  $("gpuCount").oninput = render;
}

function buildPresets(){
  $("presets").innerHTML = Object.entries(PRESETS).map(([k,v])=>
    '<div class="preset" id="preset-'+k+'" data-k="'+k+'"><b>'+v.label+'</b><span>'+v.desc+'</span></div>').join("");
  document.querySelectorAll(".preset").forEach(el=>el.onclick=()=>applyPreset(el.dataset.k));
}

function setPreset(k){
  S.preset = k;
  document.querySelectorAll(".preset").forEach(el=>el.classList.toggle("active", el.dataset.k===k));
}

function applyPreset(k){
  setPreset(k);
  if (k==="custom") { render(); return; }
  const pr = PRESETS[k];
  for (const s of SLIDERS){
    if (pr[s.id]!==undefined){ $(s.id).value = pr[s.id]; $(s.id+"Val").textContent = s.pct? pr[s.id]+"%" : pr[s.id].toLocaleString(); }
  }
  S.model = pr.model; $("modelSelect").value = pr.model;
  $("routeShare").value = pr.route; $("routeVal").textContent = pr.route+"%";
  for (const tl of DATA.tools){ const c = pr.tools[tl.id]||0; tl.calls=c; tl.on=c>0; }
  buildTools();
  render();
}

function buildPriceEdit(){
  const tb = $("priceEdit").querySelector("tbody");
  tb.innerHTML = DATA.models.map((mm,i)=>
    '<tr><td>'+mm.name+'</td>'+
    '<td class="num"><input type="number" class="small pe-in" data-i="'+i+'" value="'+mm.inP+'" step="0.01" min="0"></td>'+
    '<td class="num"><input type="number" class="small pe-out" data-i="'+i+'" value="'+mm.outP+'" step="0.01" min="0"></td>'+
    '<td class="num"><input type="number" class="small pe-cr" data-i="'+i+'" value="'+mm.cacheRead+'" step="0.01" min="0" max="1"></td></tr>').join("");
  tb.querySelectorAll(".pe-in").forEach(el=>el.oninput=()=>{ DATA.models[+el.dataset.i].inP=+el.value||0; buildModels(); render(); });
  tb.querySelectorAll(".pe-out").forEach(el=>el.oninput=()=>{ DATA.models[+el.dataset.i].outP=+el.value||0; buildModels(); render(); });
  tb.querySelectorAll(".pe-cr").forEach(el=>el.oninput=()=>{ DATA.models[+el.dataset.i].cacheRead=+el.value||0; render(); });
  const gb = $("gpuEdit").querySelector("tbody");
  gb.innerHTML = DATA.gpus.map((g,i)=>
    '<tr><td>'+g.name+'</td><td class="num"><input type="number" class="small ge-r" data-i="'+i+'" value="'+g.rate+'" step="0.01" min="0"></td></tr>').join("");
  gb.querySelectorAll(".ge-r").forEach(el=>el.oninput=()=>{ DATA.gpus[+el.dataset.i].rate=+el.value||0; buildGpus(); render(); });
}

["vectorFixed","saasFixed","runtimeFixed","obsPerTrace","egressGB"].forEach(id=>{ window.addEventListener("DOMContentLoaded",()=>{ $(id).oninput=render; $("egressCloud").onchange=render; }); });

buildSliders(); buildModels(); buildTools(); buildGpus(); buildPresets(); buildPriceEdit();
applyPreset("medium");
