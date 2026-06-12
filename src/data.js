"use strict";
/* ============ DATASET (June 12, 2026) ============ */
const DATA = {
  models: [
    {id:"fable5",   name:"Claude Fable 5",        family:"anthropic", inP:10,   outP:50,   cacheRead:0.10, cacheWrite:1.25},
    {id:"opus48",   name:"Claude Opus 4.8",       family:"anthropic", inP:5,    outP:25,   cacheRead:0.10, cacheWrite:1.25},
    {id:"sonnet46", name:"Claude Sonnet 4.6",     family:"anthropic", inP:3,    outP:15,   cacheRead:0.10, cacheWrite:1.25},
    {id:"haiku45",  name:"Claude Haiku 4.5",      family:"anthropic", inP:1,    outP:5,    cacheRead:0.10, cacheWrite:1.25},
    {id:"gpt55",    name:"GPT-5.5",               family:"openai",    inP:5,    outP:30,   cacheRead:0.10, cacheWrite:1.0},
    {id:"gpt54",    name:"GPT-5.4",               family:"openai",    inP:2.5,  outP:15,   cacheRead:0.10, cacheWrite:1.0},
    {id:"gpt54n",   name:"GPT-5.4 Nano",          family:"openai",    inP:0.2,  outP:1.25, cacheRead:0.10, cacheWrite:1.0},
    {id:"gem31p",   name:"Gemini 3.1 Pro",        family:"google",    inP:2,    outP:12,   cacheRead:0.25, cacheWrite:1.0},
    {id:"gem35f",   name:"Gemini 3.5 Flash",      family:"google",    inP:1.5,  outP:9,    cacheRead:0.25, cacheWrite:1.0},
    {id:"gem3f",    name:"Gemini 3 Flash",        family:"google",    inP:0.5,  outP:3,    cacheRead:0.25, cacheWrite:1.0},
    {id:"dsv4f",    name:"DeepSeek V4 Flash",     family:"deepseek",  inP:0.14, outP:0.28, cacheRead:0.02, cacheWrite:1.0},
    {id:"llama4m",  name:"Llama 4 Maverick (hosted)", family:"meta",  inP:0.27, outP:0.85, cacheRead:1.0,  cacheWrite:1.0}
  ],
  cheapestInFamily: {anthropic:"haiku45", openai:"gpt54n", google:"gem3f", deepseek:"dsv4f", meta:"llama4m"},
  gpus: [
    {id:"h100_neo",  name:"H100 80GB · neocloud (Lambda/RunPod)", rate:2.69},
    {id:"h100_aws",  name:"H100 80GB · AWS",                      rate:7.50},
    {id:"h100_gcp",  name:"H100 80GB · GCP",                      rate:10.50},
    {id:"h100_az",   name:"H100 80GB · Azure",                    rate:12.25},
    {id:"h200_neo",  name:"H200 141GB · neocloud",                rate:4.39},
    {id:"b200_neo",  name:"B200 · neocloud",                      rate:5.29},
    {id:"b200_aws",  name:"B200 · AWS",                           rate:14.24},
    {id:"a100_neo",  name:"A100 80GB · neocloud",                 rate:1.99}
  ],
  tools: [
    {id:"search",  name:"Web search (Serper-class)",      price:0.001,  calls:3, on:true},
    {id:"searchP", name:"Web search, premium (Tavily)",   price:0.008,  calls:0, on:false},
    {id:"fetch",   name:"Page fetch / scrape",            price:0.001,  calls:2, on:true},
    {id:"sandbox", name:"Code sandbox exec (E2B-class)",  price:0.002,  calls:0, on:false},
    {id:"vector",  name:"Vector DB query",                price:0.0001, calls:4, on:true},
    {id:"embed",   name:"Embedding call",                 price:0.0002, calls:2, on:false}
  ]
};

const PRESETS = {
  light:  {label:"Support bot",     desc:"200 tasks/d · 5 steps",  tasksPerDay:200, steps:5,  sysTokens:3000,  userTokens:200, outPerStep:300,  toolTokens:500,  cacheHit:80, model:"haiku45",  route:0,
           tools:{search:1,fetch:0,sandbox:0,vector:2,embed:0,searchP:0}},
  medium: {label:"Research agent",  desc:"50 tasks/d · 15 steps",  tasksPerDay:50,  steps:15, sysTokens:8000,  userTokens:400, outPerStep:800,  toolTokens:1500, cacheHit:70, model:"sonnet46", route:20,
           tools:{search:6,fetch:8,sandbox:0,vector:3,embed:2,searchP:0}},
  heavy:  {label:"Coding agent",    desc:"30 tasks/d · 40 steps",  tasksPerDay:30,  steps:40, sysTokens:12000, userTokens:600, outPerStep:1200, toolTokens:2000, cacheHit:85, model:"opus48",   route:30,
           tools:{search:2,fetch:1,sandbox:15,vector:0,embed:0,searchP:0}},
  custom: {label:"Custom",          desc:"your own dials"}
};

const SLIDERS = [
  {id:"tasksPerDay", label:"Tasks per day",            min:1,    max:2000,  step:1,   val:50,   hint:"Agent runs kicked off daily"},
  {id:"steps",       label:"Steps per task",           min:1,    max:80,    step:1,   val:15,   hint:"LLM round trips; each tool call is one step"},
  {id:"sysTokens",   label:"System + tool defs tokens",min:500,  max:30000, step:500, val:8000, hint:"Re-sent every step; the cache target"},
  {id:"userTokens",  label:"User input tokens",        min:0,    max:5000,  step:100, val:400,  hint:"The initial request"},
  {id:"outPerStep",  label:"Output tokens per step",   min:50,   max:4000,  step:50,  val:800,  hint:"Includes thinking tokens"},
  {id:"toolTokens",  label:"Tool result tokens per step",min:0,  max:10000, step:100, val:1500, hint:"Results appended to context each step"},
  {id:"cacheHit",    label:"Prompt cache hit rate",    min:0,    max:95,    step:5,   val:70,   hint:"% of repeated context served from cache", pct:true}
];
