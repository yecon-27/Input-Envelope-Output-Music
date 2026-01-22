import json
import argparse
import numpy as np
import matplotlib.pyplot as plt

def hz_ticks(min_hz, max_hz, n=6):
    ks = np.linspace(min_hz, max_hz, n)
    labels = [f"{k/1000:.1f}" for k in ks]
    return ks/1000.0, labels

def load_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def to_array(data):
    return np.array(data, dtype=float)

def normalize_spec_matrix(spec_rows, num_mel=None):
    norm = []
    for row in spec_rows:
        if isinstance(row, dict):
            keys = sorted(row.keys(), key=lambda k: int(k))
            vals = [float(row[k]) for k in keys]
        else:
            vals = [float(x) for x in row]
        if num_mel is not None:
            if len(vals) > num_mel:
                vals = vals[:num_mel]
            elif len(vals) < num_mel:
                vals = vals + [np.nan] * (num_mel - len(vals))
        norm.append(vals)
    return np.array(norm, dtype=float)

def main():
    parser = argparse.ArgumentParser(description="Plot spectrogram comparison with Matplotlib")
    parser.add_argument("json_path", help="Path to spectrum_full_data.json")
    parser.add_argument("--png", default="spectrogram_comparison_mpl_300dpi.png", help="Output PNG filename")
    parser.add_argument("--pdf", default="spectrogram_comparison_mpl.pdf", help="Output PDF filename")
    parser.add_argument("--svg", default="spectrogram_comparison_mpl.svg", help="Output SVG filename")
    parser.add_argument("--dpi", type=int, default=300, help="DPI for PNG")
    args = parser.parse_args()

    data = load_json(args.json_path)
    env = data.get("envelopeBounds", {"loudnessMax": -14, "loudnessMin": -30})

    plt.rcParams['font.family'] = 'sans-serif'
    plt.rcParams['font.sans-serif'] = ['Helvetica', 'Arial', 'SimHei', 'DejaVu Sans']
    plt.rcParams['axes.unicode_minus'] = False
    plt.rcParams['axes.labelweight'] = 'medium'

    fig, axs = plt.subplots(2, 2, figsize=(12, 7.6),
                            gridspec_kw={'height_ratios': [0.6, 0.6], 'hspace': 0.18, 'wspace': 0.28})
    (ax_spec_a, ax_spec_b), (ax_loud_a, ax_loud_b) = axs
    # 紧凑裁边：尽量去掉大留白和“截图感”
    plt.subplots_adjust(left=0.10, right=0.98, top=0.94, bottom=0.10)
    fig.patch.set_facecolor('white')
    for ax in [ax_spec_a, ax_spec_b, ax_loud_a, ax_loud_b]:
        ax.set_facecolor('white')

    # Spectrograms
    # Spectrograms (robust to missing arrays)
    spec_a_data = data.get("unconstrained", {}).get("spectrogram", {}).get("data")
    spec_b_data = data.get("constrained", {}).get("spectrogram", {}).get("data")
    im = None
    if spec_a_data is not None and spec_b_data is not None:
        num_mel_a = data["unconstrained"]["spectrogram"].get("numMelBins", None)
        num_mel_b = data["constrained"]["spectrogram"].get("numMelBins", None)
        spec_a = normalize_spec_matrix(spec_a_data, num_mel_a)
        spec_b = normalize_spec_matrix(spec_b_data, num_mel_b)
        hop = float(data["unconstrained"]["spectrogram"].get("hopSize", 1024))
        sr = float(data["unconstrained"]["spectrogram"].get("sampleRate", 44100))
        num_frames_a = spec_a.shape[0]
        seconds_per_frame = hop / sr if sr > 0 else 0.1
        max_frames_10s = int(10 / seconds_per_frame) if seconds_per_frame > 0 else num_frames_a
        spec_a = spec_a[:min(num_frames_a, max_frames_10s), :]
        spec_b = spec_b[:min(spec_b.shape[0], max_frames_10s), :]
        lower_frac = 0.40
        bins_a = max(1, int(spec_a.shape[1] * lower_frac))
        bins_b = max(1, int(spec_b.shape[1] * lower_frac))
        spec_a_low = spec_a[:, :bins_a]
        spec_b_low = spec_b[:, :bins_b]
        im = ax_spec_a.imshow(spec_a_low.T, aspect='auto', extent=[0, 10, 0, bins_a], origin='lower', cmap='viridis')
        ax_spec_b.imshow(spec_b_low.T, aspect='auto', extent=[0, 10, 0, bins_b], origin='lower', cmap='viridis')
        ax_spec_a.set_ylabel('Frequency (kHz)', labelpad=18, fontsize=14)
        ax_spec_a.yaxis.set_label_coords(-0.12, 0.5)
        ax_spec_a.set_xticks(np.linspace(0, 10, 11))
        ax_spec_b.set_xticks(np.linspace(0, 10, 11))
        ax_spec_a.set_yticks(np.linspace(0, bins_a, 6))
        ax_spec_b.set_yticks(np.linspace(0, bins_b, 6))
        ax_spec_a.set_yticklabels(['0','1','2','3','4','5'])
        ax_spec_b.set_yticklabels(['0','1','2','3','4','5'])
        ax_spec_a.tick_params(axis='y', length=5)
        ax_spec_b.tick_params(axis='y', length=5)
        sp_pos = ax_spec_b.get_position()
        cbar_ax = fig.add_axes([sp_pos.x1 + 0.02, sp_pos.y0, 0.012, sp_pos.height])
        cb = fig.colorbar(im, cax=cbar_ax)
        cb.set_label('Magnitude (dB)', weight='medium')
        cbar_ax.tick_params(labelsize=10, width=1.0)
        print("INFO: Spectrogram arrays loaded and plotted.")
    else:
        # Placeholders if spectrogram arrays are missing
        ax_spec_a.text(0.5, 0.5, 'No Spectrogram Data', ha='center', va='center', fontsize=10)
        ax_spec_b.text(0.5, 0.5, 'No Spectrogram Data', ha='center', va='center', fontsize=10)
        ax_spec_a.set_ylabel('Frequency (kHz)', labelpad=15)
        ax_spec_a.set_xticks(np.linspace(0, 10, 11))
        ax_spec_b.set_xticks(np.linspace(0, 10, 11))
        ax_spec_a.set_yticks([])
        ax_spec_b.set_yticks([])
        print("WARNING: JSON missing spectrogram arrays under unconstrained/constrained.spectrogram.data")

    # Loudness curves
    # Loudness curves (robust to missing arrays)
    loud_a_vals = data.get("unconstrained", {}).get("loudness", {}).get("values")
    time_a_vals = data.get("unconstrained", {}).get("loudness", {}).get("times")
    loud_b_vals = data.get("constrained", {}).get("loudness", {}).get("values")
    time_b_vals = data.get("constrained", {}).get("loudness", {}).get("times")
    if loud_a_vals is not None and time_a_vals is not None:
        loud_a = to_array(loud_a_vals)
        time_a = to_array(time_a_vals)
        mask_a = time_a <= 10
        ax_loud_a.plot(time_a[mask_a], loud_a[mask_a], color='#111111', linewidth=2)
    else:
        ax_loud_a.text(0.5, 0.5, 'No Loudness Data', ha='center', va='center', fontsize=10)
        print("WARNING: JSON missing unconstrained.loudness.values/times")
    if loud_b_vals is not None and time_b_vals is not None:
        loud_b = to_array(loud_b_vals)
        time_b = to_array(time_b_vals)
        mask_b = time_b <= 10
        ax_loud_b.plot(time_b[mask_b], loud_b[mask_b], color='#111111', linewidth=2)
    else:
        ax_loud_b.text(0.5, 0.5, 'No Loudness Data', ha='center', va='center', fontsize=10)
        print("WARNING: JSON missing constrained.loudness.values/times")
    ax_loud_a.set_ylabel('Loudness (LUFS)', labelpad=14, fontsize=13)
    ax_loud_a.yaxis.set_label_coords(-0.12, 0.5)
    # 共享 X 轴标题：放在页脚统一显示
    ax_loud_a.set_xlim(0, 10)
    ax_loud_b.set_xlim(0, 10)
    ax_loud_a.set_ylim(-30, -10)
    ax_loud_b.set_ylim(-30, -10)
    ax_loud_a.set_yticks([-30, -20, -10])
    ax_loud_b.set_yticks([-30, -20, -10])
    # No signal-layer clamp lines

    # Footer metrics
    raw_bpm = data.get("unconstrained", {}).get("bpm") or data.get("unconstrained", {}).get("rawParams", {}).get("rawBpm")
    raw_contrast = data.get("unconstrained", {}).get("contrast")
    if raw_contrast is None:
        raw_contrast = data.get("unconstrained", {}).get("rawParams", {}).get("rawContrast")
    safe_bpm = data.get("constrained", {}).get("bpm")
    safe_contrast = data.get("constrained", {}).get("contrast")
    if safe_contrast is None:
        clamp_log = data.get("constrained", {}).get("clampLog", [])
        for c in clamp_log:
            if c.get("param") == "contrast":
                safe_contrast = c.get("clamped")
                break
    lra_raw = data.get("unconstrained", {}).get("lra")
    lra_safe = data.get("constrained", {}).get("lra")
    for ax in [ax_spec_a, ax_spec_b, ax_loud_a, ax_loud_b]:
        ax.tick_params(labelsize=11, width=1.2)
        for spine in ax.spines.values():
            spine.set_linewidth(1.2)
    # 子图编号放在图外（左上角外侧）
    pos_spec_a = ax_spec_a.get_position()
    pos_spec_b = ax_spec_b.get_position()
    pos_loud_a = ax_loud_a.get_position()
    pos_loud_b = ax_loud_b.get_position()
    fig.text(pos_spec_a.x0 - 0.03, pos_spec_a.y1 + 0.015, '(a)', ha='left', va='bottom', fontsize=13, fontweight='bold')
    fig.text(pos_spec_b.x0 - 0.03, pos_spec_b.y1 + 0.015, '(b)', ha='left', va='bottom', fontsize=13, fontweight='bold')
    fig.text(pos_loud_a.x0 - 0.03, pos_loud_a.y1 + 0.015, '(c)', ha='left', va='bottom', fontsize=13, fontweight='bold')
    fig.text(pos_loud_b.x0 - 0.03, pos_loud_b.y1 + 0.015, '(d)', ha='left', va='bottom', fontsize=13, fontweight='bold')
    # 共享 X 轴标题
    fig.text(0.54, 0.06, 'Time (s)', ha='center', va='center', fontsize=13)
    # 列标题
    pos_a = ax_spec_a.get_position()
    pos_b = ax_spec_b.get_position()
    fig.text(pos_a.x0 + pos_a.width / 2, pos_a.y1 + 0.02, 'Baseline', ha='center', va='bottom', fontsize=13, fontweight='medium')
    fig.text(pos_b.x0 + pos_b.width / 2, pos_b.y1 + 0.02, 'Constrained', ha='center', va='bottom', fontsize=13, fontweight='medium')

    fig.savefig(args.png, dpi=args.dpi, bbox_inches='tight', facecolor='white')
    fig.savefig(args.pdf, bbox_inches='tight', facecolor='white')
    fig.savefig(args.svg, bbox_inches='tight', facecolor='white')
    print(f"Saved PNG ({args.dpi} DPI): {args.png}")
    print(f"Saved PDF (vector): {args.pdf}")
    print(f"Saved SVG (vector): {args.svg}")

if __name__ == "__main__":
    main()
