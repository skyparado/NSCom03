"""Plot the mid-run channel switch from results_dynamic_timeline.csv (written by run_all.py).

Usage: python3 plot_dynamic.py [results_dynamic_timeline.csv]
Writes dynamic_timeline.png: packets received per second at the AP, one panel per jammer power and
distance, one line per target channel (mean over seeds, band = std). The jammer starts at 1 s and
the whole network moves to the new channel once the AP detects the jamming (switchTime per run in
the CSV, -1 if it never switched; the dashed line is the mean switch time of the panel).
Writes dynamic_summary.csv with, per case (mean over seeds):
  switchTime        when the network switched (mean over runs that switched); switchedRuns counts them
  lostBeforeSwitch  packets lost between the jammer starting (1 s) and the switch, against the
                    rate the stations offer (5 stations x 1 Mbps / 1024 B packets)
  recoverySec       seconds after the switch until the AP gets >= 90% of the offered rate for two
                    seconds in a row (blank if it never does)
  deliveredAfterPct share of the offered rate delivered once the switch has settled
"""
import math
import sys

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

PKT_BITS, RATE_BPS = 1024 * 8, 1e6  # must match pktSize and rateBps in wifi-jamming.cc
RECOVERED = 0.9                     # "recovered" = at least this share of the offered rate
COLORS = {3: "#eb6834", 6: "#2a78d6"}  # ch 3 (half overlap), ch 6 (clean); same as plot_duty.py

tl = pd.read_csv(sys.argv[1] if len(sys.argv) > 1 else "results_dynamic_timeline.csv")
KEYS = ["jammerPower", "jammerDistance", "switchChannel"]


def run_stats(run):
    """Packets lost before the switch, recovery time and settled delivery for one run."""
    run = run.sort_values("second")
    offered = run.nStations.iloc[0] * RATE_BPS / PKT_BITS  # packets/s the stations offer
    sw = run.switchTime.iloc[0]
    sw = math.inf if sw < 0 else sw  # never switched: every jammed second counts as "before"
    rx = run.set_index("second").rxPackets
    before = rx[(rx.index >= 1) & (rx.index < sw)]  # seconds with the jammer on, still on ch 1
    lost = float((offered - before).clip(lower=0).sum())
    ok = (rx >= RECOVERED * offered)
    rec = math.nan
    for s in rx.index[rx.index >= sw]:
        if ok.get(s, False) and ok.get(s + 1, True):  # two good seconds in a row (or the last one)
            rec = s - sw
            break
    after = rx[rx.index >= math.ceil(sw) + 1]
    return pd.Series({"switchTime": sw if sw < math.inf else math.nan,
                      "lostBeforeSwitch": lost, "recoverySec": rec,
                      "deliveredAfterPct": 100 * after.mean() / offered if len(after) else math.nan})


runs = tl.groupby(KEYS + ["seed"]).apply(run_stats, include_groups=False).reset_index()
summ = runs.groupby(KEYS).agg(
    seeds=("seed", "count"),
    switchTime=("switchTime", "mean"), switchedRuns=("switchTime", "count"),
    lostBeforeSwitch=("lostBeforeSwitch", "mean"), lostStd=("lostBeforeSwitch", "std"),
    recoverySec=("recoverySec", "mean"), recoveredRuns=("recoverySec", "count"),
    deliveredAfterPct=("deliveredAfterPct", "mean")).round(2).reset_index()
summ.to_csv("dynamic_summary.csv", index=False)
print(summ.to_string(index=False))

powers = sorted(tl.jammerPower.unique())
dists = sorted(tl.jammerDistance.unique())
offered = tl.nStations.iloc[0] * RATE_BPS / PKT_BITS

fig, axes = plt.subplots(len(powers), len(dists), figsize=(3.6 * len(dists), 2.6 * len(powers)),
                         sharex=True, sharey=True, squeeze=False)
for i, pw in enumerate(powers):
    for j, d in enumerate(dists):
        ax = axes[i][j]
        for ch in sorted(tl.switchChannel.unique()):
            sub = tl[(tl.jammerPower == pw) & (tl.jammerDistance == d) & (tl.switchChannel == ch)]
            g = sub.groupby("second").rxPackets.agg(["mean", "std"]).fillna(0)
            # A sample at x = s is the packets received during [s, s+1): draw it as a step.
            ax.step(g.index, g["mean"], where="post", color=COLORS.get(ch, "gray"), lw=2,
                    label=f"Switch to ch {ch}")
            ax.fill_between(g.index, g["mean"] - g["std"], g["mean"] + g["std"], step="post",
                            color=COLORS.get(ch, "gray"), alpha=0.18, lw=0)
        ax.axhline(offered, color="#8a8a85", ls=":", lw=1)
        sw = runs[(runs.jammerPower == pw) & (runs.jammerDistance == d)].switchTime.mean()
        for x, name in ((1, "jammer on"), (sw, "switch")):
            if math.isnan(x):  # no run in this panel switched
                continue
            ax.axvline(x, color="#8a8a85", ls="--", lw=1)
            if i == 0 and j == 0:  # name the two events once, inside the first panel
                ax.annotate(name, xy=(x, 1), xycoords=("data", "axes fraction"),
                            xytext=(-3, -3), textcoords="offset points", rotation=90,
                            ha="right", va="top", fontsize=7, color="#6b6b66")
        if i == 0:
            ax.set_title(f"Jammer at {d:g} m")
        if j == 0:
            ax.set_ylabel(f"{pw:.0f} dBm jammer\npackets/s at AP")
        if i == len(powers) - 1:
            ax.set_xlabel("Time (s)")
        ax.set_ylim(0, offered * 1.3)
        ax.grid(alpha=0.3)
h, lab = axes[0][0].get_legend_handles_labels()
fig.legend(h, lab, loc="lower center", ncol=len(lab), frameon=False)
fig.suptitle("Jammed on ch 1; the network switches once the AP detects it (dotted = offered rate)")
fig.tight_layout(rect=(0, 0.05, 1, 0.97))
fig.savefig("dynamic_timeline.png", dpi=150)
print("wrote dynamic_timeline.png and dynamic_summary.csv")
