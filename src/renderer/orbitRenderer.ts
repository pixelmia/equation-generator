import * as THREE from 'three';
import { nextOrbitPoint, randomSeed, type OrbitPoint } from '../math/orbitEngine';
import type { OrbitSettings, RenderStats } from '../types';

type RendererOptions = {
  canvas: HTMLCanvasElement;
  settings: OrbitSettings;
  onStats: (stats: RenderStats) => void;
};

type ShaderUniforms = {
  uPixelRatio: { value: number };
  uPointSize: { value: number };
  uMaxDensity: { value: number };
  uGamma: { value: number };
  uBrightness: { value: number };
  uBaseStart: { value: THREE.Color };
  uBaseEnd: { value: THREE.Color };
  uGlowStart: { value: THREE.Color };
  uGlowEnd: { value: THREE.Color };
  uGlowAmount: { value: number };
};

const BATCH_SIZE = 24_000;
const WARMUP_ITERATIONS = 80;
const CANVAS_ZOOM = 1.3;
const WORLD_SCALE = 0.42;
const MIN_VIEW_ZOOM = 0.4;
const MAX_VIEW_ZOOM = 28;
const TRACKPAD_ZOOM_SPEED = 0.004;

const vertexShader = `
attribute float density;

uniform float uPixelRatio;
uniform float uPointSize;
uniform float uMaxDensity;
uniform float uGamma;
uniform float uBrightness;
uniform vec3 uBaseStart;
uniform vec3 uBaseEnd;
uniform vec3 uGlowStart;
uniform vec3 uGlowEnd;
uniform float uGlowAmount;

varying vec4 vColor;

vec3 mixRamp(vec3 fromColor, vec3 toColor, float amount) {
  return mix(fromColor, toColor, clamp(amount, 0.0, 1.0));
}

void main() {
  float normalized = uMaxDensity > 0.0 ? clamp(density / uMaxDensity, 0.0, 1.0) : 0.0;
  float corrected = pow(normalized, 1.0 / max(uGamma, 0.001));
  float intensity = clamp(corrected * uBrightness, 0.0, 1.0);
  float amount = clamp(uGlowAmount, 0.0, 2.0);
  vec3 base = mixRamp(uBaseStart, uBaseEnd, corrected);
  vec3 glowBase = mixRamp(uGlowStart, uGlowEnd, corrected);
  vec3 lowLight = amount > 0.0
    ? mix(base * 0.48, glowBase * 0.32, clamp(amount, 0.0, 1.0))
    : base * 0.48;
  vec3 glow = mix(lowLight, base, amount > 0.0 ? clamp(intensity * (1.1 - amount * 0.2), 0.0, 1.0) : 1.0);
  vec3 hot = amount > 0.0
    ? mix(glow, glowBase, clamp((max(0.0, intensity - (0.72 - amount * 0.18)) / 0.42) * amount, 0.0, 1.0))
    : glow;

  vColor = vec4(hot * intensity, clamp(0.2 + intensity * (1.0 + amount * 0.35), 0.0, 1.0));
  gl_PointSize = max(1.0, uPointSize) * uPixelRatio;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = `
varying vec4 vColor;

void main() {
  vec2 centered = gl_PointCoord - vec2(0.5);
  float radius = length(centered);
  float edge = smoothstep(0.5, 0.36, radius);

  if (edge <= 0.0) {
    discard;
  }

  gl_FragColor = vec4(vColor.rgb, vColor.a * edge);
}
`;

export class OrbitRenderer {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  private geometry = new THREE.BufferGeometry();
  private material: THREE.ShaderMaterial;
  private points: THREE.Points;
  private positions = new Float32Array(0);
  private densityAttribute = new Float32Array(0);
  private densityGrid = new Uint32Array(0);
  private settings: OrbitSettings;
  private point: OrbitPoint = randomSeed();
  private animationId = 0;
  private hasStarted = false;
  private isPaused = false;
  private plotted = 0;
  private maxDensity = 0;
  private startTime = performance.now();
  private onStats: (stats: RenderStats) => void;
  private uniforms: ShaderUniforms;
  private viewZoom = 1;
  private viewOffset = new THREE.Vector2(0, 0);
  private activePointerId: number | null = null;
  private lastPointerPosition = new THREE.Vector2(0, 0);

  constructor({ canvas, settings, onStats }: RendererOptions) {
    this.canvas = canvas;
    this.settings = settings;
    this.onStats = onStats;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: false,
      antialias: false,
      powerPreference: 'high-performance',
    });
    this.renderer.autoClear = true;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    this.uniforms = {
      uPixelRatio: { value: this.renderer.getPixelRatio() },
      uPointSize: { value: settings.pointSize },
      uMaxDensity: { value: 1 },
      uGamma: { value: settings.gamma },
      uBrightness: { value: settings.brightness },
      uBaseStart: { value: new THREE.Color(settings.color) },
      uBaseEnd: { value: new THREE.Color(settings.colorEnd) },
      uGlowStart: { value: new THREE.Color(settings.glowColor) },
      uGlowEnd: { value: new THREE.Color(settings.glowColorEnd) },
      uGlowAmount: { value: settings.glowEnabled ? settings.glowAmount : 0 },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.scene.add(this.points);
    this.camera.position.z = 1;
    this.bindGestureControls();
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
    this.updateUniforms();

    if (needsRestart) {
      this.reset();
    } else {
      this.render();
    }
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    const aspect = width / height;

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height, false);
    this.updateCameraProjection(aspect);
    this.uniforms.uPixelRatio.value = this.renderer.getPixelRatio();

    const pixelWidth = Math.max(1, this.renderer.domElement.width);
    const pixelHeight = Math.max(1, this.renderer.domElement.height);

    if (this.densityGrid.length !== pixelWidth * pixelHeight) {
      this.densityGrid = new Uint32Array(pixelWidth * pixelHeight);
      this.reset();
    } else {
      this.render();
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
    this.allocateBuffers();
    this.densityGrid.fill(0);
    this.point = randomSeed();
    this.plotted = 0;
    this.maxDensity = 0;
    this.startTime = performance.now();
    this.geometry.setDrawRange(0, 0);

    for (let i = 0; i < WARMUP_ITERATIONS; i += 1) {
      this.point = nextOrbitPoint(this.point, this.settings);
    }

    this.updateUniforms();
    this.render();
    this.paintStats();

    if (this.hasStarted && !this.isPaused) {
      cancelAnimationFrame(this.animationId);
      this.loop();
    }
  }

  destroy(): void {
    cancelAnimationFrame(this.animationId);
    this.geometry.dispose();
    this.material.dispose();
    this.renderer.dispose();
    this.unbindGestureControls();
  }

  private bindGestureControls(): void {
    this.canvas.addEventListener('wheel', this.handleWheel, { passive: false });
    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    this.canvas.addEventListener('pointermove', this.handlePointerMove);
    this.canvas.addEventListener('pointerup', this.handlePointerUp);
    this.canvas.addEventListener('pointercancel', this.handlePointerUp);
    this.canvas.style.cursor = 'grab';
  }

  private unbindGestureControls(): void {
    this.canvas.removeEventListener('wheel', this.handleWheel);
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    this.canvas.removeEventListener('pointercancel', this.handlePointerUp);
  }

  private handleWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const scale = Math.exp(-event.deltaY * TRACKPAD_ZOOM_SPEED);
    this.zoomAtScreenPoint(scale, event.clientX, event.clientY);
  };

  private handlePointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || this.activePointerId !== null) {
      return;
    }

    this.activePointerId = event.pointerId;
    this.lastPointerPosition.set(event.clientX, event.clientY);
    this.canvas.setPointerCapture(event.pointerId);
    this.canvas.style.cursor = 'grabbing';
  };

  private handlePointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) {
      return;
    }

    const dx = event.clientX - this.lastPointerPosition.x;
    const dy = event.clientY - this.lastPointerPosition.y;
    this.lastPointerPosition.set(event.clientX, event.clientY);
    this.panByScreenDelta(dx, dy);
  };

  private handlePointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) {
      return;
    }

    this.activePointerId = null;
    this.canvas.releasePointerCapture(event.pointerId);
    this.canvas.style.cursor = 'grab';
  };

  private panByScreenDelta(dx: number, dy: number): void {
    const visibleWidth = this.camera.right - this.camera.left;
    const visibleHeight = this.camera.top - this.camera.bottom;
    const rect = this.canvas.getBoundingClientRect();

    this.viewOffset.x -= (dx / Math.max(1, rect.width)) * visibleWidth;
    this.viewOffset.y += (dy / Math.max(1, rect.height)) * visibleHeight;
    this.updateCameraProjection();
    this.render();
  }

  private zoomAtScreenPoint(scale: number, clientX: number, clientY: number): void {
    if (!Number.isFinite(scale) || scale <= 0) {
      return;
    }

    const before = this.screenToWorld(clientX, clientY);
    this.viewZoom = Math.min(MAX_VIEW_ZOOM, Math.max(MIN_VIEW_ZOOM, this.viewZoom * scale));
    this.updateCameraProjection();
    const after = this.screenToWorld(clientX, clientY);
    this.viewOffset.add(before.sub(after));
    this.updateCameraProjection();
    this.render();
  }

  private screenToWorld(clientX: number, clientY: number): THREE.Vector2 {
    const rect = this.canvas.getBoundingClientRect();
    const xRatio = (clientX - rect.left) / Math.max(1, rect.width);
    const yRatio = (clientY - rect.top) / Math.max(1, rect.height);
    const visibleWidth = this.camera.right - this.camera.left;
    const visibleHeight = this.camera.top - this.camera.bottom;

    return new THREE.Vector2(
      this.camera.left + xRatio * visibleWidth,
      this.camera.top - yRatio * visibleHeight,
    );
  }

  private updateCameraProjection(aspect = this.getCanvasAspect()): void {
    const visibleHeight = 2 / this.viewZoom;
    const visibleWidth = visibleHeight * aspect;

    this.camera.left = this.viewOffset.x - visibleWidth / 2;
    this.camera.right = this.viewOffset.x + visibleWidth / 2;
    this.camera.top = this.viewOffset.y + visibleHeight / 2;
    this.camera.bottom = this.viewOffset.y - visibleHeight / 2;
    this.camera.updateProjectionMatrix();
  }

  private getCanvasAspect(): number {
    const rect = this.canvas.getBoundingClientRect();
    return Math.max(1, rect.width) / Math.max(1, rect.height);
  }

  private loop = (): void => {
    if (this.isPaused) {
      return;
    }

    this.iterateBatch();
    this.render();
    this.paintStats();

    if (this.plotted < this.settings.iterations) {
      this.animationId = requestAnimationFrame(this.loop);
    }
  };

  private allocateBuffers(): void {
    const pointCount = Math.max(1, Math.floor(this.settings.iterations));

    if (this.positions.length !== pointCount * 3) {
      this.positions = new Float32Array(pointCount * 3);
      this.densityAttribute = new Float32Array(pointCount);
      this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
      this.geometry.setAttribute('density', new THREE.BufferAttribute(this.densityAttribute, 1).setUsage(THREE.DynamicDrawUsage));
    }
  }

  private iterateBatch(): void {
    const limit = Math.min(BATCH_SIZE, this.settings.iterations - this.plotted);
    const positionAttribute = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    const densityBufferAttribute = this.geometry.getAttribute('density') as THREE.BufferAttribute;

    for (let i = 0; i < limit; i += 1) {
      this.point = nextOrbitPoint(this.point, this.settings);

      if (!Number.isFinite(this.point.x) || !Number.isFinite(this.point.y)) {
        this.point = randomSeed();
      }

      const pointIndex = this.plotted;
      const positionOffset = pointIndex * 3;
      this.positions[positionOffset] = this.point.x * WORLD_SCALE * CANVAS_ZOOM;
      this.positions[positionOffset + 1] = -this.point.y * WORLD_SCALE * CANVAS_ZOOM;
      this.positions[positionOffset + 2] = 0;

      const density = this.projectDensity(this.point);
      this.densityAttribute[pointIndex] = density;

      if (density > this.maxDensity) {
        this.maxDensity = density;
      }

      this.plotted += 1;
    }

    positionAttribute.needsUpdate = true;
    densityBufferAttribute.needsUpdate = true;
    this.geometry.setDrawRange(0, this.plotted);
    this.uniforms.uMaxDensity.value = Math.max(1, this.maxDensity);
  }

  private projectDensity(point: OrbitPoint): number {
    const width = this.renderer.domElement.width;
    const height = this.renderer.domElement.height;
    const x = Math.floor(width / 2 + point.x * Math.min(width, height) * 0.18 * CANVAS_ZOOM);
    const y = Math.floor(height / 2 + point.y * Math.min(width, height) * 0.18 * CANVAS_ZOOM);
    const clampedX = Math.max(0, Math.min(width - 1, x));
    const clampedY = Math.max(0, Math.min(height - 1, y));
    const pixelIndex = clampedY * width + clampedX;
    const density = this.densityGrid[pixelIndex] + 1;
    this.densityGrid[pixelIndex] = density;

    return density;
  }

  private updateUniforms(): void {
    this.renderer.setClearColor(new THREE.Color(this.settings.backgroundColor), 1);
    this.uniforms.uPointSize.value = this.settings.pointSize;
    this.uniforms.uMaxDensity.value = Math.max(1, this.maxDensity);
    this.uniforms.uGamma.value = this.settings.gamma;
    this.uniforms.uBrightness.value = this.settings.brightness;
    this.uniforms.uBaseStart.value.set(this.settings.color);
    this.uniforms.uBaseEnd.value.set(this.settings.colorEnd);
    this.uniforms.uGlowStart.value.set(this.settings.glowColor);
    this.uniforms.uGlowEnd.value.set(this.settings.glowColorEnd);
    this.uniforms.uGlowAmount.value = this.settings.glowEnabled ? this.settings.glowAmount : 0;
  }

  private render(): void {
    this.renderer.render(this.scene, this.camera);
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
