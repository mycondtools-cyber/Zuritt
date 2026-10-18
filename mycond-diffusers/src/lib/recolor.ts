/**
 * Попередній перегляд кольору RAL на фото виробу.
 * Маска «тільки виріб» і базова яскравість фарбування готуються заздалегідь (scripts/recolor/build_masks.py).
 * Алгоритм той самий, що в scripts/recolor/preview.py: тіні й відблиски фото зберігаються, змінюється лише колір.
 */
export interface RecolorSpec {
  image: string;
  mask: string;
  /** Яскравість фарбування на фото (92-й перцентиль у масці), 0..255 */
  base: number;
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Перефарбовує пікселі photo на місці. mask — R-канал маски (0..255) того ж розміру. */
export function recolorPixels(photo: Uint8ClampedArray, mask: Uint8ClampedArray, rgb: [number, number, number], base: number) {
  const hiSpan = Math.max(255 / base - 1, 1e-3);
  for (let i = 0; i < photo.length; i += 4) {
    const m = mask[i] / 255;
    if (m === 0) continue;
    const r = photo[i];
    const g = photo[i + 1];
    const b = photo[i + 2];
    const t = (0.2126 * r + 0.7152 * g + 0.0722 * b) / base;
    const hi = t <= 1 ? 0 : Math.min(1, (t - 1) / hiSpan) ** 1.3 * 0.85;
    for (let c = 0; c < 3; c++) {
      const target = rgb[c];
      // м'якші тіні (t^0,75): порошкова фарба виглядає рівніше, світлі RAL не «сіріють»
      const out = t <= 1 ? target * t ** 0.75 : target + (255 - target) * hi;
      photo[i + c] = photo[i + c] * (1 - m) + out * m;
    }
  }
}
