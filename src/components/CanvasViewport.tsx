import { useEffect, useRef } from 'react';
import { OrbitRenderer } from '../renderer/orbitRenderer';
import type { OrbitSettings, RenderStats } from '../types';

type CanvasViewportProps = {
  settings: OrbitSettings;
  isPaused: boolean;
  resetSignal: number;
  onStats: (stats: RenderStats) => void;
};

export function CanvasViewport({ settings, isPaused, resetSignal, onStats }: CanvasViewportProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<OrbitRenderer | null>(null);

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }

    const renderer = new OrbitRenderer({
      canvas: canvasRef.current,
      settings,
      onStats,
    });
    rendererRef.current = renderer;
    renderer.start();

    const handleResize = () => renderer.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.destroy();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    rendererRef.current?.updateSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (isPaused) {
      rendererRef.current?.pause();
    } else {
      rendererRef.current?.resume();
    }
  }, [isPaused]);

  useEffect(() => {
    rendererRef.current?.reset();
  }, [resetSignal]);

  return (
    <canvas
      ref={canvasRef}
      className="fractal-canvas"
      style={{ backgroundColor: settings.backgroundColor }}
      aria-label="Orbit density fractal canvas"
    />
  );
}
