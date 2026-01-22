import json
import argparse
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.ticker import MultipleLocator

def load_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def main():
    parser = argparse.ArgumentParser(description="Plot click trail with publication-grade styling")
    parser.add_argument("json_path", help="Path to click_trail JSON")
    parser.add_argument("--pdf", default="click_trail.pdf", help="Output PDF filename")
    parser.add_argument("--eps", default="click_trail.eps", help="Output EPS filename")
    parser.add_argument("--svg", default="click_trail.svg", help="Output SVG filename")
    args = parser.parse_args()

    data = load_json(args.json_path)
    lanes = data.get("lanes", ["C","D","E","G","A"])
    points = data.get("points", [])
    duration = float(data.get("durationSec", 10))

    plt.rcParams['font.family'] = 'sans-serif'
    plt.rcParams['font.sans-serif'] = ['Helvetica', 'Arial', 'DejaVu Sans']
    plt.rcParams['axes.labelweight'] = 'medium'

    fig, ax = plt.subplots(figsize=(10, 3))
    plt.subplots_adjust(left=0.12, right=0.98, top=0.92, bottom=0.20)

    y_positions = np.arange(len(lanes))
    ax.set_yticks(y_positions)
    ax.set_yticklabels(lanes)
    ax.set_ylabel('Notes', fontsize=13, labelpad=10)
    ax.set_xlabel('Time (s)', fontsize=13)

    ax.set_xlim(0, duration)
    ax.set_ylim(-0.5, len(lanes)-0.5)
    ax.xaxis.set_minor_locator(MultipleLocator(0.5))
    ax.grid(which='major', axis='y', linestyle='--', color='#d6d6d6', alpha=0.7)
    ax.grid(which='minor', axis='x', linestyle=':', color='#e2e2e2', alpha=0.6)

    for spine in ['top','right','left','bottom']:
        ax.spines[spine].set_visible(True)
        ax.spines[spine].set_linewidth(1.2)

    lane_index = {lane:i for i,lane in enumerate(lanes)}
    colors = {'C': '#F87171', 'D': '#FB923C', 'E': '#FBBF24', 'G': '#60A5FA', 'A': '#A78BFA'}
    xs = []
    ys = []
    cs = []
    for p in points:
        lane = p.get('lane', 'C')
        t = float(p.get('timeSec', 0))
        xs.append(t)
        ys.append(lane_index.get(lane, 0))
        cs.append(colors.get(lane, '#999999'))
    ax.scatter(xs, ys, s=64, c=cs, alpha=0.9, edgecolors='black', linewidths=1.2, zorder=3)

    fig.savefig(args.pdf, bbox_inches='tight')
    fig.savefig(args.eps, bbox_inches='tight')
    fig.savefig(args.svg, bbox_inches='tight')
    print(f"Saved PDF: {args.pdf}")
    print(f"Saved EPS: {args.eps}")
    print(f"Saved SVG: {args.svg}")

if __name__ == "__main__":
    main()
