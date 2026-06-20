import { densityToColor } from '../color/colorMap';
import { nextOrbitPoint, randomSeed, type OrbitPoint } from '../math/orbitEngine';
import type { OrbitSettings, RenderStats } from '../types';

type RendererOptions = {
  canvas: HTMLCanvasElement;
  settings: OrbitSettings;
  onStats: (stats: RenderStats) => void;
};

const BATCH_SIZE = 18_000;
const WARMUP_ITERATIONS = 80;
const CANVAS_ZOOM = 1.3;

export class OrbitRenderer {
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private density = new Uint32Array(0);
  private settings: OrbitSettings;
  private point: OrbitPoint = randomSeed();
  private animationId = 0;
  private hasStarted = false;
  private isPaused = false;
  private plotted = 0;
  private maxDensity = 0;
  private startTime = performance.now();
  private onStats: (stats: RenderStats) => void;

  constructor({ canvas, settings, onStats }: RendererOptions) {
    this.canvas = canvas;
    const context = canvas.getContext('2d', { alpha: false });

    if (!context) {
      throw new Error('Canvas 2D context is not available.');
    }

    this.context = context;
    this.settings = settings;
    this.onStats = onStats;
    this.resize();
  }

  updateSettings(settings: OrbitSettings): void {
    const needsRestart =
      settings.a !== this.settings.a ||
      settings.b !== this.settings.b ||
      settings.c !== this.settings.c ||
      settings.d !== this.settings.d ||
      settings.iterations !== this.settings.iterations;

    this.settings = settings;

    if (needsRestart) {
      this.reset();
    } else {
      this.paint();
    }
  }

  resize(): void {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width * ratio));
    const height = Math.max(1, Math.floor(rect.height * ratio));

    if (
      this.canvas.width !== width ||
      this.canvas.height !== height ||
      this.density.length !== width * height
    ) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.density = new Uint32Array(width * height);
      this.reset();
    }
  }

  start(): void {
    this.hasStarted = true;
    this.isPaused = false;
    cancelAnimationFrame(this.animationId);
    this.loop();
  }

  pause(): void {
    this.isPaused = true;
    cancelAnimationFrame(this.animationId);
  }

  resume(): void {
    if (!this.isPaused) {
      return;
    }

    this.isPaused = false;
    this.hasStarted = true;
    this.loop();
  }

  reset(): void {
    this.density.fill(0);
    this.point = randomSeed();
    this.plotted = 0;
    this.maxDensity = 0;
    this.startTime = performance.now();
    this.context.fillStyle = this.settings.backgroundColor;
    this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);

    for (let i = 0; i < WARMUP_ITERATIONS; i += 1) {
      this.point = nextOrbitPoint(this.point, this.settings);
    }

    this.paintStats();

    if (this.hasStarted && !this.isPaused) {
      cancelAnimationFrame(this.animationId);
      this.loop();
    }
  }

  destroy(): void {
    cancelAnimationFrame(this.animationId);
  }

  private loop = (): void => {
    if (this.isPaused) {
      return;
    }

    this.iterateBatch();
    this.paint();
    this.paintStats();

    if (this.plotted < this.settings.iterations) {
      this.animationId = requestAnimationFrame(this.loop);
    }
  };

  private iterateBatch(): void {
    const limit = Math.min(BATCH_SIZE, this.settings.iterations - this.plotted);

    for (let i = 0; i < limit; i += 1) {
      this.point = nextOrbitPoint(this.point, this.settings);
      const pixelIndex = this.projectPoint(this.point);
      const density = this.density[pixelIndex] + 1;
      this.density[pixelIndex] = density;

      if (density > this.maxDensity) {
        this.maxDensity = density;
      }

      this.plotted += 1;
    }
  }

  private projectPoint(point: OrbitPoint): number {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      this.point = randomSeed();
      return 0;
    }

    const halfWidth = this.canvas.width / 2;
    const halfHeight = this.canvas.height / 2;
    const scale = Math.min(this.canvas.width, this.canvas.height) * 0.18 * CANVAS_ZOOM;
    const x = Math.floor(halfWidth + point.x * scale);
    const y = Math.floor(halfHeight + point.y * scale);

    const clampedX = Math.max(0, Math.min(this.canvas.width - 1, x));
    const clampedY = Math.max(0, Math.min(this.canvas.height - 1, y));

    return clampedY * this.canvas.width + clampedX;
  }

  private paint(): void {
    const image = this.context.createImageData(this.canvas.width, this.canvas.height);
    const pixels = image.data;
    const paintDensity = this.createPaintDensity();

    for (let index = 0; index < paintDensity.length; index += 1) {
      const density = paintDensity[index];
      const [r, g, b, a] = densityToColor(
        density,
        this.maxDensity,
        this.settings.color,
        this.settings.colorEnd,
        this.settings.gamma,
        this.settings.brightness,
        this.settings.backgroundColor,
        this.settings.glowEnabled,
        this.settings.glowColor,
        this.settings.glowColorEnd,
        this.settings.glowAmount,
      );
      const offset = index * 4;
      pixels[offset] = r;
      pixels[offset + 1] = g;
      pixels[offset + 2] = b;
      pixels[offset + 3] = a;
    }

    this.context.putImageData(image, 0, 0);
  }

  private createPaintDensity(): Uint32Array {
    const pointSize = Math.max(1, Math.round(this.settings.pointSize));

    if (pointSize === 1) {
      return this.density;
    }

    // Expand occupied density cells at paint time so point size changes do not recompute the orbit.
    const paintDensity = new Uint32Array(this.density.length);
    const startOffset = -Math.floor((pointSize - 1) / 2);
    const endOffset = Math.ceil((pointSize - 1) / 2);

    for (let index = 0; index < this.density.length; index += 1) {
      const density = this.density[index];

      if (density === 0) {
        continue;
      }

      const x = index % this.canvas.width;
      const y = Math.floor(index / this.canvas.width);

      for (let dy = startOffset; dy <= endOffset; dy += 1) {
        const paintY = y + dy;

        if (paintY < 0 || paintY >= this.canvas.height) {
          continue;
        }

        for (let dx = startOffset; dx <= endOffset; dx += 1) {
          const paintX = x + dx;

          if (paintX < 0 || paintX >= this.canvas.width) {
            continue;
          }

          const paintIndex = paintY * this.canvas.width + paintX;
          paintDensity[paintIndex] = Math.max(paintDensity[paintIndex], density);
        }
      }
    }

    return paintDensity;
  }

  private paintStats(): void {
    this.onStats({
      plotted: this.plotted,
      progress: Math.min(1, this.plotted / this.settings.iterations),
      elapsedMs: performance.now() - this.startTime,
      maxDensity: this.maxDensity,
    });
  }
}
