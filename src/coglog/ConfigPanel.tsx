import type { CSSProperties } from 'react';
import {
  CONDITIONS,
  DIFFICULTIES,
  PENALTY_RANGE,
  TRIALS_RANGE,
  type ConditionLabel,
  type TaskConfig,
} from './config';
import type { Difficulty } from './CogLog';

interface Props {
  config: TaskConfig;
  onChange: (next: TaskConfig) => void;
}

/** Compact control panel exposing the task's configurable props. */
export function ConfigPanel({ config, onChange }: Props) {
  const set = <K extends keyof TaskConfig>(key: K, value: TaskConfig[K]) =>
    onChange({ ...config, [key]: value });

  return (
    <div style={S.panel}>
      <div style={S.title}>TASK CONFIG</div>

      <div style={S.field}>
        <label style={S.label}>Difficulty</label>
        <div style={S.segment}>
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              style={seg(config.difficulty === d)}
              onClick={() => set('difficulty', d as Difficulty)}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div style={S.field}>
        <label style={S.label}>Target placement</label>
        <div style={S.segment}>
          {CONDITIONS.map((c) => (
            <button
              key={c}
              style={seg(config.condition === c)}
              onClick={() => set('condition', c as ConditionLabel)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div style={S.field}>
        <label style={S.label}>
          Trials per block <span style={S.value}>{config.trials}</span>
        </label>
        <input
          type="range"
          min={TRIALS_RANGE.min}
          max={TRIALS_RANGE.max}
          value={config.trials}
          onChange={(e) => set('trials', Number(e.target.value))}
          style={S.range}
        />
      </div>

      <div style={S.field}>
        <label style={S.label}>
          Penalty <span style={S.value}>{config.penaltySeconds}s</span>
        </label>
        <input
          type="range"
          min={PENALTY_RANGE.min}
          max={PENALTY_RANGE.max}
          value={config.penaltySeconds}
          onChange={(e) => set('penaltySeconds', Number(e.target.value))}
          style={S.range}
        />
      </div>

      <button style={S.toggle} onClick={() => set('showHud', !config.showHud)}>
        <span style={{ ...S.checkbox, background: config.showHud ? '#f4a400' : 'transparent' }} />
        Show trial HUD
      </button>
    </div>
  );
}

function seg(active: boolean): CSSProperties {
  return {
    flex: 1,
    padding: '7px 4px',
    fontFamily: "'Space Mono', monospace",
    fontSize: 11,
    letterSpacing: '0.06em',
    cursor: 'pointer',
    border: 'none',
    borderRadius: 7,
    background: active ? '#f4a400' : 'rgba(255,255,255,0.06)',
    color: active ? '#3a2b00' : 'rgba(255,255,255,0.7)',
    fontWeight: active ? 700 : 400,
    transition: 'background .12s, color .12s',
  };
}

const S: Record<string, CSSProperties> = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    width: 260,
    padding: '18px 18px 20px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14,
  },
  title: {
    fontSize: 10,
    letterSpacing: '0.22em',
    color: 'rgba(255,255,255,0.4)',
  },
  field: { display: 'flex', flexDirection: 'column', gap: 8 },
  label: {
    fontSize: 11,
    letterSpacing: '0.08em',
    color: 'rgba(255,255,255,0.6)',
    display: 'flex',
    justifyContent: 'space-between',
  },
  value: { color: '#f4a400', fontWeight: 700 },
  segment: { display: 'flex', gap: 6 },
  range: { width: '100%', accentColor: '#f4a400', cursor: 'pointer' },
  toggle: {
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    background: 'transparent',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    color: 'rgba(255,255,255,0.7)',
    fontFamily: "'Space Mono', monospace",
    fontSize: 11,
    letterSpacing: '0.08em',
  },
  checkbox: {
    width: 15,
    height: 15,
    borderRadius: 4,
    border: '2px solid rgba(255,255,255,0.5)',
    flex: '0 0 auto',
    transition: 'background .12s',
  },
};
