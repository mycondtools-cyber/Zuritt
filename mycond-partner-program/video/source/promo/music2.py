"""Music + SFX beds for the three promo scenarios (120 BPM). Usage: python3 music2.py A|B|C"""
import numpy as np, wave, sys
from scipy.signal import lfilter
SC = sys.argv[1]
SR = 48000; BEAT = .5
CFG = {
    'A': dict(dur=28, drop=9.0, brk=(20.3, 21.9), end=23.6, wipes=[8.9, 9.95, 20.25, 23.55], stamp=21.9,
              pops=[.55, 1.45, 2.35, 3.25, 15.4, 15.62, 15.84], pings=[5.0, 6.4], ticks=[]),
    'B': dict(dur=26, drop=0.0, brk=(16.26, 17.4), end=20.55, wipes=[4.6, 6.5, 20.55], stamp=17.4,
              pops=[10.55, 10.73, 10.91, 11.09], pings=[14.9], ticks=[]),
    'C': dict(dur=22, drop=0.0, brk=(11.9, 14.3), end=18.85, wipes=[15.75], stamp=14.3,
              pops=[6.5, 6.65, 6.8], pings=[], ticks=[3.6, 5.35, 7.17, 9.1, 11.02]),
}[SC]
N = int(SR * CFG['dur']); out = np.zeros(N + SR * 3); rng = np.random.default_rng(11)
def add(buf, sig, t, g=1.0):
    i = int(round(t * SR));
    if i < 0: sig = sig[-i:]; i = 0
    buf[i:i + len(sig)] += sig[:max(0, len(buf) - i)] * g
def env(n, a, d): t = np.arange(n) / SR; return np.minimum(1, t / a) * np.exp(-t / d)
def lp(x, c): a = np.exp(-2 * np.pi * c / SR); return lfilter([1 - a], [1, -a], lfilter([1 - a], [1, -a], x))
hp = lambda x, c: x - lp(x, c)
note = lambda m: 440 * 2 ** ((m - 69) / 12)

n = int(.45 * SR); t = np.arange(n) / SR; fk = 46 + 120 * np.exp(-t * 30)
kick = np.tanh(1.7 * (np.sin(2 * np.pi * np.cumsum(fk) / SR) * np.exp(-t * 7) + .3 * np.sin(4 * np.pi * np.cumsum(fk) / SR) * np.exp(-t * 40)))
nz = rng.standard_normal(int(.25 * SR)); clap = hp(lp(nz, 2600), 700) * env(len(nz), .001, .07)
hn = rng.standard_normal(int(.06 * SR)); hat = hp(hn, 7000) * env(len(hn), .0005, .018)

prog = [(57, [57, 60, 64]), (53, [53, 57, 60]), (48, [55, 60, 64]), (55, [55, 59, 62])]
drums = np.zeros(len(out)); music = np.zeros(len(out))
nb = int(CFG['dur'] / BEAT)
b0, b1 = CFG['brk']
for i in range(nb):
    tb = i * BEAT
    if tb >= CFG['dur'] - 1.0: break
    inbrk = b0 <= tb < b1
    if tb < CFG['drop']:
        if SC == 'A' and i % 2 == 0: add(drums, kick * .6, tb, .5)          # heartbeat intro
        continue
    if inbrk: continue
    add(drums, kick, tb, .9)
    if i % 2 == 1: add(drums, clap, tb, .3)
    add(drums, hat, tb + BEAT / 2, .15); add(drums, hat, tb, .06)
for bar in range(int(CFG['dur'] / 2) + 1):
    t0 = bar * 2.0
    if t0 >= CFG['dur'] - .5: break
    root, ch = prog[bar % 4]
    # pad everywhere (darker / filtered in A's intro)
    nn = int(2.05 * SR); tt = np.arange(nn) / SR; pad = np.zeros(nn)
    for m in ch:
        for det in (-.1, .1): pad += np.sign(np.sin(2 * np.pi * note(m) * (1 + det / 100) * tt)) * .5 + np.sin(2 * np.pi * note(m) * tt)
    pad *= np.minimum(1, tt / .2) * np.minimum(1, (2.05 - tt) / .25)
    cut = 600 if (SC == 'A' and t0 < CFG['drop']) else 1800
    add(music, lp(pad, cut), t0, .02)
    if t0 >= CFG['drop'] and not (b0 <= t0 < b1):
        for k in range(8):
            if k % 2 == 1 or k == 0:
                nn = int(.22 * SR); tt = np.arange(nn) / SR; fr = note(root - 24)
                add(music, (np.sin(2 * np.pi * fr * tt) + .3 * np.sin(4 * np.pi * fr * tt)) * env(nn, .004, .16), t0 + k * BEAT / 2, .4)
        for k, m in enumerate([ch[0] + 24, ch[1] + 24, ch[2] + 24, ch[1] + 24] * 2):
            nn = int(.15 * SR); tt = np.arange(nn) / SR
            add(music, np.sin(2 * np.pi * note(m) * tt) * env(nn, .001, .06), t0 + 1.0 + k * BEAT / 4, .045)
# riser into the drop (A) / into the end card
def riser(t_end, d=1.5, g=.18):
    nn = int(d * SR); tt = np.arange(nn) / SR; s = hp(rng.standard_normal(nn), 800)
    s = lp(s, 6000) * (tt / d) ** 2.2
    add(music, s, t_end - d, g)
if SC == 'A': riser(CFG['drop'])
riser(CFG['end'], 1.2, .14)
# sidechain
duck = np.ones(len(out))
for i in range(nb):
    tb = i * BEAT
    if tb < CFG['drop'] or b0 <= tb < b1: continue
    s0 = int(tb * SR); m = int(.22 * SR); duck[s0:s0 + m] = np.minimum(duck[s0:s0 + m], .35 + .65 * (np.arange(m) / m) ** 1.5)
out += drums + music * duck
# SFX
def whoosh():
    nn = int(.6 * SR); tt = np.arange(nn) / SR; s = rng.standard_normal(nn)
    cut = 300 + 5000 * np.sin(np.pi * tt / .6) ** 2
    y = np.zeros(nn); z = 0.0
    for i in range(nn):
        a = np.exp(-2 * np.pi * cut[i] / SR); z = (1 - a) * s[i] + a * z; y[i] = z
    return y * np.sin(np.pi * tt / .6) ** 1.5
def thump():
    nn = int(.6 * SR); tt = np.arange(nn) / SR; f = 40 + 90 * np.exp(-tt * 25)
    return np.tanh(2 * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 6)) + .5 * hp(rng.standard_normal(nn), 2000) * env(nn, .0005, .02)
def blip(fr, d=.12, g=.3):
    nn = int(d * SR); tt = np.arange(nn) / SR; return (np.sin(2 * np.pi * fr * tt) + .25 * np.sin(4 * np.pi * fr * tt)) * env(nn, .002, d / 3) * g
def pop():
    nn = int(.08 * SR); tt = np.arange(nn) / SR; f = 900 * np.exp(-tt * 30) + 300
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(nn, .001, .025) * .35
for w in CFG['wipes']: add(out, whoosh(), w - .15, .5)
add(out, thump(), CFG['stamp'], .8)
for p in CFG['pops']: add(out, pop(), p)
for p in CFG['pings']: add(out, blip(1320, .14), p); add(out, blip(1760, .18), p + .09)
for p in CFG['ticks']: add(out, blip(1046, .1, .25), p); add(out, blip(1568, .16, .22), p + .06)
loop = out[:N] * np.minimum(1, (CFG['dur'] - np.arange(N) / SR) / .8)    # fade the last 0.8 s
loop = np.tanh(loop * 1.1) / np.tanh(1.1); loop *= .89 / np.max(np.abs(loop))
with wave.open(f'music_{SC}.wav', 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((loop * 32767).astype(np.int16).tobytes())
print(SC, CFG['dur'], 's')
