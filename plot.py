"""Plot T1-T5 from results.csv (one row per station per run): mean over seeds with std error bars.

Usage: python3 plot.py [results.csv]
Writes t1_t2.png, t3_load.png, t4_distance.png, t5_switch.png, l1_l2.png, per_station.png,
summary.csv (mean/std per scenario and station count) and recovery.csv (RQ4).
"""
import sys

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from matplotlib.container import BarContainer

NETWORK = [("throughputMbps", "Throughput (Mbps)"),
           ("lossRatio", "Packet loss ratio"),
           ("meanDelayMs", "Mean delay (ms)")]
PER_STA = [("perStaMbps", "Throughput per station (Mbps)")] + NETWORK[1:]
L1_L2 = [("sinrDb", "Mean SINR at AP (dB)"),
         ("retriesPerPkt", "MAC retries per packet"),
         ("ccaBusy", "Time medium sensed busy (CCA)")]
# Color follows the scenario across every figure.
COLORS = {"No jammer": "#2a78d6", "Jammed (near)": "#eb6834", "Channel switch (near)": "#1baf7a",
          "Jammed (far)": "#eda100", "Channel switch (far)": "#e87ba4"}
ALL = list(COLORS)


def label(r):
    if not r.jammer:
        return "No jammer"
    where = "near" if r.jammerDistance <= 10 else "far"
    return f"Channel switch ({where})" if r.channelSwitch else f"Jammed ({where})"


def plot(df, scenarios, metrics, title, fname, kind="bar"):
    sub = df[df.scenario.isin(scenarios)]
    fig, axes = plt.subplots(1, len(metrics), figsize=(4.4 * len(metrics), 3.8))
    for ax, (col, name) in zip(axes, metrics):
        g = sub.groupby(["nStations", "scenario"])[col].agg(["mean", "std"]).unstack("scenario")
        mean, std = g["mean"][scenarios], g["std"][scenarios]
        colors = [COLORS[s] for s in scenarios]
        if kind == "bar":
            mean.plot.bar(yerr=std, capsize=3, color=colors, ax=ax, rot=0, legend=False)
            # A missing bar means no packet got through in any run, not zero.
            bars = [c for c in ax.containers if isinstance(c, BarContainer)]
            for c, s in zip(bars, scenarios):
                for p, n in zip(c.patches, mean.index):
                    if np.isnan(mean.loc[n, s]):
                            ax.text(p.get_x() + p.get_width() / 2, 0, "none delivered",
                                    rotation=90, ha="center", va="bottom", fontsize=7,
                                    color="#52514e")
        else:
            mean.plot(yerr=std, capsize=3, marker="o", color=colors, ax=ax, legend=False)
            ax.set_xticks(mean.index)
        ax.set_xlabel("Number of stations")
        ax.set_ylabel(name)
        ax.grid(axis="y", alpha=0.3)
    # Legend below the plots so it never covers bars or the "none delivered" labels.
    handles, labels = axes[0].get_legend_handles_labels()
    fig.legend(handles, labels, loc="lower center", ncol=len(scenarios),
               frameon=False, fontsize=9, bbox_to_anchor=(0.5, 0))
    fig.suptitle(title)
    fig.tight_layout(rect=[0, 0.08, 1, 1])
    fig.savefig(fname, dpi=150)
    plt.close(fig)
    print("wrote", fname)


st = pd.read_csv(sys.argv[1] if len(sys.argv) > 1 else "results.csv")
st["scenario"] = st.apply(label, axis=1)
st["delayW"] = st.meanDelayMs.fillna(0) * st.rxPackets

# One row per run (scenario, N, seed): network totals from the per-station rows.
runs = st.groupby(["scenario", "nStations", "seed"]).agg(
    tx=("txPackets", "sum"), rx=("rxPackets", "sum"), throughputMbps=("throughputMbps", "sum"),
    delayW=("delayW", "sum"), sinrDb=("sinrDb", "mean"), retries=("retries", "sum"),
    ccaBusy=("ccaBusy", "mean")).reset_index()
runs["lossRatio"] = 1 - runs.rx / runs.tx
runs["meanDelayMs"] = (runs.delayW / runs.rx).where(runs.rx > 0)  # undefined if nothing arrived
runs["perStaMbps"] = runs.throughputMbps / runs.nStations
runs["retriesPerPkt"] = runs.retries / runs.tx

cols = [c for c, _ in NETWORK + PER_STA[:1] + L1_L2]
summary = runs.groupby(["scenario", "nStations"])[cols].agg(["mean", "std"])
summary.columns = [f"{a}_{b}" for a, b in summary.columns]
# Delay and SINR are averaged only over runs where packets arrived; this says how many that was.
summary["runsWithDelivery"] = runs.groupby(["scenario", "nStations"]).rx.apply(lambda r: (r > 0).sum())
summary["runs"] = runs.groupby(["scenario", "nStations"]).size()
summary.round(4).to_csv("summary.csv")
print("wrote summary.csv")

# RQ4: share of the jamming damage that channel switching recovers, 100% = back to baseline.
m = runs.groupby(["scenario", "nStations"])[["throughputMbps", "lossRatio"]].mean()
rec = []
for where in ("near", "far"):
    for n in sorted(runs.nStations.unique()):
        base, jam, sw = (m.loc[(s, n)] for s in
                         ("No jammer", f"Jammed ({where})", f"Channel switch ({where})"))
        pct = (sw - jam) / (base - jam) * 100  # inf/NaN if the jammer did no damage
        rec.append({"jammer": where, "nStations": n,
                    "throughputRecoveryPct": pct.throughputMbps, "lossRecoveryPct": pct.lossRatio})
rec = pd.DataFrame(rec).round(1)
rec.to_csv("recovery.csv", index=False)
print(rec.to_string(index=False))

plot(runs, ["No jammer", "Jammed (near)"], NETWORK,
     "T1 vs T2: baseline vs constant jammer", "t1_t2.png")
plot(runs, ["No jammer", "Jammed (near)", "Jammed (far)"], PER_STA,
     "T3: effect of load", "t3_load.png", kind="line")
plot(runs, ["Jammed (near)", "Jammed (far)"], NETWORK,
     "T4: jammer near (10 m) vs far (40 m)", "t4_distance.png")
plot(runs, ALL, NETWORK, "T5: before vs after channel switching", "t5_switch.png")
plot(runs, ALL, L1_L2, "Layer 1 (SINR) and Layer 2 (retries, CCA deferral)", "l1_l2.png")

# RQ3 per station: how damage depends on each station's own distance to the jammer.
nmax = st.nStations.max()
pts = (st[(st.nStations == nmax) & st.scenario.isin(["Jammed (near)", "Jammed (far)"])]
       .groupby(["scenario", "distToJammer"])[["lossRatio", "sinrDb"]].mean().reset_index())
fig, axes = plt.subplots(1, 2, figsize=(9, 3.8))
for ax, (col, name) in zip(axes, [("lossRatio", "Packet loss ratio"), ("sinrDb", "Mean SINR at AP (dB)")]):
    for s, d in pts.groupby("scenario"):
        ax.plot(d.distToJammer, d[col], "o", ms=8, color=COLORS[s], label=s)
    ax.set_xlabel("Station distance to jammer (m)")
    ax.set_ylabel(name)
    ax.grid(alpha=0.3)
axes[0].legend(frameon=False, fontsize=8)
fig.suptitle(f"Per-station effect of jammer distance (N = {nmax})")
fig.tight_layout()
fig.savefig("per_station.png", dpi=150)
plt.close(fig)
print("wrote per_station.png")
