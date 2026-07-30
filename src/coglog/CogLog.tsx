import { useEffect, useRef } from 'react';
import {
  createCogLog,
  type CompleteResult,
  type Condition,
  type EngineOpts,
  type Engine,
  type Variant,
} from './engine';

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
  /** Guided-tooltip walkthrough instead of a scored block. */
  tutorial?: boolean;
  /** Fired by the in-task "Back" button. */
  onExit?: () => void;
  /** Fired when a scored block finishes (not fired in tutorial mode). */
  onComplete?: (result: CompleteResult) => void;
  /** Extra styles for the mount element (size is controlled by the parent). */
  style?: React.CSSProperties;
  className?: string;
}

// Difficulty → engine tuning. Targets are intentionally tiny so the participant
// must zoom in to see the Gabor patch (footprint in world px = targetSize * 2).
const DIFFICULTY: Record<Difficulty, { contrast: number; targetSize: number }> = {
  Easy: { contrast: 0.55, targetSize: 12 },
  Medium: { contrast: 0.4, targetSize: 8 },
  Hard: { contrast: 0.26, targetSize: 5 },
};

// Gentle profile for the tutorial: easy to find while learning the controls.
const TUTORIAL_TUNING = { contrast: 0.6, targetSize: 16, trials: 3, penaltySeconds: 0 };

/** The serializable engine options (callbacks are attached separately). */
type EngineDataOpts = Omit<EngineOpts, 'onExit' | 'onComplete'>;

function toEngineOpts(props: CogLogProps): EngineDataOpts {
  const variant = props.variant ?? 'desktop';
  const condition = ((props.condition ?? 'Random').toLowerCase()) as Condition;
  if (props.tutorial) {
    return {
      variant,
      contrast: TUTORIAL_TUNING.contrast,
      targetSize: TUTORIAL_TUNING.targetSize,
      trials: TUTORIAL_TUNING.trials,
      penaltySeconds: TUTORIAL_TUNING.penaltySeconds,
      condition,
      showHud: props.showHud ?? true,
      tutorial: true,
    };
  }
  const d = DIFFICULTY[props.difficulty ?? 'Hard'];
  return {
    variant,
    contrast: d.contrast,
    targetSize: d.targetSize,
    trials: props.trials ?? 15,
    penaltySeconds: props.penaltySeconds ?? 15,
    condition,
    showHud: props.showHud ?? true,
    tutorial: false,
  };
}

/**
 * CogLog visual-search task. Wraps the imperative canvas engine: React owns
 * the mount lifecycle, the engine owns rendering and interaction.
 */
export function CogLog(props: CogLogProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);

  // Keep the latest callbacks in a ref so the engine can call them through
  // stable wrappers without being recreated when the callbacks change identity.
  const cbRef = useRef({ onExit: props.onExit, onComplete: props.onComplete });
  cbRef.current = { onExit: props.onExit, onComplete: props.onComplete };

  // Create the engine once per mount; recreate only if the mount node changes.
  useEffect(() => {
    if (!mountRef.current) return;
    const engine = createCogLog(mountRef.current, {
      ...toEngineOpts(props),
      onExit: () => cbRef.current.onExit?.(),
      onComplete: (r) => cbRef.current.onComplete?.(r),
    });
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push option changes into the running engine (resets the session, matching
  // the original design's componentDidUpdate behaviour). Callbacks are excluded
  // from the key (functions drop out of JSON.stringify), so identity churn on
  // the parent's inline handlers doesn't restart the task.
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
