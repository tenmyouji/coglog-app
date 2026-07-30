import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CogLog } from '../coglog/CogLog';
import { parseConfig, randomCondition, type ConditionLabel } from '../coglog/config';

interface Props {
  /** Guided walkthrough: forces the Random condition and skips the debrief. */
  tutorial?: boolean;
}

/**
 * Fullscreen task route. Task settings come from the URL query string
 * (see coglog/config.ts); the condition is assigned randomly per run and kept
 * out of the URL so the participant stays blind to it until the debrief.
 * Back / Hide-HUD controls live inside the engine's right bar.
 */
export function Experiment({ tutorial = false }: Props) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const cfg = parseConfig(params);
  const [condition] = useState<ConditionLabel>(() => (tutorial ? 'Random' : randomCondition()));
  const variant = cfg.variant === 'auto' ? undefined : cfg.variant;

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#636363' }}>
      <CogLog
        variant={variant}
        difficulty={cfg.difficulty}
        condition={condition}
        trials={cfg.trials}
        penaltySeconds={cfg.penaltySeconds}
        showHud={cfg.showHud}
        tutorial={tutorial}
        onExit={() => navigate('/')}
        onComplete={
          tutorial
            ? undefined
            : (r) =>
                navigate('/debrief', {
                  state: { ...r, condition, difficulty: cfg.difficulty },
                })
        }
        style={{ borderRadius: 0 }}
      />
    </div>
  );
}
