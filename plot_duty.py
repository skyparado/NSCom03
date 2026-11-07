"""Plot the jamming-intensity dose-response from results_duty.csv (jammed near, N=5, varying duty).

Usage: python3 plot_duty.py [results_duty.csv]
Writes duty_response.png: packet loss and throughput vs jammer on-fraction, with std error bars.
"""
import sys

import matplotlib.pyplot as plt
import pandas as pd

st = pd.read_csv(sys.argv[1] if len(sys.argv) > 1 else "results_duty.csv")
# One row per run (duty, seed): network totals from the per-station rows.
runs = st.groupby(["jammerDuty", "seed"]).agg(
    tx=("txPackets", "sum"), rx=("rxPackets", "sum"),
    throughputMbps=("throughputMbps", "sum")).reset_index()
runs["lossPct"] = (1 - runs.rx / runs.tx) * 100

g = runs.groupby("jammerDuty").agg(["mean", "std"])
d = g.index * 100  # on-fraction as a percentage

fig, axes = plt.subplots(1, 2, figsize=(9.2, 3.8))
axes[0].errorbar(d, g[("lossPct", "mean")], yerr=g[("lossPct", "std")],
                 marker="o", capsize=3, color="#eb6834")
axes[0].set_ylabel("Packet loss (%)")
axes[1].errorbar(d, g[("throughputMbps", "mean")], yerr=g[("throughputMbps", "std")],
                 marker="o", capsize=3, color="#2a78d6")
axes[1].set_ylabel("Throughput (Mbps)")
for ax in axes:
    ax.set_xlabel("Jammer on-fraction / duty cycle (%)")
    ax.set_xticks(d)
    ax.grid(alpha=0.3)
fig.suptitle("Jamming intensity vs service (N = 5, near jammer)")
fig.tight_layout()
fig.savefig("duty_response.png", dpi=150)
print("wrote duty_response.png")
