const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async()=>{
 const b=await chromium.launch();
 const p=await b.newPage({viewport:{width:1920,height:1080}});
 await p.goto('file://'+process.cwd()+'/extra.html',{waitUntil:'networkidle'});
 await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(800);
 const n=await p.$$eval('.slide',s=>s.length);
 require('fs').mkdirSync('xpng',{recursive:true});
 for(let i=0;i<n;i++){const el=(await p.$$('.slide'))[i];await el.screenshot({path:`xpng/x_${String(i+1).padStart(2,'0')}.png`});}
 await p.emulateMedia({media:'print'});
 await p.pdf({path:'extra.pdf',width:'1920px',height:'1080px',printBackground:true,margin:{top:0,right:0,bottom:0,left:0}});
 await b.close();console.log(n);})();
