import { useEffect, useRef } from 'react';
import { createCogLog, type Condition, type EngineOpts, type Engine, type Variant } from './engine';

export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export interface CogLogProps {
  variant?: Variant;
  /** Easy/Medium/Hard maps to Gabor contrast + target size (see DIFFICULTY). */
  difficulty?: Difficulty;
  /** Random scatters the target; Tunnel confines priming trials to a quadrant. */
  condition?: 'Random' | 'Tunnel';
  /** Trials per block. */
  trials?: number;
  /** Penalty countdown shown after a wrong classification. */
  penaltySeconds?: number;
  /** Toggle the trial/timer/view HUD. */
  showHud?: boolean;
  /** Extra styles for the mount element (size is controlled by the parent). */
  style?: React.CSSProperties;
  className?: string;
}

// Difficulty → engine tuning, matching CogLog.dc.html's _optsFrom map.
const DIFFICULTY: Record<Difficulty, { contrast: number; targetSize: number }> = {
  Easy: { contrast: 0.55, targetSize: 30 },
  Medium: { contrast: 0.4, targetSize: 22 },
  Hard: { contrast: 0.26, targetSize: 15 },
};

function toEngineOpts(props: CogLogProps): EngineOpts {
  const d = DIFFICULTY[props.difficulty ?? 'Hard'];
  return {
    variant: props.variant ?? 'desktop',
    contrast: d.contrast,
    targetSize: d.targetSize,
    trials: props.trials ?? 15,
    penaltySeconds: props.penaltySeconds ?? 15,
    condition: ((props.condition ?? 'Random').toLowerCase()) as Condition,
    showHud: props.showHud ?? true,
  };
}

/**
 * CogLog visual-search task. Wraps the imperative canvas engine: React owns
 * the mount lifecycle, the engine owns rendering and interaction.
 */
export function CogLog(props: CogLogProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);

  // Create the engine once per mount; recreate only if the mount node changes.
  useEffect(() => {
    if (!mountRef.current) return;
    const engine = createCogLog(mountRef.current, toEngineOpts(props));
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push option changes into the running engine (resets the session, matching
  // the original design's componentDidUpdate behaviour).
  const optsKey = JSON.stringify(toEngineOpts(props));
  useEffect(() => {
    if (engineRef.current) engineRef.current.setOpts(toEngineOpts(props));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optsKey]);

  return (
    <div
      ref={mountRef}
      className={props.className}
      style={{ width: '100%', height: '100%', ...props.style }}
    />
  );
}
