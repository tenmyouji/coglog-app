import { useState, type CSSProperties } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CogLog } from '../coglog/CogLog';
import { parseConfig } from '../coglog/config';

/**
 * Fullscreen experiment route. Reads task configuration from the URL query
 * string (see coglog/config.ts), so a researcher can hand a participant a
 * single pre-configured link, e.g. /experiment?difficulty=Hard&trials=20.
 */
export function Experiment() {
  const [params] = useSearchParams();
  const cfg = parseConfig(params);
  const variant = cfg.variant === 'auto' ? undefined : cfg.variant;
  const [hidden, setHidden] = useState(false);

  return (
    <div style={S.wrap}>
      <CogLog
        variant={variant}
        difficulty={cfg.difficulty}
        condition={cfg.condition}
        trials={cfg.trials}
        penaltySeconds={cfg.penaltySeconds}
        showHud={cfg.showHud}
        style={{ borderRadius: 0 }}
      />
      {!hidden && (
        <div style={S.controls}>
          <Link to="/" style={S.btn}>
            ← BACK
          </Link>
          <button style={S.btn} onClick={() => setHidden(true)}>
            HIDE
          </button>
        </div>
      )}
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  wrap: { position: 'fixed', inset: 0, background: '#636363' },
  controls: { position: 'absolute', left: 16, bottom: 16, zIndex: 30, display: 'flex', gap: 8 },
  btn: {
    background: 'rgba(20,20,20,0.6)',
    border: '1px solid rgba(255,255,255,0.2)',
    color: 'rgba(255,255,255,0.8)',
    fontFamily: "'Space Mono', monospace",
    fontSize: 11,
    letterSpacing: '0.1em',
    padding: '7px 12px',
    borderRadius: 8,
    cursor: 'pointer',
    textDecoration: 'none',
  },
};
