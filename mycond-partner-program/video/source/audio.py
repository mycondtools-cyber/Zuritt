"""120 BPM loop (7 bars, 14 s) + UI sounds placed on the animation's events. Seamless: tails wrap to the start."""
import numpy as np, wave
SR = 48000; L = 14.0; N = int(SR * L); BEAT = 0.5
rng = np.random.default_rng(7)
out = np.zeros(N + SR * 2)  # room for tails, folded back later

def add(sig, t, gain=1.0):
    i = int(round(t * SR)); out[i:i + len(sig)] += sig * gain

def env(n, a=0.002, d=0.2, s=0.0, curve=6.0):
    t = np.arange(n) / SR
    e = np.minimum(1, t / a) * np.exp(-t / d * (curve / 6))
    return e

def lp(x, cut):
    from scipy.signal import lfilter
    a = np.exp(-2 * np.pi * cut / SR)
    return lfilter([1 - a], [1, -a], lfilter([1 - a], [1, -a], x))

def hp(x, cut):
    return x - lp(x, cut)

note = lambda m: 440 * 2 ** ((m - 69) / 12)

# ---- drums ----
n = int(0.45 * SR); t = np.arange(n) / SR
f = 48 + 110 * np.exp(-t * 32)
kick = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7.5)
kick += 0.35 * np.sin(2 * np.pi * np.cumsum(f * 2) / SR) * np.exp(-t * 40)
kick = np.tanh(kick * 1.6)
noise = rng.standard_normal(int(0.25 * SR))
clap = hp(lp(noise, 2600), 700) * env(len(noise), 0.001, 0.07)
hat_n = rng.standard_normal(int(0.06 * SR))
hat = hp(hat_n, 7000) * env(len(hat_n), 0.0005, 0.018)
ohat_n = rng.standard_normal(int(0.2 * SR))
ohat = hp(ohat_n, 6500) * env(len(ohat_n), 0.001, 0.06)

for i in range(28):
    tb = i * BEAT
    add(kick, tb, 0.9)
    if i % 2 == 1: add(clap, tb, 0.32)
    add(hat, tb + BEAT / 2, 0.16)
    add(hat, tb, 0.07)
    if i % 4 == 3: add(ohat, tb + BEAT / 2, 0.09)

# ---- harmony: Am F C G | Am F C (loops to Am) ----
prog = [(57, [57, 60, 64]), (53, [53, 57, 60]), (48, [55, 60, 64]), (55, [55, 59, 62]),
        (57, [57, 60, 64]), (53, [53, 57, 60]), (48, [55, 60, 64])]
duck = np.ones(len(out))
for i in range(28):  # sidechain
    s0 = int(i * BEAT * SR); m = int(0.22 * SR)
    duck[s0:s0 + m] = np.minimum(duck[s0:s0 + m], 0.35 + 0.65 * (np.arange(m) / m) ** 1.5)
music = np.zeros(len(out))
def madd(sig, t, g):
    i = int(round(t * SR)); music[i:i + len(sig)] += sig * g
for bar, (root, chord) in enumerate(prog):
    t0 = bar * 4 * BEAT
    # bass: offbeat 8ths
    for k in range(8):
        if k % 2 == 1 or k == 0:
            nn = int(0.22 * SR); tt = np.arange(nn) / SR; fr = note(root - 24)
            sig = (np.sin(2 * np.pi * fr * tt) + 0.3 * np.sin(4 * np.pi * fr * tt)) * env(nn, 0.004, 0.16)
            madd(sig, t0 + k * BEAT / 2, 0.42)
    # chord stabs on the "and" of 2 and 4 + soft pad
    for st in (1.5, 3.5):
        nn = int(0.35 * SR); tt = np.arange(nn) / SR; sig = np.zeros(nn)
        for m in chord:
            fr = note(m + 12)
            sig += 2 / np.pi * np.arcsin(np.sin(2 * np.pi * fr * tt)) + 0.2 * np.sin(4 * np.pi * fr * tt)
        madd(lp(sig * env(nn, 0.003, 0.12), 3200), t0 + st * BEAT, 0.07)
    nn = int(2.05 * SR); tt = np.arange(nn) / SR; pad = np.zeros(nn)
    for m in chord:
        for det in (-0.08, 0.08):
            pad += np.sin(2 * np.pi * note(m) * (1 + det / 100) * tt)
    pad *= np.minimum(1, tt / 0.15) * np.minimum(1, (2.05 - tt) / 0.2)
    madd(pad, t0, 0.022)
    # little pluck arpeggio on 16ths in bars 2,4,6
    if bar % 2 == 1:
        for k, m in enumerate([chord[0] + 24, chord[1] + 24, chord[2] + 24, chord[1] + 24] * 2):
            nn = int(0.15 * SR); tt = np.arange(nn) / SR
            madd(np.sin(2 * np.pi * note(m) * tt) * env(nn, 0.001, 0.06), t0 + 2 * BEAT + k * BEAT / 4, 0.05)
out += music * duck

# ---- UI sounds (onset == event time) ----
def click(g=0.5, f=3200):
    nn = int(0.03 * SR); s = hp(lp(rng.standard_normal(nn), f), 900) * env(nn, 0.0003, 0.006)
    tt = np.arange(nn) / SR; s += 0.6 * np.sin(2 * np.pi * 1700 * tt) * env(nn, 0.0003, 0.004)
    return s * g
def blip(fr, d=0.12, g=0.35):
    nn = int(d * SR); tt = np.arange(nn) / SR
    return (np.sin(2 * np.pi * fr * tt) + 0.25 * np.sin(4 * np.pi * fr * tt)) * env(nn, 0.002, d / 3) * g
def key(g=0.35):
    nn = int(0.025 * SR); return hp(lp(rng.standard_normal(nn), 5000), 1500) * env(nn, 0.0003, 0.005) * g

b = lambda x: x * BEAT
for tt_ in [b(1), b(5), b(6), b(9), b(10), b(14.5), b(15), b(15.5), b(24)]:
    add(click(), tt_)
add(click(0.3, 2200), b(8))                              # release
add(blip(880, 0.1), b(2)); add(blip(1318.5, 0.18), b(2) + 0.07)   # check chime
add(blip(660, 0.08, 0.2), b(5) + 0.02)                    # toggle on
for k in range(9):                                        # drag ticks
    add(key(0.12), b(6) + k * 0.11)
for tt_ in [b(17), b(17.25), b(17.5), b(17.75)]:
    add(key(0.4), tt_)
add(click(0.55, 1500), b(19))                              # enter
add(blip(988, 0.1, 0.3), b(19) + 0.05); add(blip(1480, 0.2, 0.3), b(19) + 0.13)   # toast
for i, fr in enumerate([523.3, 659.3, 784.0]):
    add(blip(fr, 0.14, 0.28), b(21.5 + 0.5 * i))           # ladder bars
for i, fr in enumerate([784.0, 987.8, 1174.7]):
    add(blip(fr, 0.25, 0.22), b(24) + 0.06 * i)            # final chime
for k in range(3):
    add(click(0.25, 4000), b(14.5 + 0.5 * k) + 0.05)

# fold tails into the loop and normalise
loop = out[:N].copy(); loop[:len(out) - N] += out[N:]
loop = np.tanh(loop * 1.1) / np.tanh(1.1)
loop *= 0.89 / np.max(np.abs(loop))
pcm = (loop * 32767).astype(np.int16)
with wave.open('music.wav', 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
# verify the grid: onsets of the kick should land every 0.5 s
env_ = np.abs(loop); frame = int(0.01 * SR)
e = env_[:len(env_) // frame * frame].reshape(-1, frame).max(1)
peaks = [i * 0.01 for i in range(1, len(e) - 1) if e[i] > 0.5 and e[i] >= e[i - 1] and e[i] >= e[i + 1]]
print('first peaks (s):', [round(p, 2) for p in peaks[:12]])
