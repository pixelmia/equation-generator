import type { OrbitSettings } from '../types';

export type OrbitPoint = {
  x: number;
  y: number;
};

const cliffordPresets = [
  { a: -1.4, b: 1.6, c: 1.0, d: 0.7 },
  { a: -1.7, b: 1.8, c: -1.9, d: -0.4 },
  { a: 1.5, b: -1.8, c: 1.6, d: 0.9 },
  { a: -1.3, b: -1.4, c: -1.9, d: -1.2 },
  { a: 1.7, b: 1.7, c: 0.6, d: 1.2 },
  { a: -1.6, b: 1.2, c: 0.1, d: -1.2 },
];

export const equationName = 'Sine Cosine Attractor';

/**
 * Evolves the orbit using:
 * x_next = sin(a * y) - cos(b * x)
 * y_next = sin(c * x) - cos(d * y)
 */
export function nextOrbitPoint(point: OrbitPoint, settings: OrbitSettings): OrbitPoint {
  const xNext = Math.sin(settings.a * point.y) - Math.cos(settings.b * point.x);
  const yNext = Math.sin(settings.c * point.x) - Math.cos(settings.d * point.y);

  return {
    x: xNext,
    y: yNext,
  };
}

export function createRandomSettings(current: OrbitSettings): OrbitSettings {
  const preset = cliffordPresets[Math.floor(Math.random() * cliffordPresets.length)];

  return {
    ...current,
    a: preset.a + randomInRange(-0.18, 0.18),
    b: preset.b + randomInRange(-0.18, 0.18),
    c: preset.c + randomInRange(-0.16, 0.16),
    d: preset.d + randomInRange(-0.16, 0.16),
    gamma: randomInRange(0.75, 1.85),
    brightness: randomInRange(0.85, 1.55),
  };
}

export function randomSeed(): OrbitPoint {
  return {
    x: 0,
    y: 0,
  };
}

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
