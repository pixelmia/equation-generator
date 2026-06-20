import type { CSSProperties, ReactElement } from 'react';
import type { OrbitSettings, RenderStats } from '../types';
import { equationName } from '../math/orbitEngine';

type ControlPanelProps = {
  settings: OrbitSettings;
  stats: RenderStats;
  isPaused: boolean;
  onChange: (settings: OrbitSettings) => void;
  onRandomize: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
};

type SliderDefinition = {
  key:
    | 'a'
    | 'b'
    | 'c'
    | 'd'
    | 'iterations'
    | 'gamma'
    | 'brightness'
    | 'pointSize'
    | 'glowAmount';
  label: string;
  min: number;
  max: number;
  step: number;
  decimals: number;
};

const sliders: SliderDefinition[] = [
  { key: 'a', label: 'Parameter A', min: -3, max: 3, step: 0.001, decimals: 3 },
  { key: 'b', label: 'Parameter B', min: -3, max: 3, step: 0.001, decimals: 3 },
  { key: 'c', label: 'Parameter C', min: -3, max: 3, step: 0.001, decimals: 3 },
  { key: 'd', label: 'Parameter D', min: -3, max: 3, step: 0.001, decimals: 3 },
  {
    key: 'iterations',
    label: 'Iteration count',
    min: 50_000,
    max: 2_000_000,
    step: 10_000,
    decimals: 0,
  },
  { key: 'gamma', label: 'Gamma correction', min: 0.35, max: 2.8, step: 0.01, decimals: 2 },
  { key: 'brightness', label: 'Brightness', min: 0.25, max: 2.5, step: 0.01, decimals: 2 },
  { key: 'pointSize', label: 'Plot point size', min: 1, max: 6, step: 1, decimals: 0 },
  { key: 'glowAmount', label: 'Glow amount', min: 0, max: 2, step: 0.01, decimals: 2 },
];

const parameterPresets = [
  {
    name: 'Butterfly',
    values: {
      a: 1.4,
      b: -2.3,
      c: 2.4,
      d: -2.1,
    },
  },
  {
    name: 'Flower',
    values: {
      a: 1.641,
      b: 1.902,
      c: 0.316,
      d: 1.525,
    },
  },
  {
    name: 'Nebula',
    values: {
      a: 0.97,
      b: -1.899,
      c: 1.381,
      d: -1.506,
    },
  },
  {
    name: 'Swirl',
    values: {
      a: 2.01,
      b: -2.53,
      c: 1.61,
      d: -0.33,
    },
  },
  {
    name: 'Alien',
    values: {
      a: -2.7,
      b: -0.09,
      c: -0.86,
      d: -2.2,
    },
  },
  {
    name: 'Wings',
    values: {
      a: -0.827,
      b: -1.637,
      c: 1.659,
      d: -0.943,
    },
  },
  {
    name: 'Jellyfish',
    values: {
      a: -2.24,
      b: 0.43,
      c: -0.65,
      d: -2.43,
    },
  },
  {
    name: 'Starburst',
    values: {
      a: -2.0,
      b: -2.0,
      c: -1.2,
      d: 2.0,
    },
  },
  {
    name: 'Orchid',
    values: {
      a: -0.709,
      b: 1.638,
      c: 0.452,
      d: 1.74,
    },
  },
];

export function ControlPanel({
  settings,
  stats,
  isPaused,
  onChange,
  onRandomize,
  onPause,
  onResume,
  onReset,
}: ControlPanelProps) {
  const updateColor = (color: string) =>
    onChange({
      ...settings,
      color,
    });
  const updateColorEnd = (colorEnd: string) =>
    onChange({
      ...settings,
      colorEnd,
    });
  const updateBackgroundColor = (backgroundColor: string) =>
    onChange({
      ...settings,
      backgroundColor,
    });
  const updateGlowColor = (glowColor: string) =>
    onChange({
      ...settings,
      glowColor,
    });
  const updateGlowColorEnd = (glowColorEnd: string) =>
    onChange({
      ...settings,
      glowColorEnd,
    });
  const updateGlowEnabled = (glowEnabled: boolean) =>
    onChange({
      ...settings,
      glowEnabled,
    });
  const updateSlider = (slider: SliderDefinition, rawValue: number) => {
    if (!Number.isFinite(rawValue)) {
      return;
    }

    onChange({
      ...settings,
      [slider.key]: normalizeSliderValue(slider, rawValue),
    });
  };
  const applyPreset = (preset: (typeof parameterPresets)[number]) =>
    onChange({
      ...settings,
      ...preset.values,
    });

  return (
    <aside className="control-panel" aria-label="Fractal controls">
      <header className="panel-title">
        <h1>Equation Generator</h1>
      </header>

      <section className="panel-section stats-panel">
        <div className="stats-strip">
          <span>Density {stats.maxDensity.toLocaleString()}</span>
          <span>Time {(stats.elapsedMs / 1000).toFixed(1)}s</span>
          <span>Canvas HTML5</span>
          <span>{equationName}</span>
        </div>
      </section>

      <section className="panel-section render-panel" aria-live="polite">
        <div className="section-heading">
          <Icon name="activity" />
          <h2>Render</h2>
        </div>

        <div className="render-card">
          <div className="render-state">
            <span className={isPaused ? 'status-dot paused' : 'status-dot'} />
            <strong>{isPaused ? 'Paused' : stats.progress >= 1 ? 'Complete' : 'Rendering'}</strong>
          </div>
          <div className="render-meter" aria-hidden="true">
            <span style={{ width: `${Math.round(stats.progress * 100)}%` }} />
          </div>
          <div className="render-readouts">
            <span>{formatNumber(stats.plotted)} plotted samples</span>
            <span>{(stats.progress * 100).toFixed(1)}%</span>
          </div>
        </div>
      </section>

      <section className="panel-section presets-section">
        <div className="section-heading">
          <Icon name="preset" />
          <h2>Presets</h2>
        </div>

        <div className="preset-list">
          {parameterPresets.map((preset) => (
            <button
              className="preset-button"
              type="button"
              onClick={() => applyPreset(preset)}
              aria-label={`Apply ${preset.name}`}
              key={preset.name}
            >
              <span>{preset.name}</span>
              <span className="preset-values">
                A {formatPresetValue(preset.values.a)} / B {formatPresetValue(preset.values.b)} / C{' '}
                {formatPresetValue(preset.values.c)} / D {formatPresetValue(preset.values.d)}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel-section">
        <div className="section-heading">
          <Icon name="sliders" />
          <h2>Parameters</h2>
        </div>

        <div className="slider-stack">
          {sliders.map((slider) => {
            const value = settings[slider.key] ?? slider.min;

            return (
              <label className="slider-field" key={slider.key}>
                <span className="slider-meta">
                  <span>{slider.label}</span>
                  <input
                    className="number-box"
                    type="number"
                    min={slider.min}
                    max={slider.max}
                    step={slider.step}
                    value={formatSliderInput(value, slider.decimals)}
                    onChange={(event) => updateSlider(slider, Number(event.currentTarget.value))}
                    aria-label={`${slider.label} value`}
                  />
                </span>
                <input
                  type="range"
                  min={slider.min}
                  max={slider.max}
                  step={slider.step}
                  value={value}
                  style={getSliderTrackStyle(slider, value)}
                  onChange={(event) => updateSlider(slider, Number(event.currentTarget.value))}
                />
              </label>
            );
          })}
        </div>

        <div className="color-stack">
          <div className="color-field">
            <span className="slider-meta">
              <span>Base gradient</span>
              <output>{settings.color.toUpperCase()}</output>
            </span>
            <div className="color-pair">
              <label className="color-picker-shell" data-label="Start">
                <span
                  className="color-swatch"
                  style={{ backgroundColor: settings.color, color: settings.color }}
                />
                <input
                  type="color"
                  value={settings.color}
                  onChange={(event) => updateColor(event.currentTarget.value)}
                  onInput={(event) => updateColor(event.currentTarget.value)}
                  aria-label="Base gradient start color"
                />
              </label>
              <label className="color-picker-shell" data-label="End">
                <span
                  className="color-swatch"
                  style={{ backgroundColor: settings.colorEnd, color: settings.colorEnd }}
                />
                <input
                  type="color"
                  value={settings.colorEnd}
                  onChange={(event) => updateColorEnd(event.currentTarget.value)}
                  onInput={(event) => updateColorEnd(event.currentTarget.value)}
                  aria-label="Base gradient end color"
                />
              </label>
            </div>
          </div>

          <label className="color-field">
            <span className="slider-meta">
              <span>Canvas background</span>
              <output>{settings.backgroundColor.toUpperCase()}</output>
            </span>
            <span className="color-picker-shell" data-label="Pick background">
              <span
                className="color-swatch"
                style={{
                  backgroundColor: settings.backgroundColor,
                  color: settings.backgroundColor,
                }}
              />
              <input
                type="color"
                value={settings.backgroundColor}
                onChange={(event) => updateBackgroundColor(event.currentTarget.value)}
                onInput={(event) => updateBackgroundColor(event.currentTarget.value)}
                aria-label="Canvas background color"
              />
            </span>
          </label>

          <label className="toggle-field">
            <span>
              <strong>Glow</strong>
              <small>{settings.glowEnabled ? 'On' : 'Off'}</small>
            </span>
            <input
              type="checkbox"
              checked={settings.glowEnabled}
              onChange={(event) => updateGlowEnabled(event.currentTarget.checked)}
              aria-label="Toggle glow"
            />
          </label>

          <div className="color-field">
            <span className="slider-meta">
              <span>Glow gradient</span>
              <output>{settings.glowColor.toUpperCase()}</output>
            </span>
            <div className="color-pair">
              <label className="color-picker-shell" data-label="Start">
                <span
                  className="color-swatch"
                  style={{ backgroundColor: settings.glowColor, color: settings.glowColor }}
                />
                <input
                  type="color"
                  value={settings.glowColor}
                  onChange={(event) => updateGlowColor(event.currentTarget.value)}
                  onInput={(event) => updateGlowColor(event.currentTarget.value)}
                  aria-label="Glow gradient start color"
                />
              </label>
              <label className="color-picker-shell" data-label="End">
                <span
                  className="color-swatch"
                  style={{ backgroundColor: settings.glowColorEnd, color: settings.glowColorEnd }}
                />
                <input
                  type="color"
                  value={settings.glowColorEnd}
                  onChange={(event) => updateGlowColorEnd(event.currentTarget.value)}
                  onInput={(event) => updateGlowColorEnd(event.currentTarget.value)}
                  aria-label="Glow gradient end color"
                />
              </label>
            </div>
          </div>
        </div>
      </section>

      <section className="panel-section controls-section">
        <div className="section-heading">
          <Icon name="play" />
          <h2>Controls</h2>
        </div>

        <div className="button-grid">
          <button type="button" onClick={onRandomize}>
            <Icon name="shuffle" />
            Randomize
          </button>
          <button type="button" onClick={onPause} disabled={isPaused}>
            <Icon name="pause" />
            Pause
          </button>
          <button type="button" onClick={onResume} disabled={!isPaused}>
            <Icon name="play" />
            Resume
          </button>
          <button type="button" onClick={onReset}>
            <Icon name="reset" />
            Reset
          </button>
        </div>
      </section>

      <section className="panel-section info-section">
        <div className="section-heading">
          <Icon name="info" />
          <h2>Equation</h2>
        </div>
        <dl>
          <div>
            <dt>x_next</dt>
            <dd>sin(a * y) - cos(b * x)</dd>
          </div>
          <div>
            <dt>y_next</dt>
            <dd>sin(c * x) - cos(d * y)</dd>
          </div>
          <div>
            <dt>x</dt>
            <dd>0</dd>
          </div>
          <div>
            <dt>y</dt>
            <dd>0</dd>
          </div>
        </dl>
      </section>
    </aside>
  );
}

function formatNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }

  return `${(value / 1_000).toFixed(1)}K`;
}

function formatSliderInput(value: number, decimals: number): string {
  return decimals === 0 ? String(Math.round(value)) : value.toFixed(decimals);
}

function normalizeSliderValue(slider: SliderDefinition, value: number): number {
  const clamped = Math.min(slider.max, Math.max(slider.min, value));
  return slider.decimals === 0 ? Math.round(clamped) : Number(clamped.toFixed(slider.decimals));
}

function getSliderProgress(slider: SliderDefinition, value: number): number {
  const range = slider.max - slider.min;

  if (range <= 0) {
    return 0;
  }

  const clamped = Math.min(slider.max, Math.max(slider.min, value));
  return ((clamped - slider.min) / range) * 100;
}

function getSliderTrackStyle(slider: SliderDefinition, value: number): CSSProperties {
  return {
    '--slider-progress': `${getSliderProgress(slider, value)}%`,
  } as CSSProperties;
}

function formatPresetValue(value: number): string {
  return value.toFixed(1);
}

type IconName = 'activity' | 'sliders' | 'play' | 'pause' | 'shuffle' | 'reset' | 'info' | 'preset';

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactElement> = {
    activity: (
      <>
        <path d="M4 12h4l2-6 4 12 2-6h4" />
      </>
    ),
    sliders: (
      <>
        <path d="M4 6h16" />
        <path d="M4 12h16" />
        <path d="M4 18h16" />
        <circle cx="9" cy="6" r="2" />
        <circle cx="15" cy="12" r="2" />
        <circle cx="11" cy="18" r="2" />
      </>
    ),
    preset: (
      <>
        <path d="M5 5h14v14H5z" />
        <path d="M9 9h6" />
        <path d="M9 15h6" />
      </>
    ),
    play: <path d="m9 6 10 6-10 6V6Z" />,
    pause: (
      <>
        <path d="M8 6v12" />
        <path d="M16 6v12" />
      </>
    ),
    shuffle: (
      <>
        <path d="M4 7h3c3 0 4 10 8 10h5" />
        <path d="M16 13l4 4-4 4" />
        <path d="M4 17h3c1.8 0 3-2.4 4.2-4.8" />
        <path d="M16 3l4 4-4 4" />
        <path d="M14 7h6" />
      </>
    ),
    reset: (
      <>
        <path d="M5 12a7 7 0 1 0 2-5" />
        <path d="M5 5v6h6" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 10v6" />
        <path d="M12 7h.01" />
      </>
    ),
  };

  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}
