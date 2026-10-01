// node rv.js H seg nseg out.mp4  — renders 60fps with 4 subframes (motion blur) at 2x, downscaled to 1080 wide
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { spawn } = require('child_process');
const FF = '/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2';
(async () => {
  const [H, seg, nseg, out] = [+process.argv[2], +process.argv[3], +process.argv[4], process.argv[5]];
  const FPS = 60, SUB = 4, L = +process.argv[7], NF = FPS * L;
  const f0 = Math.floor(NF * seg / nseg), f1 = Math.floor(NF * (seg + 1) / nseg);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: H }, deviceScaleFactor: 2 });
  await p.goto('file://' + process.cwd() + '/promo.html?s=' + process.argv[6] + '&h=' + H);
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(400);
  const ff = spawn(FF, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS * SUB), '-c:v', 'png', '-i', '-',
    '-vf', `scale=1080:-2:flags=lanczos,tmix=frames=${SUB},select='eq(mod(n\\,${SUB})\\,${SUB - 1})',setpts=N/${FPS}/TB`,
    '-r', String(FPS), '-c:v', 'libx264', '-preset', 'slow', '-crf', '10', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-x264-params', 'keyint=60', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = f0; f < f1; f++) for (let j = 0; j < SUB; j++) {
    const t = f / FPS + (j - (SUB - 1) / 2) / (FPS * SUB * 2);   // 180° shutter
    await p.evaluate(t => seek(t), t);
    const buf = await p.screenshot({ type: 'png' });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r)); await b.close();
  console.log('done', seg, f0, f1);
})();
