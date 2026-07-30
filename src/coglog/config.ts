import type { Difficulty } from './CogLog';

export type ConditionLabel = 'Random' | 'Tunnel';
export type VariantParam = 'auto' | 'desktop' | 'mobile';

/**
 * Task configuration the participant can set on the launch screen.
 * Note: `condition` (Tunnel vs Random) is intentionally NOT here; it is
 * randomly assigned per run and hidden until the debrief.
 */
export interface TaskConfig {
  difficulty: Difficulty;
  trials: number;
  penaltySeconds: number;
  showHud: boolean;
}

export const DEFAULT_CONFIG: TaskConfig = {
  difficulty: 'Hard',
  trials: 15,
  penaltySeconds: 15,
  showHud: true,
};

export const DIFFICULTIES: Difficulty[] = ['Easy', 'Medium', 'Hard'];
export const CONDITIONS: ConditionLabel[] = ['Random', 'Tunnel'];

/** Randomly assign a between-subjects condition (50/50). */
export function randomCondition(): ConditionLabel {
  return Math.random() < 0.5 ? 'Tunnel' : 'Random';
}

// Bounds mirror the design's prop schema (CogLog.dc.html data-props).
export const TRIALS_RANGE = { min: 3, max: 40 } as const;
export const PENALTY_RANGE = { min: 0, max: 30 } as const;

function clampInt(raw: string | null, min: number, max: number, fallback: number): number {
  if (raw == null || raw.trim() === '') return fallback;
  const v = Number(raw);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, Math.round(v)));
}

function oneOf<T extends string>(v: string | null, allowed: readonly T[], fallback: T): T {
  const hit = allowed.find((a) => a.toLowerCase() === (v ?? '').toLowerCase());
  return hit ?? fallback;
}

/** Parse a TaskConfig (plus optional variant) from URL search params. */
export function parseConfig(params: URLSearchParams): TaskConfig & { variant: VariantParam } {
  return {
    difficulty: oneOf(params.get('difficulty'), DIFFICULTIES, DEFAULT_CONFIG.difficulty),
    trials: clampInt(params.get('trials'), TRIALS_RANGE.min, TRIALS_RANGE.max, DEFAULT_CONFIG.trials),
    penaltySeconds: clampInt(
      params.get('penaltySeconds'),
      PENALTY_RANGE.min,
      PENALTY_RANGE.max,
      DEFAULT_CONFIG.penaltySeconds,
    ),
    showHud: params.get('showHud') == null ? DEFAULT_CONFIG.showHud : params.get('showHud') !== 'false',
    variant: oneOf(params.get('variant'), ['auto', 'desktop', 'mobile'] as const, 'auto'),
  };
}

/** Serialize a config to a query string (omitting values equal to the default). */
export function serializeConfig(cfg: TaskConfig, variant: VariantParam = 'auto'): string {
  const p = new URLSearchParams();
  if (cfg.difficulty !== DEFAULT_CONFIG.difficulty) p.set('difficulty', cfg.difficulty);
  if (cfg.trials !== DEFAULT_CONFIG.trials) p.set('trials', String(cfg.trials));
  if (cfg.penaltySeconds !== DEFAULT_CONFIG.penaltySeconds) p.set('penaltySeconds', String(cfg.penaltySeconds));
  if (cfg.showHud !== DEFAULT_CONFIG.showHud) p.set('showHud', String(cfg.showHud));
  if (variant !== 'auto') p.set('variant', variant);
  return p.toString();
}
