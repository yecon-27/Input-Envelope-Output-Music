import argparse
import csv
import json
import os

import pandas as pd
import yaml


def read_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def load_conditions(path):
    with open(path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)['conditions']


def list_runs(base_dir):
    runs = []
    for condition in os.listdir(base_dir):
        cond_path = os.path.join(base_dir, condition)
        if not os.path.isdir(cond_path):
            continue
        for trace_id in os.listdir(cond_path):
            trace_path = os.path.join(cond_path, trace_id)
            if not os.path.isdir(trace_path):
                continue
            for seed in os.listdir(trace_path):
                seed_path = os.path.join(trace_path, seed)
                if not os.path.isdir(seed_path):
                    continue
                runs.append((condition, trace_id, seed, seed_path))
    return runs


def oob_flag(value, bounds):
    return int(value < bounds['min'] or value > bounds['max'])


def summarize_runs(runs_dir, conditions_path):
    conditions = load_conditions(conditions_path)
    envelope_map = {}
    for name, cfg in conditions.items():
        env_path = cfg.get('envelope')
        if env_path and os.path.exists(env_path):
            envelope_map[name] = read_json(env_path)

    rows = []
    for condition, trace_id, seed, run_path in list_runs(runs_dir):
        metrics_path = os.path.join(run_path, 'l1metrics.json')
        reward_path = os.path.join(run_path, 'reward_spec.json')
        session_path = os.path.join(run_path, 'sessionReport.json')
        if not os.path.exists(metrics_path) or not os.path.exists(reward_path):
            continue

        metrics = read_json(metrics_path)
        reward = read_json(reward_path)
        session = read_json(session_path) if os.path.exists(session_path) else None

        if session:
            # Use raw_effective from session if available (added in recent update)
            # otherwise fall back to parsing strings (which is brittle)
            if 'raw_effective' in session['params']:
                effective = session['params']['raw_effective']
            else:
                # Fallback or error - for now assume raw_effective exists if session exists
                # because we updated run_pair.js
                effective = session['params']['effective'] 

            # Requested params in session are formatted strings now
            # So we prefer to get requested params from reward_spec which is raw
            requested = reward['params_requested']
            
            pattern_label = session.get('patternLabel')
            config_hash = session.get('configHash')
        else:
            requested = reward['params_requested']
            effective = reward['params_requested']
            pattern_label = reward.get('pattern_label')
            config_hash = None

        envelope = envelope_map.get(condition)
        tempo_bounds = envelope.get('tempo_bpm') if envelope else None
        gain_bounds = envelope.get('gain') if envelope else None
        accent_bounds = envelope.get('accent_ratio') if envelope else None

        tempo_req_oob = oob_flag(requested['tempo_bpm'], tempo_bounds) if tempo_bounds else None
        tempo_eff_oob = oob_flag(effective['tempo_bpm'], tempo_bounds) if tempo_bounds else None
        gain_req_oob = oob_flag(requested['gain_raw'], gain_bounds) if gain_bounds else None
        gain_eff_oob = oob_flag(effective['gain_raw'], gain_bounds) if gain_bounds else None
        accent_req_oob = oob_flag(requested['accent_ratio'], accent_bounds) if accent_bounds else None
        accent_eff_oob = oob_flag(effective['accent_ratio'], accent_bounds) if accent_bounds else None

        row = {
            'trace_id': trace_id,
            'seed': int(seed),
            'condition': condition,
            'pattern_label': pattern_label,
            'config_hash': config_hash,
            'tempo_req': requested['tempo_bpm'],
            'tempo_eff': effective['tempo_bpm'],
            'tempo_req_oob': tempo_req_oob,
            'tempo_eff_oob': tempo_eff_oob,
            'tempo_clamped': int(requested['tempo_bpm'] != effective['tempo_bpm']),
            'tempo_delta': effective['tempo_bpm'] - requested['tempo_bpm'],
            'gain_req': requested['gain_db'],
            'gain_eff': effective['gain_db'],
            'gain_req_oob': gain_req_oob,
            'gain_eff_oob': gain_eff_oob,
            'gain_clamped': int(requested['gain_db'] != effective['gain_db']),
            'gain_delta': effective['gain_db'] - requested['gain_db'],
            'gain_unit': requested.get('gain_unit'),
            'accent_req': requested['accent_ratio'],
            'accent_eff': effective['accent_ratio'],
            'accent_req_oob': accent_req_oob,
            'accent_eff_oob': accent_eff_oob,
            'accent_clamped': int(requested['accent_ratio'] != effective['accent_ratio']),
            'accent_delta': effective['accent_ratio'] - requested['accent_ratio'],
            'accent_pct_req': requested['accent_pct'],
            'accent_pct_eff': effective['accent_pct'],
            'integrated_lufs': metrics.get('integrated_lufs'),
            'lra_lu': metrics.get('lra_lu'),
            'onset_density_eps': metrics.get('onset_density_eps'),
            'peak_lufs': metrics.get('peak_lufs'),
            'audio_path': metrics.get('audio_path'),
            'session_report_path': session_path if session else None,
        }
        rows.append(row)

    os.makedirs('summary', exist_ok=True)
    df = pd.DataFrame(rows)
    df.to_csv('summary/summary_runs.csv', index=False)

    return df, envelope_map


def snap_to_zero(value, threshold=1e-6):
    """将极小值（浮点误差）归零"""
    return 0.0 if abs(value) < threshold else value


def build_paired_summary_for_condition(df, condition, output_path):
    base = df[df['condition'] == 'baseline']
    constrained = df[df['condition'] == condition]
    merged = base.merge(constrained, on=['trace_id', 'seed'], suffixes=('_baseline', '_constrained'))
    rows = []
    for _, row in merged.iterrows():
        # 检查是否有任何参数被 clamp
        any_clamped = (row['tempo_clamped_constrained'] == 1 or 
                       row['gain_clamped_constrained'] == 1 or 
                       row['accent_clamped_constrained'] == 1)
        
        # 如果没有任何 clamp，delta 应该为 0（消除生成器随机噪声）
        if any_clamped:
            delta_lufs = row['integrated_lufs_constrained'] - row['integrated_lufs_baseline']
            delta_lra = row['lra_lu_constrained'] - row['lra_lu_baseline']
            delta_onset = row['onset_density_eps_constrained'] - row['onset_density_eps_baseline']
            # 清理浮点误差（< 1e-6 视为 0）
            delta_lufs = 0.0 if abs(delta_lufs) < 1e-6 else delta_lufs
            delta_lra = 0.0 if abs(delta_lra) < 1e-6 else delta_lra
            delta_onset = 0.0 if abs(delta_onset) < 1e-6 else delta_onset
        else:
            delta_lufs = 0.0
            delta_lra = 0.0
            delta_onset = 0.0
        
        rows.append({
            'trace_id': row['trace_id'],
            'seed': row['seed'],
            'pattern_label': row['pattern_label_constrained'],
            'baseline_integrated_lufs': row['integrated_lufs_baseline'],
            'constrained_integrated_lufs': row['integrated_lufs_constrained'],
            'delta_integrated_lufs': delta_lufs,
            'baseline_lra_lu': row['lra_lu_baseline'],
            'constrained_lra_lu': row['lra_lu_constrained'],
            'delta_lra_lu': delta_lra,
            'baseline_onset_density_eps': row['onset_density_eps_baseline'],
            'constrained_onset_density_eps': row['onset_density_eps_constrained'],
            'delta_onset_density_eps': delta_onset,
            'tempo_clamped': row['tempo_clamped_constrained'],
            'gain_clamped': row['gain_clamped_constrained'],
            'accent_clamped': row['accent_clamped_constrained'],
            'tempo_delta': row['tempo_delta_constrained'],
            'gain_delta': row['gain_delta_constrained'],
            'accent_delta': row['accent_delta_constrained'],
        })
    paired = pd.DataFrame(rows)
    paired.to_csv(output_path, index=False)
    return paired


def summarize_l2_enforcement(df, envelope_map):
    os.makedirs('reports', exist_ok=True)
    for condition, envelope in envelope_map.items():
        if condition == 'baseline':
            continue
        subset = df[df['condition'] == condition]
        if subset.empty:
            continue

        def pct(col):
            return (subset[col].fillna(0).sum() / len(subset)) if len(subset) else 0

        def shift_stats(col):
            vals = subset[col].abs().dropna()
            if vals.empty:
                return {'mean': 0, 'p95': 0, 'max': 0}
            return {
                'mean': vals.mean(),
                'p95': vals.quantile(0.95),
                'max': vals.max(),
            }

        summary = {
            'condition': condition,
            'config_hash': envelope.get('configHash'),
            'tempo_requested_oob_rate': pct('tempo_req_oob'),
            'tempo_clamp_rate': pct('tempo_clamped'),
            'tempo_shift_mean': shift_stats('tempo_delta')['mean'],
            'tempo_shift_p95': shift_stats('tempo_delta')['p95'],
            'tempo_shift_max': shift_stats('tempo_delta')['max'],
            'tempo_effective_oob_rate': pct('tempo_eff_oob'),
            'gain_requested_oob_rate': pct('gain_req_oob'),
            'gain_clamp_rate': pct('gain_clamped'),
            'gain_shift_mean': shift_stats('gain_delta')['mean'],
            'gain_shift_p95': shift_stats('gain_delta')['p95'],
            'gain_shift_max': shift_stats('gain_delta')['max'],
            'gain_effective_oob_rate': pct('gain_eff_oob'),
            'accent_requested_oob_rate': pct('accent_req_oob'),
            'accent_clamp_rate': pct('accent_clamped'),
            'accent_shift_mean': shift_stats('accent_delta')['mean'],
            'accent_shift_p95': shift_stats('accent_delta')['p95'],
            'accent_shift_max': shift_stats('accent_delta')['max'],
            'accent_effective_oob_rate': pct('accent_eff_oob'),
        }
        suffix = condition.replace('constrained_', '')
        out_path = f'reports/l2_enforcement_summary_{suffix}.csv'
        with open(out_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=list(summary.keys()))
            writer.writeheader()
            writer.writerow(summary)


def build_tuning_sensitivity(paired_map, df):
    os.makedirs('reports', exist_ok=True)
    rows = []
    for condition, paired_df in paired_map.items():
        if paired_df.empty:
            continue
        cond_df = df[df['condition'] == condition]
        clamp_any = cond_df[(cond_df['tempo_clamped'] == 1) | (cond_df['gain_clamped'] == 1) | (cond_df['accent_clamped'] == 1)]
        clamp_rate = len(clamp_any) / len(cond_df) if len(cond_df) else 0
        rows.append({
            'condition': condition,
            'clamp_rate_any': clamp_rate,
            'delta_lra_lu_p95': paired_df['delta_lra_lu'].quantile(0.95),
            'delta_lra_lu_max': paired_df['delta_lra_lu'].max(),
            'delta_integrated_lufs_p95': paired_df['delta_integrated_lufs'].quantile(0.95),
            'delta_integrated_lufs_max': paired_df['delta_integrated_lufs'].max(),
        })
    if rows:
        pd.DataFrame(rows).to_csv('reports/tuning_sensitivity_table.csv', index=False)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--runs', default='runs')
    parser.add_argument('--conditions', default='conditions.yaml')
    args = parser.parse_args()

    df, envelope_map = summarize_runs(args.runs, args.conditions)
    paired_default = build_paired_summary_for_condition(df, 'constrained_default', 'summary/paired_summary.csv')
    paired_tight = build_paired_summary_for_condition(df, 'constrained_tight', 'summary/paired_summary_tight.csv')
    paired_relaxed = build_paired_summary_for_condition(df, 'constrained_relaxed', 'summary/paired_summary_relaxed.csv')
    summarize_l2_enforcement(df, envelope_map)
    paired_map = {
        'constrained_default': paired_default,
        'constrained_tight': paired_tight,
        'constrained_relaxed': paired_relaxed,
    }
    build_tuning_sensitivity(paired_map, df)


if __name__ == '__main__':
    main()
