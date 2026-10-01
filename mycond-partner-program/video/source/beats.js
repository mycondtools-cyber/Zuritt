const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async()=>{const H=+process.argv[2]||1350;const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:H}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>errs.push(m.text()));
await p.goto('file://'+process.cwd()+'/motion.html?h='+H);await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(500);
require('fs').mkdirSync('mb',{recursive:true});
const ts=[];for(let i=0;i<28;i++)ts.push(i*0.5+0.42);
for(const [i,t] of ts.entries()){await p.evaluate(t=>seek(t),t);await p.screenshot({path:`mb/b${String(i).padStart(2,'0')}.png`});}
console.log(errs.slice(0,5));await b.close()})();
