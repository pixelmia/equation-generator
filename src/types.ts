export type OrbitSettings = {
  a: number;
  b: number;
  c: number;
  d: number;
  iterations: number;
  gamma: number;
  brightness: number;
  pointSize: number;
  color: string;
  colorEnd: string;
  backgroundColor: string;
  glowEnabled: boolean;
  glowColor: string;
  glowColorEnd: string;
  glowAmount: number;
};

export type RenderStats = {
  plotted: number;
  progress: number;
  elapsedMs: number;
  maxDensity: number;
};
