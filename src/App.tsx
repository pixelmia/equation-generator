import { useState } from 'react';
import { CanvasViewport } from './components/CanvasViewport';
import { ControlPanel } from './components/ControlPanel';
import { createRandomSettings } from './math/orbitEngine';
import type { OrbitSettings, RenderStats } from './types';

const defaultSettings: OrbitSettings = {
  a: -1.4,
  b: 1.6,
  c: 1.0,
  d: 0.7,
  iterations: 450_000,
  gamma: 1.32,
  brightness: 1.25,
  pointSize: 1,
  color: '#20dcff',
  colorEnd: '#f4fbff',
  backgroundColor: '#777777',
  glowEnabled: true,
  glowColor: '#b8ff5f',
  glowColorEnd: '#20dcff',
  glowAmount: 1,
};

const defaultStats: RenderStats = {
  plotted: 0,
  progress: 0,
  elapsedMs: 0,
  maxDensity: 0,
};

export default function App() {
  const [settings, setSettings] = useState<OrbitSettings>(defaultSettings);
  const [stats, setStats] = useState<RenderStats>(defaultStats);
  const [isPaused, setIsPaused] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);

  const reset = () => {
    setSettings(defaultSettings);
    setIsPaused(false);
    setResetSignal((signal) => signal + 1);
  };

  return (
    <main className="app-shell">
      <section className="canvas-stage">
        <CanvasViewport
          settings={settings}
          isPaused={isPaused}
          resetSignal={resetSignal}
          onStats={setStats}
        />
      </section>

      <ControlPanel
        settings={settings}
        stats={stats}
        isPaused={isPaused}
        onChange={setSettings}
        onRandomize={() => {
          setSettings((current) => createRandomSettings(current));
          setIsPaused(false);
        }}
        onPause={() => setIsPaused(true)}
        onResume={() => setIsPaused(false)}
        onReset={reset}
      />
    </main>
  );
}
