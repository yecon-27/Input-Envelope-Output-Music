# Supplementary Materials

## Directory Structure

```
supplementary/
├── figures/          # Vector figures (SVG)
│   ├── hexad_default_main.svg      # Main figure (Default config)
│   ├── hexad_tight_main.svg        # Tight config
│   ├── hexad_relaxed_main.svg      # Relaxed config
│   ├── hexad_default.svg           # With statistics (supplement)
│   ├── hexad_tight.svg
│   └── hexad_relaxed.svg
├── data/             # Experimental data
│   ├── summary_runs.csv            # Raw experiment results (N=3300)
│   ├── paired_summary.csv          # Paired analysis (Default)
│   ├── paired_summary_tight.csv    # Paired analysis (Tight)
│   ├── paired_summary_relaxed.csv  # Paired analysis (Relaxed)
│   └── l2_enforcement_summary_*.csv # Clamp rate summaries
├── configs/          # Experiment configurations
│   ├── conditions.yaml             # Condition definitions
│   ├── default.json                # Default envelope bounds
│   ├── tight.json                  # Tight envelope bounds
│   └── relaxed.json                # Relaxed envelope bounds
└── scripts/          # Reproduction scripts
    ├── compose_hexad_kde.py        # Figure generation
    └── summarize_runs.py           # Data summarization
```

## Envelope Configurations

| Parameter    | Relaxed     | Default       | Tight         |
|--------------|-------------|---------------|---------------|
| Tempo (BPM)  | 60–180      | 120–130       | 124–126       |
| Gain (dB)    | −60–0       | −10.5––1.9    | −6.9––5.2     |
| Accent ratio | 0.0–1.0     | 0.0–0.5       | 0.0–0.1       |

## Clamp Rates Summary

| Config   | Tempo  | Gain   | Accent | Any    |
|----------|--------|--------|--------|--------|
| Default  | 91.5%  | 18.0%  | 85.6%  | 98.9%  |
| Tight    | 97.1%  | 70.5%  | 90.9%  | —      |
| Relaxed  | 0.0%   | 8.9%   | 0.0%   | —      |

## Reproduction

```bash
# Generate figures
python scripts/compose_hexad_kde.py --condition constrained_default --out figures/hexad_default.svg
python scripts/compose_hexad_kde.py --condition constrained_default --out figures/hexad_default_main.svg --style main
```
