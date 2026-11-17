"""Plot the jamming study from results.csv (one row per station per run): mean over seeds, std bars.

Usage: python3 plot.py [results.csv]
Writes
  rq1_rq3_distance.png  throughput, loss and delay vs jammer distance, one line per jammer power
  rq2_load.png          loss and delay vs distance for 1/5/10 stations, one column per jammer power
  l1_l2.png             loss vs signal-to-jammer ratio at the AP, SINR of decoded frames, CCA busy
                        time, MAC retries
  rq4_mitigation.png    delivery and delay vs distance per mitigation, and the denial radius
  summary.csv           mean/std of every metric per scenario, jammer power, distance, station count
  denial_radius.csv     distance at which loss falls through 50% and 5%
  recovery.csv          RQ4: % of the jamming damage each mitigation recovers
"""
import sys

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

N_MAIN = 5  # station count used where a figure shows a single load
POWER_COLORS = ["#eda100", "#eb6834", "#a8201a"]  # weak -> strong jammer
LOAD_COLORS = {1: "#8fbcf0", 5: "#2a78d6", 10: "#123a6b"}
MITIGATIONS = {"No mitigation": "#eb6834", "Switch to ch 3 (half overlap)": "#eda100",
               "Rate adaptation": "#7a5cd6", "Switch to ch 6 (clean)": "#1baf7a"}
KEYS = ["scenario", "jammerPower", "jammerDistance", "nStations"]


def radius(loss, level):
    """Distance where mean loss (a Series indexed by distance) falls through `level` %.

    Linear interpolation between grid points; NaN if it never crosses inside the grid."""
    d, y = loss.index.to_numpy(float), loss.to_numpy(float)
    k = np.where((y[:-1] >= level) & (y[1:] < level))[0]
    if not len(k):
        return np.nan
    i = k[-1]
    return d[i] + (y[i] - level) / (y[i] - y[i + 1]) * (d[i + 1] - d[i])


assert radius(pd.Series([100, 60, 40, 0], index=[10, 20, 30, 40]), 50) == 25
assert np.isnan(radius(pd.Series([0, 0], index=[10, 20]), 50))


def line(ax, df, col, x="jammerDistance", **kw):
    g = df.groupby(x)[col].agg(["mean", "std"])
    ax.errorbar(g.index, g["mean"], yerr=g["std"], marker="o", ms=4, capsize=3, **kw)


def finish(fig, axes, title, fname, xlabel="Jammer distance from AP (m)"):
    for ax in np.ravel(axes):
        ax.set_xlabel(xlabel)
        ax.grid(alpha=0.3)
    handles, labels = np.ravel(axes)[0].get_legend_handles_labels()
    fig.legend(handles, labels, loc="lower center", ncol=len(labels), frameon=False, fontsize=9)
    fig.suptitle(title)
    fig.tight_layout(rect=[0, 0.07, 1, 1])
    fig.savefig(fname, dpi=150)
    plt.close(fig)
    print("wrote", fname)


st = pd.read_csv(sys.argv[1] if len(sys.argv) > 1 else "results.csv")
st["scenario"] = np.select(
    [(st.jammer == 0) & (st.rateAdaptation == 1), st.jammer == 0, st.rateAdaptation == 1, (st.channelSwitch == 1) & (st.switchChannel == 3),
     st.channelSwitch == 1],
    ["No jammer (rate adaptation)", "No jammer", "Rate adaptation", "Switch to ch 3 (half overlap)", "Switch to ch 6 (clean)"],
    "No mitigation")
st["delayW"] = st.meanDelayMs.fillna(0) * st.rxPackets

# One row per run: network totals from the per-station rows.
runs = st.groupby(KEYS + ["seed"]).agg(
    tx=("txPackets", "sum"), rx=("rxPackets", "sum"), throughputMbps=("throughputMbps", "sum"),
    delayW=("delayW", "sum"), sinrDb=("sinrDb", "mean"), retries=("retries", "sum"),
    ccaBusy=("ccaBusy", "mean")).reset_index()
runs["lossPct"] = (1 - runs.rx / runs.tx) * 100
runs["deliveredPct"] = 100 - runs.lossPct
runs["meanDelayMs"] = (runs.delayW / runs.rx).where(runs.rx > 0)  # undefined if nothing arrived
runs["retriesPerPkt"] = runs.retries / runs.tx
# Mean signal-to-jammer ratio at the AP from the path-loss model in wifi-jamming.cc:
# 16.0206 dBm stations at 10 m, log-distance exponent 3 (the 1 m reference loss cancels).
runs["sirDb"] = 16.0206 - runs.jammerPower + 30 * np.log10(runs.jammerDistance / 10)

METRICS = ["throughputMbps", "lossPct", "meanDelayMs", "sinrDb", "retriesPerPkt", "ccaBusy"]
summary = runs.groupby(KEYS)[METRICS].agg(["mean", "std"])
summary.columns = [f"{a}_{b}" for a, b in summary.columns]
# Delay and SINR are averaged only over runs where packets arrived; this says how many that was.
summary["runsWithDelivery"] = runs.groupby(KEYS).rx.apply(lambda r: (r > 0).sum())
summary["runs"] = runs.groupby(KEYS).size()
summary.round(4).to_csv("summary.csv")
print("wrote summary.csv")

base = runs[runs.scenario == "No jammer"].groupby("nStations")[METRICS + ["deliveredPct"]].mean()
jam = runs[runs.scenario == "No mitigation"]
powers = sorted(jam.jammerPower.unique())
strongest = runs[runs.jammerPower == powers[-1]]


def power_lines(ax, col, x="jammerDistance"):
    for pw, c in zip(powers, POWER_COLORS):
        line(ax, jam[(jam.jammerPower == pw) & (jam.nStations == N_MAIN)], col, x,
             color=c, label=f"{pw:.0f} dBm jammer")


# RQ1 + RQ3: how much damage, and how it falls off with distance.
fig, axes = plt.subplots(1, 3, figsize=(13.2, 4.2))
for ax, (col, name) in zip(axes, [("throughputMbps", "Throughput (Mbps)"),
                                  ("lossPct", "Packet loss (%)"),
                                  ("meanDelayMs", "Mean delay (ms)")]):
    power_lines(ax, col)
    ax.axhline(base.loc[N_MAIN, col], color="#2a78d6", ls="--", label="No jammer")
    ax.set_ylabel(name)
axes[2].set_yscale("log")
finish(fig, axes, f"RQ1 / RQ3: constant jammer vs distance (N = {N_MAIN})", "rq1_rq3_distance.png")

# RQ2: does load change the picture? One column per jammer power.
fig, axes = plt.subplots(2, len(powers), figsize=(4.4 * len(powers), 7), squeeze=False)
for j, pw in enumerate(powers):
    for n, c in LOAD_COLORS.items():
        d = jam[(jam.jammerPower == pw) & (jam.nStations == n)]
        line(axes[0, j], d, "lossPct", color=c, label=f"{n} station{'s' * (n > 1)}")
        line(axes[1, j], d, "meanDelayMs", color=c)
    axes[0, j].set_ylim(-5, 105)  # std bars of the bimodal N = 1 runs would stretch the axis
    axes[0, j].set_title(f"{pw:.0f} dBm jammer", fontsize=10)
    axes[0, j].set_ylabel("Packet loss (%)")
    axes[1, j].set_ylabel("Mean delay (ms)")
    axes[1, j].set_yscale("log")
finish(fig, axes, "RQ2: effect of load under jamming", "rq2_load.png")

# Objective 6: Layer 1 (loss against SIR collapses the three powers onto one curve) and Layer 2.
fig, axes = plt.subplots(2, 2, figsize=(9.6, 7.6))
for ax, (col, name) in zip(axes.flat, [("lossPct", "Packet loss (%)"),
                                       ("sinrDb", "SINR of frames the AP decoded (dB)"),
                                       ("ccaBusy", "Time stations sense the medium busy (CCA)"),
                                       ("retriesPerPkt", "MAC retries per offered packet")]):
    power_lines(ax, col, x="sirDb" if col == "lossPct" else "jammerDistance")
    if col != "lossPct":
        ax.axhline(base.loc[N_MAIN, col], color="#2a78d6", ls="--", label="No jammer")
    ax.set_ylabel(name)
finish(fig, axes[::-1], f"Layer 1 (SIR, SINR) and Layer 2 (CCA deferral, retries), N = {N_MAIN}",
       "l1_l2.png")
axes[0, 0].set_xlabel("Mean signal-to-jammer ratio at the AP (dB)")
fig.savefig("l1_l2.png", dpi=150)

# Denial radius for every curve: where loss falls through 50% (denied) and 5% (barely affected).
mean_loss = runs[~runs.scenario.str.startswith("No jammer")].groupby(KEYS).lossPct.mean()
rad = pd.DataFrame({f"radius{lv}Pct_m": mean_loss.groupby(KEYS[:2] + KEYS[3:]).apply(
    lambda s, lv=lv: radius(s.droplevel([0, 1, 3]), lv)) for lv in (50, 5)}).round(1)
rad.to_csv("denial_radius.csv")
print(rad.to_string())

# RQ4: what each mitigation buys against the strongest jammer.
fig, axes = plt.subplots(1, 3, figsize=(13.2, 4.4))
for s, c in MITIGATIONS.items():
    d = strongest[(strongest.scenario == s) & (strongest.nStations == N_MAIN)]
    line(axes[0], d, "deliveredPct", color=c, label=s)
    line(axes[1], d, "meanDelayMs", color=c)
axes[0].set_ylabel("Packets delivered (%)")
axes[1].set_ylabel("Mean delay (ms)")
axes[1].set_yscale("log")
loads = sorted(runs.nStations.unique())
for k, (s, c) in enumerate(MITIGATIONS.items()):
    r = [rad.radius50Pct_m.get((s, powers[-1], n), np.nan) for n in loads]
    axes[2].bar(np.arange(len(loads)) + (k - 1.5) * 0.2, r, 0.2, color=c)
finish(fig, axes, f"RQ4: mitigation against a {powers[-1]:.0f} dBm jammer (curves: N = {N_MAIN})",
       "rq4_mitigation.png")
axes[2].set_xticks(range(len(loads)), loads)
axes[2].set_xlabel("Number of stations (no bar = never above 50% loss)")
axes[2].set_ylabel("Denial radius: 50% loss (m)")
fig.savefig("rq4_mitigation.png", dpi=150)

# RQ4 in numbers: share of the jammer's damage each mitigation wins back, 100% = baseline.
d = strongest.groupby(KEYS).deliveredPct.mean().unstack("scenario").droplevel("jammerPower")
damage = (base.deliveredPct.reindex(d.index, level="nStations") - d["No mitigation"])
rec = pd.DataFrame({s: (d[s] - d["No mitigation"]) / damage.where(damage >= 1) * 100  # NaN: no damage
                    for s in MITIGATIONS if s != "No mitigation"})
rec.insert(0, "deliveredPctNoMitigation", d["No mitigation"])
rec.round(1).to_csv("recovery.csv")
print("wrote denial_radius.csv, recovery.csv")
