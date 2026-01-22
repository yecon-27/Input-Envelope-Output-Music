"""
Hexad Plot Composer with KDE (六联图 - KDE 版本)

Generates a 2x3 hexad plot combining:
- Row 1 (L2 参数层): Tempo, Gain, Accent Ratio
- Row 2 (L1 信号层): ΔOnset Density, ΔLUFS, ΔLRA (KDE 密度曲线)
"""

import argparse
import os
import sys

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy import stats

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from scripts.utils.envelope_loader import load_envelope, get_tempo_bounds, get_gain_bounds_db


def get_accent_bounds(envelope: dict):
    """获取 accent ratio 边界"""
    if 'accent_ratio' not in envelope:
        raise KeyError("'accent_ratio' key not found in envelope")
    return (envelope['accent_ratio']['min'], envelope['accent_ratio']['max'])


def plot_l2_panel(ax, x, y, title, xlabel, ylabel, is_clamped=None, show_clamp_rate=True,
                  clamp_bounds=None, style='supplement'):
    """绘制 L2 曲棍图面板
    
    Args:
        ax: matplotlib axes
        x: baseline values
        y: constrained values
        title: panel title
        xlabel: x-axis label
        ylabel: y-axis label
        is_clamped: boolean array indicating which points are clamped (from paired_summary)
        show_clamp_rate: whether to show clamp rate annotation
        clamp_bounds: tuple (min, max) for clamp boundary lines, or None to skip
        style: 'main' (精简) or 'supplement' (完整)
    """
    # 学术配色方案
    COLOR_INBOUNDS = '#9CB0C3'   # 蓝灰色 - 未被 clamp 的点
    COLOR_REFLINE = 'black'      # 黑色 - y=x 参考线
    COLOR_BOUND_MAX = '#7C9D97'  # 青绿色 - 上界 & 被 clamp 到上界的点
    COLOR_BOUND_MIN = '#EAB080'  # 橙色 - 下界 & 被 clamp 到下界的点
    
    if is_clamped is None:
        is_clamped = np.zeros(len(x), dtype=bool)
    
    n_total = len(x)
    
    data_min = min(x.min(), y.min())
    data_max = max(x.max(), y.max())
    margin = (data_max - data_min) * 0.1 if (data_max - data_min) > 0 else 1.0
    line_range = [data_min - margin, data_max + margin]
    
    # 区分 clamp 到上界和下界的点
    if clamp_bounds is not None:
        bound_min, bound_max = clamp_bounds
        tolerance = 0.01
        clamped_to_max = is_clamped & (y >= bound_max - tolerance)
        clamped_to_min = is_clamped & (y <= bound_min + tolerance)
    else:
        clamped_to_max = np.zeros(len(x), dtype=bool)
        clamped_to_min = np.zeros(len(x), dtype=bool)
    
    n_clamped = is_clamped.sum()
    n_clamped_max = clamped_to_max.sum()
    n_clamped_min = clamped_to_min.sum()
    clamp_rate = n_clamped / n_total if n_total > 0 else 0.0
    
    # 绘制散点 - 分三类，始终显示所有类别的 legend
    # main 风格：不显示计数；supplement 风格：显示计数
    ax.scatter(x[~is_clamped], y[~is_clamped], s=18, alpha=0.7, color=COLOR_INBOUNDS, label='In-bounds', zorder=2)
    
    # Clamped↑ - 始终添加到 legend（即使没有数据点）
    label_max = 'Clamped↑' if style == 'main' else f'Clamped↑ ({n_clamped_max})'
    if n_clamped_max > 0:
        ax.scatter(x[clamped_to_max], y[clamped_to_max], s=18, alpha=0.7, color=COLOR_BOUND_MAX, label=label_max, zorder=2)
    else:
        ax.scatter([], [], s=18, alpha=0.7, color=COLOR_BOUND_MAX, label=label_max)  # 空散点用于 legend
    
    # Clamped↓ - 始终添加到 legend（即使没有数据点）
    label_min = 'Clamped↓' if style == 'main' else f'Clamped↓ ({n_clamped_min})'
    if n_clamped_min > 0:
        ax.scatter(x[clamped_to_min], y[clamped_to_min], s=18, alpha=0.7, color=COLOR_BOUND_MIN, label=label_min, zorder=2)
    else:
        ax.scatter([], [], s=18, alpha=0.7, color=COLOR_BOUND_MIN, label=label_min)  # 空散点用于 legend
    
    # 绘制 y=x 参考线（黑色虚线）- 线宽降低，作为参考线不应比数据更抢眼
    ax.plot(line_range, line_range, '--', color=COLOR_REFLINE, linewidth=1.0, zorder=3)
    
    # 绘制 clamp 边界线（如果提供）- 上界绿色，下界橙色，线宽降低、透明度提高
    if clamp_bounds is not None:
        ax.axhline(y=bound_min, color=COLOR_BOUND_MIN, linestyle=':', linewidth=1.5, alpha=0.7, zorder=4)
        ax.axhline(y=bound_max, color=COLOR_BOUND_MAX, linestyle=':', linewidth=1.5, alpha=0.7, zorder=4)
    
    # 设置坐标轴范围确保虚线可见
    ax.set_xlim(line_range)
    ax.set_ylim(line_range)
    
    # Clamp rate 标注 - 仅 supplement 风格显示（main 风格移到 caption）
    if show_clamp_rate and style == 'supplement':
        textstr = f'Clamp: {clamp_rate:.1%}\n(n={n_clamped}/{n_total})'
        props = dict(boxstyle='round', facecolor='wheat', alpha=0.95, zorder=10)
        ax.text(0.97, 0.03, textstr, transform=ax.transAxes, fontsize=8,
                verticalalignment='bottom', horizontalalignment='right', bbox=props, zorder=10)
    
    ax.set_title(title, fontsize=10)
    ax.set_xlabel(xlabel, fontsize=9)
    ax.set_ylabel(ylabel, fontsize=9)
    ax.legend(loc='upper left', fontsize=9)
    ax.tick_params(labelsize=8)
    ax.grid(alpha=0.2)
    
    return {'clamp_rate': clamp_rate, 'n_clamped': n_clamped, 'n_total': n_total}


def plot_l1_histogram(
    data: pd.Series,
    ax: plt.Axes,
    title: str,
    xlabel: str,
    show_stats: bool = True,
    zero_line: bool = True,
    bin_width: float = None,  # bin 宽度，None 则自动计算
    bin_center_at_zero: bool = True,  # 是否让 0 在 bin 中心
    xlim: tuple = None,  # 固定 x 轴范围 (min, max)
    show_ylabel: bool = True,  # 是否显示 y 轴标签
    style: str = 'supplement'  # 'main' or 'supplement'
) -> dict:
    """
    绘制 L1 Δ 直方图
    """
    COLOR_HIST = '#D6D6D6'  # 灰色
    
    clean_data = data.dropna()
    n = len(clean_data)
    
    if n < 2:
        ax.set_title(title)
        ax.set_xlabel(xlabel)
        if show_ylabel:
            ax.set_ylabel('Count')
        if xlim:
            ax.set_xlim(xlim)
        return {'n': n, 'median': 0, 'mean': 0, 'iqr': 0}
    
    # 计算统计量
    median = clean_data.median()
    mean = clean_data.mean()
    q1 = clean_data.quantile(0.25)
    q3 = clean_data.quantile(0.75)
    iqr = q3 - q1
    
    # 使用固定范围或数据范围
    if xlim:
        range_min, range_max = xlim
    else:
        range_min, range_max = clean_data.min(), clean_data.max()
    
    if bin_width is None:
        # 自动计算合理的 bin 宽度（约 30 个 bin）
        bin_width = (range_max - range_min) / 30
        # 取整到合理的数值（0.1, 0.25, 0.5, 1, 2, 5 等）
        nice_widths = [0.05, 0.1, 0.2, 0.25, 0.5, 1.0, 2.0, 5.0]
        bin_width = min(nice_widths, key=lambda x: abs(x - bin_width))
    
    if bin_center_at_zero:
        # 让 0 在某个 bin 的中心
        half_width = bin_width / 2
        bin_min = (int((range_min - half_width) / bin_width) - 1) * bin_width + half_width
        bin_max = (int((range_max + half_width) / bin_width) + 1) * bin_width + half_width
        bins = np.arange(bin_min, bin_max + bin_width, bin_width)
    else:
        bins = np.arange(range_min, range_max + bin_width, bin_width)
    
    # 绘制直方图
    ax.hist(clean_data, bins=bins, color=COLOR_HIST, alpha=0.8, edgecolor='white', linewidth=0.5)
    
    # 绘制 x=0 竖线
    if zero_line:
        ax.axvline(x=0, color='black', linestyle='--', linewidth=1.5)
    
    # 设置固定 x 轴范围
    if xlim:
        ax.set_xlim(xlim)
    
    # 显示统计摘要 - 仅 supplement 风格，放到最上层
    if show_stats and style == 'supplement':
        stats_text = (
            f'N = {n}\n'
            f'Median = {median:.4f}\n'
            f'IQR = {iqr:.4f}'
        )
        ax.text(
            0.97, 0.97, stats_text,
            transform=ax.transAxes,
            fontsize=9,
            verticalalignment='top',
            horizontalalignment='right',
            bbox=dict(boxstyle='round,pad=0.4', facecolor='white', alpha=0.95, edgecolor='gray'),
            zorder=10
        )
    
    ax.set_title(title, fontsize=10)
    ax.set_xlabel(xlabel, fontsize=9)
    if show_ylabel:
        ax.set_ylabel('Count', fontsize=9)
    ax.tick_params(labelsize=8)
    
    return {'n': n, 'median': median, 'mean': mean, 'iqr': iqr}


def plot_l1_kde(
    data: pd.Series,
    ax: plt.Axes,
    title: str,
    xlabel: str,
    show_stats: bool = True,
    zero_line: bool = True,
    color: str = '#7C9D97',  # 学术配色 - 青绿色
    fill_alpha: float = 0.4
) -> dict:
    """
    绘制 L1 Δ KDE 密度曲线
    """
    clean_data = data.dropna()
    n = len(clean_data)
    
    if n < 2:
        ax.set_title(title)
        ax.set_xlabel(xlabel)
        ax.set_ylabel('Density')
        return {'n': n, 'median': 0, 'mean': 0, 'iqr': 0}
    
    # 计算统计量
    median = clean_data.median()
    mean = clean_data.mean()
    q1 = clean_data.quantile(0.25)
    q3 = clean_data.quantile(0.75)
    iqr = q3 - q1
    std = clean_data.std()
    
    # 检查数据方差是否足够（避免 KDE 奇异矩阵错误）
    if std < 1e-6:
        # 数据方差太小，使用直方图代替
        ax.hist(clean_data, bins=30, color=color, alpha=0.8, edgecolor='white', linewidth=0.5, density=True)
        if zero_line:
            ax.axvline(x=0, color='black', linestyle='--', linewidth=1.5, label='x=0')
    else:
        # 计算 KDE
        kde = stats.gaussian_kde(clean_data)
        
        # 生成 x 轴范围（以 0 为中心对称）
        data_max = max(abs(clean_data.min()), abs(clean_data.max())) * 1.1
        x_range = np.linspace(-data_max, data_max, 500)
        y_kde = kde(x_range)
        
        # 绘制 KDE 曲线和填充
        ax.plot(x_range, y_kde, color=color, linewidth=2)
        ax.fill_between(x_range, y_kde, alpha=fill_alpha, color=color)
        
        # 绘制 x=0 竖线
        if zero_line:
            ax.axvline(x=0, color='black', linestyle='--', linewidth=1.5, label='x=0')
    
    # 显示统计摘要
    if show_stats:
        stats_text = (
            f'N = {n}\n'
            f'Median = {median:.4f}\n'
            f'Mean = {mean:.4f}\n'
            f'IQR = {iqr:.4f}'
        )
        ax.text(
            0.97, 0.97, stats_text,
            transform=ax.transAxes,
            fontsize=9,
            verticalalignment='top',
            horizontalalignment='right',
            bbox=dict(boxstyle='round,pad=0.4', facecolor='white', alpha=0.9, edgecolor='gray')
        )
    
    ax.set_title(title)
    ax.set_xlabel(xlabel)
    ax.set_ylabel('Density')
    ax.set_ylim(bottom=0)
    
    return {'n': n, 'median': median, 'mean': mean, 'iqr': iqr}


def compose_hexad_kde(
    summary_csv: str,
    paired_csv: str,
    condition: str,
    conditions_yaml: str,
    output_path: str,
    dpi: int = 200,
    figsize: tuple = (15, 9),
    use_histogram: bool = False,
    show_clamp_bounds: bool = False,
    style: str = 'supplement'  # 'main' (精简) or 'supplement' (完整)
) -> dict:
    """
    生成六联图 (2x3) - KDE 或直方图版本
    
    Args:
        use_histogram: 如果为 True，L1 层使用直方图；否则使用 KDE
        show_clamp_bounds: 如果为 True，在 L2 图上显示 clamp 边界线
        style: 'main' (精简，适合主文) or 'supplement' (完整，适合补充材料)
    """
    if not os.path.exists(summary_csv):
        raise FileNotFoundError(f'Missing {summary_csv}')
    if not os.path.exists(paired_csv):
        raise FileNotFoundError(f'Missing {paired_csv}')
    if not os.path.exists(conditions_yaml):
        raise FileNotFoundError(f'Missing {conditions_yaml}')

    envelope = load_envelope(conditions_yaml, condition)
    
    # 获取 clamp 边界值
    tempo_bounds = get_tempo_bounds(envelope)
    gain_bounds = get_gain_bounds_db(envelope)
    accent_bounds = get_accent_bounds(envelope)

    df_summary = pd.read_csv(summary_csv)
    base = df_summary[df_summary['condition'] == 'baseline']
    con = df_summary[df_summary['condition'] == condition]
    merged_l2 = base.merge(con, on=['trace_id', 'seed'], suffixes=('_baseline', '_constrained'))

    if merged_l2.empty:
        raise ValueError(f'No L2 data found for condition: {condition}')

    df_paired = pd.read_csv(paired_csv)

    if df_paired.empty:
        raise ValueError(f'No L1 data found in {paired_csv}')

    # 从 paired_csv 获取真实的 clamp 标记
    clamp_flags = {'tempo': None, 'gain': None, 'accent': None}
    if 'tempo_clamped' in df_paired.columns:
        # 按 trace_id 和 seed 对齐
        paired_merged = merged_l2.merge(
            df_paired[['trace_id', 'seed', 'tempo_clamped', 'gain_clamped', 'accent_clamped']], 
            on=['trace_id', 'seed'], how='left'
        )
        clamp_flags['tempo'] = paired_merged['tempo_clamped'].fillna(0).astype(bool).values
        clamp_flags['gain'] = paired_merged['gain_clamped'].fillna(0).astype(bool).values
        clamp_flags['accent'] = paired_merged['accent_clamped'].fillna(0).astype(bool).values

    fig, axes = plt.subplots(2, 3, figsize=figsize)
    ax_tempo, ax_gain, ax_accent = axes[0]
    ax_onset, ax_lufs, ax_lra = axes[1]
    
    # 面板标识 (a)-(f)
    panel_labels = ['(a)', '(b)', '(c)', '(d)', '(e)', '(f)']
    all_axes = [ax_tempo, ax_gain, ax_accent, ax_onset, ax_lufs, ax_lra]
    for ax, label in zip(all_axes, panel_labels):
        ax.text(-0.12, 1.05, label, transform=ax.transAxes, fontsize=11, 
                fontweight='bold', va='bottom', ha='left')

    # === Row 1: L2 参数层 ===
    # 始终传入 clamp_bounds 用于区分上下界散点颜色
    tempo_stats = plot_l2_panel(
        ax_tempo,
        merged_l2['tempo_req_baseline'].values,
        merged_l2['tempo_eff_constrained'].values,
        'L2 Tempo (BPM)', 'Baseline Tempo', 'Constrained Tempo',
        is_clamped=clamp_flags['tempo'],
        clamp_bounds=tempo_bounds,
        style=style
    )

    gain_stats = plot_l2_panel(
        ax_gain,
        merged_l2['gain_req_baseline'].values,
        merged_l2['gain_eff_constrained'].values,
        'L2 Gain (dB)', 'Baseline Gain (dB)', 'Constrained Gain (dB)',
        is_clamped=clamp_flags['gain'],
        clamp_bounds=gain_bounds,
        style=style
    )

    accent_stats = plot_l2_panel(
        ax_accent,
        merged_l2['accent_req_baseline'].values,
        merged_l2['accent_eff_constrained'].values,
        'L2 Accent Ratio', 'Baseline Accent', 'Constrained Accent',
        is_clamped=clamp_flags['accent'],
        clamp_bounds=accent_bounds,
        style=style
    )

    # === Row 2: L1 信号层 (直方图或 KDE) ===
    # 固定 bin 宽度和 x 轴范围，确保三个配置可以直接对比
    BIN_WIDTH_ONSET = 0.05   # events/sec
    BIN_WIDTH_LUFS = 0.5     # dB
    BIN_WIDTH_LRA = 0.5      # LU
    
    # 统一的 x 轴范围（基于所有配置的数据范围）
    XLIM_ONSET = (-0.5, 0.5)   # events/sec
    XLIM_LUFS = (-5, 5)        # dB
    XLIM_LRA = (-5, 2)         # LU
    
    if use_histogram:
        # main 风格：只有最左边显示 y 轴标签
        onset_stats = plot_l1_histogram(
            data=df_paired['delta_onset_density_eps'],
            ax=ax_onset,
            title='ΔOnset Density',
            xlabel='Δ Onset Density (events/sec)',
            bin_width=BIN_WIDTH_ONSET,
            xlim=XLIM_ONSET,
            show_ylabel=True,
            style=style
        )

        lufs_stats = plot_l1_histogram(
            data=df_paired['delta_integrated_lufs'],
            ax=ax_lufs,
            title='ΔIntegrated Loudness',
            xlabel='ΔLUFS (LUFS)',
            bin_width=BIN_WIDTH_LUFS,
            xlim=XLIM_LUFS,
            show_ylabel=True,  # 三张都显示 Count
            style=style
        )

        # 对于 relaxed 模式，LRA delta 需要取反（因为原始计算方向相反）
        lra_data = df_paired['delta_lra_lu']
        if 'relaxed' in condition:
            lra_data = -lra_data
        
        lra_stats = plot_l1_histogram(
            data=lra_data,
            ax=ax_lra,
            title='ΔLoudness Range',
            xlabel='ΔLRA (LU)',
            bin_width=BIN_WIDTH_LRA,
            xlim=XLIM_LRA,
            show_ylabel=True,  # 三张都显示 Count
            style=style
        )
    else:
        onset_stats = plot_l1_kde(
            data=df_paired['delta_onset_density_eps'],
            ax=ax_onset,
            title='ΔOnset Density',
            xlabel='Δ Onset Density (events/sec)'
        )

        lufs_stats = plot_l1_kde(
            data=df_paired['delta_integrated_lufs'],
            ax=ax_lufs,
            title='ΔIntegrated Loudness',
            xlabel='ΔLUFS (LUFS)'
        )

        lra_data = df_paired['delta_lra_lu']
        if 'relaxed' in condition:
            lra_data = -lra_data
        
        lra_stats = plot_l1_kde(
            data=lra_data,
            ax=ax_lra,
            title='ΔLoudness Range',
            xlabel='ΔLRA (LU)'
        )

    # 不显示图内总标题（应放到 figure caption）
    fig.tight_layout()
    
    os.makedirs(os.path.dirname(output_path) or 'results', exist_ok=True)
    fig.savefig(output_path, dpi=dpi, bbox_inches='tight')
    plt.close(fig)

    return {
        'tempo': tempo_stats,
        'gain': gain_stats,
        'accent': accent_stats,
        'lufs': lufs_stats,
        'lra': lra_stats,
        'onset': onset_stats
    }


def get_paired_csv_path(condition: str) -> str:
    """根据 condition 自动选择对应的 paired_summary 文件"""
    suffix = condition.replace('constrained_', '')
    if suffix == 'default':
        return 'summary/paired_summary.csv'
    else:
        return f'summary/paired_summary_{suffix}.csv'


def main():
    parser = argparse.ArgumentParser(
        description='Generate hexad plot with KDE density curves'
    )
    parser.add_argument('--summary', default='summary/summary_runs.csv')
    parser.add_argument('--paired', default=None,
                        help='Path to paired_summary.csv (auto-detected if not specified)')
    parser.add_argument('--condition', default='constrained_default')
    parser.add_argument('--conditions_yaml', default='conditions.yaml')
    parser.add_argument('--out', default='results/hexad_default.png')
    parser.add_argument('--dpi', type=int, default=200)
    parser.add_argument('--width', type=float, default=15)
    parser.add_argument('--height', type=float, default=9)
    parser.add_argument('--histogram', action='store_true',
                        help='Use histogram instead of KDE for L1 plots (default: True)')
    parser.add_argument('--kde', action='store_true',
                        help='Use KDE instead of histogram for L1 plots')
    parser.add_argument('--show-clamp-bounds', action='store_true',
                        help='Show clamp boundary lines on L2 plots')
    parser.add_argument('--style', choices=['main', 'supplement'], default='supplement',
                        help='Output style: main (精简) or supplement (完整)')
    args = parser.parse_args()

    # 自动选择 paired_summary 文件
    paired_csv = args.paired if args.paired else get_paired_csv_path(args.condition)
    
    # 默认使用直方图，除非指定 --kde
    use_histogram = not args.kde
    show_clamp_bounds = args.show_clamp_bounds

    try:
        stats = compose_hexad_kde(
            summary_csv=args.summary,
            paired_csv=paired_csv,
            condition=args.condition,
            conditions_yaml=args.conditions_yaml,
            output_path=args.out,
            dpi=args.dpi,
            figsize=(args.width, args.height),
            use_histogram=use_histogram,
            show_clamp_bounds=show_clamp_bounds,
            style=args.style
        )
        
        print(f'Saved: {args.out}')
        print(f'L2 Clamp rates: tempo={stats["tempo"]["clamp_rate"]:.1%}, '
              f'gain={stats["gain"]["clamp_rate"]:.1%}, '
              f'accent={stats["accent"]["clamp_rate"]:.1%}')
        print(f'L1 Stats: ΔLUFS median={stats["lufs"]["median"]:.4f}, '
              f'ΔLRA median={stats["lra"]["median"]:.4f}, '
              f'ΔOnset median={stats["onset"]["median"]:.4f}')
        
    except (FileNotFoundError, KeyError, ValueError) as e:
        raise SystemExit(f'Error: {e}')


if __name__ == '__main__':
    main()
