# CogLog 2.1 — Visual Search Task

A React + TypeScript port of the CogLog attentional-tunneling research task, built from
the Claude Design handoff in [`coglog-app-planning/`](coglog-app-planning/). The participant
pans/zooms a color-gradient world to find a hidden **Gabor patch**, clicks it, and classifies
its orientation; a wrong answer triggers a timed penalty. Trials run in blocks.

Research context: *Detection of Attentional Tunneling Using Passive Adaptive Triggers*
(Amanda Leiva, MASc, University of Toronto, 2025).

## Run

```bash
npm install
npm run dev
```

Then open the printed local URL. `npm run build` type-checks and produces a production bundle
in `dist/`; `npm run preview` serves it.

## Routes

- `/` — showcase page reproducing the design (desktop + mobile frames), with a live **config
  panel** (difficulty, target placement, trials, penalty, HUD) that drives the previews.
- `/experiment` — the task fullscreen, for serving to a participant. Configuration is read from
  the URL query string, so a researcher can share a pre-configured link:
  `/experiment?difficulty=Hard&trials=20&penaltySeconds=10&condition=Tunnel&variant=desktop`.
  Omitted params fall back to defaults; `variant` may be `desktop`, `mobile`, or omitted (auto).
  The panel's **Copy shareable link** button generates this URL. Because routing uses the HTML5
  history API, a static host must be configured to fall back to `index.html` for deep links
  (Vite's dev server and `npm run preview` already do this).

## Structure

- `src/coglog/engine.ts` — the imperative canvas engine (pan/zoom, Gabor rendering, minimap,
  trial + penalty flow). Ported verbatim from the design so output is pixel-identical.
- `src/coglog/CogLog.tsx` — React wrapper. Owns the engine's mount/update/teardown lifecycle
  and maps the `difficulty` prop to Gabor contrast + target size.
- `src/coglog/config.ts` — task-config type, defaults, and URL query serialize/parse.
- `src/coglog/ConfigPanel.tsx` — the control panel used on the showcase page.
- `src/routes/Showcase.tsx`, `src/routes/Experiment.tsx` — the two routes above.
- `src/App.tsx` — route table.

## `<CogLog />` props

| prop             | type                         | default  | notes                                            |
| ---------------- | ---------------------------- | -------- | ------------------------------------------------ |
| `variant`        | `'desktop' \| 'mobile'`      | desktop  | Layout (also auto-switches to mobile below 560px)|
| `difficulty`     | `'Easy' \| 'Medium' \| 'Hard'`| `Hard`  | contrast + target size                           |
| `condition`      | `'Random' \| 'Tunnel'`       | `Random` | Tunnel confines priming trials to a quadrant     |
| `trials`         | `number`                     | `15`     | trials per block                                 |
| `penaltySeconds` | `number`                     | `15`     | wrong-answer penalty countdown                   |
| `showHud`        | `boolean`                    | `true`   | trial / timer / view-% HUD                        |

## Scope

This is the **task UI only** — no research data capture (per-trial reaction times, pan/zoom
traces, viewport logging). Those hooks can be added around the engine's trial callbacks later.
