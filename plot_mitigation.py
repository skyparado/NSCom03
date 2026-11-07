"""Plot the mitigation comparison from results_mitigation.csv (near jammer, N=5).

Three scenarios: no switch, switch to the half-overlapping channel 3, switch to the clean
channel 6. Shows what channel switching actually recovers -- partial vs full.

Usage: python3 plot_mitigation.py [results_mitigation.csv]
Writes mitigation.png: throughput and packet loss per scenario, mean over seeds with std bars.
"""
import sys

import matplotlib.pyplot as plt
import pandas as pd


def label(r):
    if not r.channelSwitch:
        return "No switch"
    return "Switch -> ch 3\n(overlap)" if r.switchChannel == 3 else "Switch -> ch 6\n(clean)"


ORDER = ["No switch", "Switch -> ch 3\n(overlap)", "Switch -> ch 6\n(clean)"]
COLORS = ["#eb6834", "#eda100", "#1baf7a"]

st = pd.read_csv(sys.argv[1] if len(sys.argv) > 1 else "results_mitigation.csv")
st["scenario"] = st.apply(label, axis=1)
# One row per run (scenario, seed): network totals from the per-station rows.
runs = st.groupby(["scenario", "seed"]).agg(
    tx=("txPackets", "sum"), rx=("rxPackets", "sum"),
    throughputMbps=("throughputMbps", "sum")).reset_index()
runs["lossPct"] = (1 - runs.rx / runs.tx) * 100

g = runs.groupby("scenario").agg(["mean", "std"]).reindex(ORDER)

fig, axes = plt.subplots(1, 2, figsize=(9.2, 4.2))
x = range(len(ORDER))
axes[0].bar(x, g[("throughputMbps", "mean")], yerr=g[("throughputMbps", "std")],
            capsize=4, color=COLORS)
axes[0].set_ylabel("Throughput (Mbps)")
axes[1].bar(x, g[("lossPct", "mean")], yerr=g[("lossPct", "std")], capsize=4, color=COLORS)
axes[1].set_ylabel("Packet loss (%)")
for ax in axes:
    ax.set_xticks(list(x))
    ax.set_xticklabels(ORDER, fontsize=8)
    ax.grid(axis="y", alpha=0.3)
fig.suptitle("Channel-switch mitigation: overlapping vs clean channel (N = 5, near jammer)")
fig.tight_layout()
fig.savefig("mitigation.png", dpi=150)
print("wrote mitigation.png")
