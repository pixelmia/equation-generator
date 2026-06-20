/**
 * Converts a density value into a color ramp derived from the selected
 * fractal, glow, and canvas background colors.
 */
export function densityToColor(
  density: number,
  maxDensity: number,
  baseColor: string,
  baseColorEnd: string,
  gamma: number,
  brightness: number,
  backgroundColor: string,
  glowEnabled: boolean,
  glowColor: string,
  glowColorEnd: string,
  glowAmount: number,
): [number, number, number, number] {
  if (density <= 0 || maxDensity <= 0) {
    const [r, g, b] = hexToRgb(backgroundColor);
    return [r, g, b, 255];
  }

  const normalized = Math.min(1, density / maxDensity);
  const corrected = Math.pow(normalized, 1 / gamma);
  const intensity = Math.min(1, corrected * brightness);
  const base = mixRgb(hexToRgb(baseColor), hexToRgb(baseColorEnd), corrected);
  const amount = glowEnabled ? Math.max(0, Math.min(2, glowAmount)) : 0;
  const glowBase = glowEnabled
    ? mixRgb(hexToRgb(glowColor), hexToRgb(glowColorEnd), corrected)
    : base;
  const lowLight = amount > 0
    ? mixRgb(base.map((channel) => channel * 0.48), glowBase.map((channel) => channel * 0.32), Math.min(1, amount))
    : base.map((channel) => channel * 0.48);
  const glow = mixRgb(lowLight, base, amount > 0 ? Math.min(1, intensity * (1.1 - amount * 0.2)) : 1);
  const hot = amount > 0
    ? mixRgb(glow, glowBase, Math.max(0, intensity - (0.72 - amount * 0.18)) / 0.42 * amount)
    : glow;

  const [r, g, b] = hot;

  const alpha = Math.round(255 * Math.min(1, 0.2 + intensity * (1 + amount * 0.35)));
  return [
    Math.round(r * intensity),
    Math.round(g * intensity),
    Math.round(b * intensity),
    alpha,
  ];
}

function mixRgb(from: number[], to: number[], amount: number): number[] {
  const t = Math.max(0, Math.min(1, amount));
  return from.map((channel, index) => channel + (to[index] - channel) * t);
}

function hexToRgb(hex: string): number[] {
  const normalized = hex.replace('#', '');

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return [32, 220, 255];
  }

  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}
