# MusiBubbles: A Safety-Envelope Framework for Auditory Rewards in Sensory-Sensitive Contexts

MusiBubbles is an auditable music reward prototype designed for sensory-sensitive scenarios (e.g., ASD). It employs an Input–Envelope–Output (I–E–O) constraint-first framework that interposes a low-risk safety envelope between input and output, enforcing deterministic bounds on critical parameters while logging all interventions for audit and reproducibility.

## Design Principles

- **Predictability First**: Output variations are bounded by declared constraints; identical inputs yield stable results.
- **Pattern-Level Mapping**: Rewards correlate with behavioral patterns (rhythm density, sequentiality) rather than per-hit sonification that amplifies noise.
- **Low-Risk Envelope**: Overload dimensions (BPM, gain, contrast) are bounded and all interventions are audited.
- **Auditable & Configurable**: Conservative defaults with expert-mode adjustments within bounds; all requested and effective values are logged.

## System Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Input     │────▶│  Safety Envelope │────▶│   Output    │
│  (Actions)  │     │  (Constraints)   │     │  (Rewards)  │
└─────────────┘     └──────────────────┘     └─────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  Audit Log   │
                    └──────────────┘
```

## Features

- **Expert Debug Drawer**: Toggle via `Ctrl+Shift+E`; provides parameter preview and override controls.
- **Envelope Mapping**: `tempo → rewardBpm`, `volume → gain level`, `density → bubble/rhythm density`.
- **Preview & Override**: Expert mode allows parameter adjustment (BPM, dynamic contrast, segment range, volume level) within safety bounds.
- **Generator Branch Control**: Priority order: `expertOverride > expertMode > default derivation`.
- **Result View**: Behavior analysis, click trail visualization, spectrogram comparison, and export functionality.
- **Audit Dashboard**: Session metadata, constraint execution logs, and replay entry points.

## Quick Start

```bash
# Install dependencies
npm ci

# Development server
npx serve src/frontend -l 3000

# Build for deployment
node scripts/build-vercel.js
```

Build output is placed in `public/`.

## Deployment

### Vercel

Configuration in `vercel.json`:
- `installCommand`: `npm ci`
- `buildCommand`: `node scripts/build-vercel.js`
- `outputDirectory`: `public`

### Local Network / iPad Access

See scripts:
- `scripts/start_for_ipad.py`
- `scripts/start_https_server.py`

## Project Structure

```
.
├── src/
│   └── frontend/
│       ├── index.html
│       ├── css/
│       └── js/
│           ├── game-engine.js
│           ├── game-integration.js
│           ├── game-result-manager.js
│           ├── expert-drawer.js
│           ├── music-param-controller.js
│           ├── advanced-music-generator.js
│           ├── safety-envelope.js
│           └── spectrogram-comparison.js
├── public/              # Build output
├── envelope-diagnostic/ # Envelope diagnostic & analysis tools
├── scripts/
│   └── build-vercel.js
└── vercel.json
```

## Envelope Diagnostic

The `envelope-diagnostic/` directory contains diagnostic and analysis tools for the safety envelope, used to verify and visualize constraint effects under different envelope configurations.

### Directory Structure

| Directory | Description |
|-----------|-------------|
| `configs/` | Experiment condition configs (baseline, default, tight, relaxed, ultra_tight) |
| `data/` | Experiment data and statistical summaries (paired analysis, clamp rate) |
| `figures/` | Generated visualizations (SVG format) |
| `scripts/` | Data processing and chart generation scripts |

### Envelope Configuration Comparison

| Parameter | Relaxed | Default | Tight |
|-----------|---------|---------|-------|
| Tempo (BPM) | 60–180 | 120–130 | 124–126 |
| Gain (dB) | −60–0 | −10.5–−1.9 | −6.9–−5.2 |
| Accent ratio | 0.0–1.0 | 0.0–0.5 | 0.0–0.1 | 
### Usage

```bash
python envelope-diagnostic/scripts/compose_hexad_kde.py --condition constrained_default --out figures/hexad_default.svg

python envelope-diagnostic/scripts/summarize_runs.py
```

## Usage

1. **Configure Safety Bounds**: Adjust parameters in the drawer or result view; out-of-bound values are clamped and logged.
2. **Preview & Export**: Result view provides spectrogram comparison and JSON export for baseline vs. constrained output.
3. **Audit & Reproduce**: Requested values, effective values, and constraint counts are available in session reports.

## License

MIT License
