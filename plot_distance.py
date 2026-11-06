"""Plot the RQ3 distance gradient from results_distance.csv (jammed, N=5, varying jammer distance).

Usage: python3 plot_distance.py [results_distance.csv]
Writes distance_gradient.png: packet loss and throughput vs jammer distance, with std error bars.
"""
import sys

import matplotlib.pyplot as plt
import pandas as pd

st = pd.read_csv(sys.argv[1] if len(sys.argv) > 1 else "results_distance.csv")
# One row per run (distance, seed): network totals from the per-station rows.
runs = st.groupby(["jammerDistance", "seed"]).agg(
    tx=("txPackets", "sum"), rx=("rxPackets", "sum"),
    throughputMbps=("throughputMbps", "sum")).reset_index()
runs["lossPct"] = (1 - runs.rx / runs.tx) * 100

g = runs.groupby("jammerDistance").agg(["mean", "std"])
d = g.index

fig, axes = plt.subplots(1, 2, figsize=(9.2, 3.8))
axes[0].errorbar(d, g[("lossPct", "mean")], yerr=g[("lossPct", "std")],
                 marker="o", capsize=3, color="#eb6834")
axes[0].set_ylabel("Packet loss (%)")
axes[1].errorbar(d, g[("throughputMbps", "mean")], yerr=g[("throughputMbps", "std")],
                 marker="o", capsize=3, color="#2a78d6")
axes[1].set_ylabel("Throughput (Mbps)")
for ax in axes:
    ax.set_xlabel("Jammer distance from AP (m)")
    ax.set_xticks(d)
    ax.grid(alpha=0.3)
fig.suptitle("RQ3: jammer effect vs distance (N = 5, calibrated 4 dBm jammer)")
fig.tight_layout()
fig.savefig("distance_gradient.png", dpi=150)
print("wrote distance_gradient.png")
