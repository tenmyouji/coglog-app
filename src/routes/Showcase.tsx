import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { CogLog } from '../coglog/CogLog';
import { ConfigPanel } from '../coglog/ConfigPanel';
import { DEFAULT_CONFIG, serializeConfig, type TaskConfig, type VariantParam } from '../coglog/config';

/**
 * Showcase page — the design's header plus the desktop and mobile form factors
 * side by side, now driven by a live config panel. Each device links to the
 * fullscreen /experiment route carrying the current configuration.
 */
export function Showcase() {
  const [config, setConfig] = useState<TaskConfig>(DEFAULT_CONFIG);
  const [copied, setCopied] = useState(false);

  const expHref = (variant: VariantParam) => {
    const qs = serializeConfig(config, variant);
    return qs ? `/experiment?${qs}` : '/experiment';
  };

  const copyLink = async () => {
    const url = window.location.origin + expHref('auto');
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard may be unavailable (e.g. non-secure context); ignore silently.
    }
  };

  return (
    <div style={S.page}>
      <header style={S.header}>
        <div style={S.brandRow}>
          <span style={S.brand}>CogLog</span>
          <span style={S.tag}>2.1 — VISUAL SEARCH TASK</span>
        </div>
        <p style={S.blurb}>
          An attentional-tunneling research task. Pan and zoom the color-gradient canvas to find the
          hidden <strong style={S.strong}>Gabor patch</strong>, click it, then classify its
          orientation. A wrong answer triggers a penalty. The minimap's red outline marks your
          current viewport. Same task, two form factors.
        </p>
      </header>

      <div style={S.body}>
        <aside style={S.sidebar}>
          <ConfigPanel config={config} onChange={setConfig} />
          <div style={S.launchBox}>
            <Link to={expHref('auto')} style={S.launchPrimary}>
              LAUNCH EXPERIMENT →
            </Link>
            <button style={S.copyBtn} onClick={copyLink}>
              {copied ? '✓ LINK COPIED' : 'COPY SHAREABLE LINK'}
            </button>
          </div>
        </aside>

        <div style={S.row}>
          <figure style={S.figure}>
            <div style={S.capRow}>
              <figcaption style={S.cap}>DESKTOP</figcaption>
              <Link to={expHref('desktop')} style={S.launch}>
                OPEN FULLSCREEN ↗
              </Link>
            </div>
            <div style={S.desktopFrame}>
              <div style={S.chrome}>
                <span style={{ ...S.light, background: '#ff5f57' }} />
                <span style={{ ...S.light, background: '#febc2e' }} />
                <span style={{ ...S.light, background: '#28c840' }} />
                <div style={S.urlWrap}>
                  <div style={S.url}>coglog.mie.utoronto.ca/experiment</div>
                </div>
              </div>
              <div style={S.desktopStage}>
                <CogLog variant="desktop" {...config} />
              </div>
            </div>
          </figure>

          <figure style={S.figure}>
            <div style={S.capRow}>
              <figcaption style={S.cap}>MOBILE</figcaption>
              <Link to={expHref('mobile')} style={S.launch}>
                OPEN FULLSCREEN ↗
              </Link>
            </div>
            <div style={S.phoneFrame}>
              <div style={S.notch} />
              <div style={S.phoneStage}>
                <CogLog variant="mobile" {...config} />
              </div>
            </div>
          </figure>
        </div>
      </div>
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    padding: '40px 44px 56px',
    background: 'radial-gradient(120% 120% at 50% 0%, #2b2d33 0%, #202227 70%)',
    display: 'flex',
    flexDirection: 'column',
    gap: 34,
  },
  header: { display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 900 },
  brandRow: { display: 'flex', alignItems: 'baseline', gap: 14 },
  brand: {
    fontFamily: "'Baloo 2', sans-serif",
    fontWeight: 700,
    fontSize: 30,
    color: '#f4a400',
    letterSpacing: '-0.01em',
  },
  tag: { color: 'rgba(255,255,255,0.5)', fontSize: 12, letterSpacing: '0.14em' },
  blurb: {
    margin: 0,
    color: 'rgba(255,255,255,0.62)',
    fontSize: 12.5,
    lineHeight: 1.75,
    letterSpacing: '0.02em',
    maxWidth: 720,
  },
  strong: { color: 'rgba(255,255,255,0.85)', fontWeight: 700 },
  body: { display: 'flex', flexWrap: 'wrap', gap: 40, alignItems: 'flex-start', justifyContent: 'center' },
  sidebar: { display: 'flex', flexDirection: 'column', gap: 16, flex: '0 0 auto' },
  launchBox: { display: 'flex', flexDirection: 'column', gap: 8, width: 260 },
  launchPrimary: {
    textAlign: 'center',
    padding: '12px 14px',
    borderRadius: 10,
    background: '#f4a400',
    color: '#3a2b00',
    fontFamily: "'Space Mono', monospace",
    fontWeight: 700,
    fontSize: 12,
    letterSpacing: '0.08em',
    textDecoration: 'none',
  },
  copyBtn: {
    padding: '9px 14px',
    borderRadius: 9,
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.18)',
    color: 'rgba(255,255,255,0.6)',
    fontFamily: "'Space Mono', monospace",
    fontSize: 10.5,
    letterSpacing: '0.1em',
    cursor: 'pointer',
  },
  row: { display: 'flex', flexWrap: 'wrap', gap: 48, alignItems: 'flex-start', justifyContent: 'center', flex: 1 },
  figure: { margin: 0, display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' },
  capRow: { display: 'flex', alignItems: 'center', gap: 16 },
  cap: { color: 'rgba(255,255,255,0.4)', fontSize: 11, letterSpacing: '0.22em', margin: 0 },
  launch: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.18)',
    color: 'rgba(255,255,255,0.55)',
    fontFamily: "'Space Mono', monospace",
    fontSize: 9.5,
    letterSpacing: '0.14em',
    padding: '4px 9px',
    borderRadius: 7,
    cursor: 'pointer',
    textDecoration: 'none',
  },
  desktopFrame: {
    width: 1040,
    maxWidth: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    background: '#1b1c1e',
    boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  chrome: {
    height: 42,
    background: '#2a2b2e',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '0 16px',
    borderBottom: '1px solid rgba(0,0,0,0.35)',
  },
  light: { width: 12, height: 12, borderRadius: '50%' },
  urlWrap: { flex: 1, display: 'flex', justifyContent: 'center' },
  url: {
    background: '#1b1c1e',
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    letterSpacing: '0.04em',
    padding: '6px 20px',
    borderRadius: 8,
    minWidth: 340,
    textAlign: 'center',
  },
  desktopStage: { width: '100%', height: 640 },
  phoneFrame: {
    width: 360,
    padding: 12,
    background: '#0c0c0d',
    borderRadius: 46,
    boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
    border: '1px solid rgba(255,255,255,0.07)',
    position: 'relative',
  },
  notch: {
    position: 'absolute',
    top: 22,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 96,
    height: 22,
    background: '#000',
    borderRadius: 14,
    zIndex: 5,
  },
  phoneStage: { width: 336, height: 720, borderRadius: 36, overflow: 'hidden' },
};
