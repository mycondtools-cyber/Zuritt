
<style>
body.view{overflow:hidden;background:#111}
body.view .deck{display:block;padding:0}
body.view .slide{position:absolute;left:50%;top:50%;transform-origin:center;display:none}
body.view .slide.on{display:block}
#nav{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);display:flex;gap:10px;align-items:center;z-index:99;font:600 14px Inter,Arial;color:#fff;background:rgba(0,0,0,.55);padding:8px 14px;border-radius:30px;opacity:.25;transition:opacity .2s}
#nav:hover{opacity:1}
#nav button{background:#5BAE48;border:0;color:#fff;font:700 16px Inter;width:34px;height:34px;border-radius:50%;cursor:pointer}
@media print{#nav{display:none}}
</style>
<div id="nav"><button id="pv">‹</button><span id="ct"></span><button id="nx">›</button><button id="fs" title="Повний екран">⤢</button></div>
<script>
(function(){
 if(matchMedia('print').matches)return;
 document.body.classList.add('view');
 var S=[].slice.call(document.querySelectorAll('.slide')),i=0;
 var h=parseInt(location.hash.slice(1));if(h>0&&h<=S.length)i=h-1;
 function fit(){var k=Math.min(innerWidth/1920,innerHeight/1080);S.forEach(function(s){s.style.transform='translate(-50%,-50%) scale('+k+')'})}
 function go(n){i=Math.max(0,Math.min(S.length-1,n));S.forEach(function(s,j){s.classList.toggle('on',j===i)});document.getElementById('ct').textContent=(i+1)+' / '+S.length;history.replaceState(null,'','#'+(i+1))}
 addEventListener('resize',fit);
 addEventListener('keydown',function(e){if(['ArrowRight','PageDown',' ','Enter'].indexOf(e.key)>=0){go(i+1);e.preventDefault()}if(['ArrowLeft','PageUp','Backspace'].indexOf(e.key)>=0){go(i-1);e.preventDefault()}if(e.key==='f')fsx()});
 document.addEventListener('click',function(e){if(e.target.closest('#nav'))return;go(e.clientX>innerWidth/3?i+1:i-1)});
 var tx=0;addEventListener('touchstart',function(e){tx=e.touches[0].clientX},{passive:true});
 addEventListener('touchend',function(e){var d=e.changedTouches[0].clientX-tx;if(Math.abs(d)>40)go(d<0?i+1:i-1)});
 function fsx(){var d=document.documentElement;document.fullscreenElement?document.exitFullscreen():(d.requestFullscreen||d.webkitRequestFullscreen).call(d)}
 document.getElementById('pv').onclick=function(){go(i-1)};document.getElementById('nx').onclick=function(){go(i+1)};document.getElementById('fs').onclick=fsx;
 fit();go(i);
 addEventListener('beforeprint',function(){document.body.classList.remove('view')});
 addEventListener('afterprint',function(){document.body.classList.add('view');fit()});
})();
</script>
