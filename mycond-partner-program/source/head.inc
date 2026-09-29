<!DOCTYPE html>
<html lang="uk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mycond — Партнерська програма</title>
<link rel="stylesheet" href="fonts.css">
<style>
:root{--g:#5BAE48;--g2:#4A9A39;--gl:#EAF5E6;--ink:#141414;--mute:#5E6660;--line:#E9ECE8;--wm:#F1F2F0}
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:#1b1c1b}
body{font-family:Inter,Arial,sans-serif;color:var(--ink)}
.deck{display:flex;flex-direction:column;align-items:center;gap:28px;padding:28px 0}
.slide{width:1920px;height:1080px;position:relative;overflow:hidden;background:#fff;flex:none}
.h{font-family:Montserrat,Arial,sans-serif;font-weight:900;text-transform:uppercase;letter-spacing:-.5px;line-height:1.02}
.tag{position:absolute;left:140px;top:96px;background:var(--g);color:#fff;font:600 24px/1 Inter,Arial;padding:12px 20px;z-index:5}
.logo{position:absolute;right:100px;top:70px;width:128px;height:128px;background:var(--g);border:4px solid #fff;outline:1px solid rgba(0,0,0,.04);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:5}
.logo img{width:88px;margin-top:4px}
.logo b{font:700 15px/1 Georgia,serif;color:#fff;letter-spacing:.5px;margin-top:4px}
.wm{position:absolute;inset:0;pointer-events:none;z-index:0}
.content{position:absolute;inset:0;z-index:2}
.pn{position:absolute;right:100px;bottom:54px;font:600 20px Inter;color:#B5BAB4;z-index:5}
.green{background:var(--g)}
.green .logo{border-color:#fff}
.sub{font:500 30px/1.45 Inter;color:var(--mute)}
.chip{display:inline-block;background:var(--gl);color:var(--g2);font:700 22px/1 Montserrat;padding:12px 18px;border-radius:40px}
.card{background:#fff;border:2px solid var(--line);border-radius:28px}
ul.ticks{list-style:none}
ul.ticks li{position:relative;padding-left:54px;font:500 30px/1.35 Inter;margin:0 0 22px}
ul.ticks li:before{content:"";position:absolute;left:0;top:4px;width:34px;height:34px;border-radius:50%;background:var(--g) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M6 12.5l4 4 8-9' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/22px no-repeat}
.shot{border-radius:18px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.25)}
.phone{position:absolute;width:420px;height:860px;border-radius:64px;background:#0d0d0d;padding:16px;box-shadow:0 40px 90px rgba(0,0,0,.35)}
.phone .scr{width:100%;height:100%;border-radius:50px;overflow:hidden;position:relative;background:#fff}
.phone .notch{position:absolute;left:50%;top:26px;transform:translateX(-50%);width:130px;height:34px;border-radius:20px;background:#0d0d0d;z-index:3}
.browser{position:absolute;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.22)}
.browser .bar{height:44px;background:#EEF0ED;display:flex;align-items:center;gap:9px;padding:0 18px}
.browser .bar i{width:13px;height:13px;border-radius:50%;background:#D4D7D3;display:block}
.browser .bar span{margin-left:16px;background:#fff;border-radius:8px;padding:6px 16px;font:500 15px Inter;color:#7a807a;flex:1}
@media print{html,body{background:#fff}.deck{padding:0;gap:0}.slide{page-break-after:always;break-after:page}}
@page{size:1920px 1080px;margin:0}
/* viewer */
body.view .deck{padding:0;gap:0}
</style>
</head>
<body>
<div class="deck">