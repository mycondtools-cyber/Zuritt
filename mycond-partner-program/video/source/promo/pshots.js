const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async()=>{const [S,H]=[process.argv[2],+process.argv[3]];const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:H}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+`/promo.html?s=${S}&h=${H}`);await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(600);
const D=await p.evaluate(()=>DUR);require('fs').mkdirSync('ps',{recursive:true});
const n=+process.argv[4]||24;for(let i=0;i<n;i++){const t=(i+0.7)*D/n;await p.evaluate(t=>seek(t),t);await p.screenshot({path:`ps/${S}_${String(i).padStart(2,'0')}.png`});}
console.log(D,errs.slice(0,3));await b.close()})();
