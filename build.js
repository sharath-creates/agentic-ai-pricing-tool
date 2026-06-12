#!/usr/bin/env node
// Builds the single-file distributable from src/. Usage: node build.js
const fs = require("fs");
const read = f => fs.readFileSync(f, "utf8");
let html = read("src/template.html");
html = html.replace("/*__STYLES__*/", () => read("src/styles.css").trim());
html = html.replace("//__SCRIPT__", () => read("src/data.js").trim() + "\n" + read("src/app.js").trim());
fs.writeFileSync("agentic-ai-pricing-tool.html", html);
console.log("Built agentic-ai-pricing-tool.html (" + html.length + " bytes)");
