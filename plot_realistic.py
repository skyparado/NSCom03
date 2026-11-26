import sys

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

def radius(loss, level):
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


def label(r):
    if r.jammer == 0:
        return "No jammer: " + label(r.copy().set_axis(r.index).where(r.index != "jammer", 1))
    if r.walls and r.jammerMask and r.rateAdaptation and r.traffic == "tcp":
        return "All realistic + switch to ch 6 after 1 s" if r.channelSwitch else "All realistic, no fix"
    if r.switchAt >= 0:
        return f"Switch to ch 6 after {r.switchAt:g} s"
    if r.walls:
        return "Walls (5 dB each)"
    if r.jammerMask:
        return f"Leaky jammer, ch {r.switchChannel}"
    if r.traffic == "tcp":
        return "TCP"
    if r.rateMbps > 1:
        return "UDP 5 Mbps"
    if r.mcs == 0:
        return "Fixed MCS 0"
    return "?"


def per_run(st):
    st = st.copy()
    st["delayW"] = st.meanDelayMs.fillna(0) * st.rxPackets
    keys = ["scenario", "traffic", "rateMbps", "jammerDistance", "nStations", "seed"]
    runs = st.groupby(keys, dropna=False).agg(
        tx=("txPackets", "sum"), rx=("rxPackets", "sum"), thr=("throughputMbps", "sum"),
        delayW=("delayW", "sum"), recoveryMs=("recoveryMs", "mean")).reset_index()
    runs["servicePct"] = runs.thr / (runs.rateMbps * runs.nStations) * 100
    runs["lossPct"] = 100 - runs.servicePct
    runs["meanDelayMs"] = (runs.delayW / runs.rx).where(runs.rx > 0)
    return runs


real = pd.read_csv(sys.argv[1] if len(sys.argv) > 1 else "results_realistic.csv")
real["scenario"] = real.apply(label, axis=1)
assert (real.scenario != "?").all()
orig = pd.read_csv(sys.argv[2] if len(sys.argv) > 2 else "results.csv")
orig = orig[(orig.jammerPower.round() == 30) | (orig.jammer == 0)]
orig["scenario"] = np.select(
    [orig.jammer == 0, orig.rateAdaptation == 1, (orig.channelSwitch == 1) & (orig.switchChannel == 3),
     orig.channelSwitch == 1],
    ["No jammer", "Rate adaptation", "Brick-wall jammer, ch 3", "Brick-wall jammer, ch 6"], "Original model")
orig["traffic"], orig["rateMbps"], orig["recoveryMs"] = "udp", 1.0, np.nan
orig = orig[(orig.jammer == 1) | (orig.rateAdaptation == 0)]
orig.loc[orig.jammer == 0, "scenario"] = "No jammer (original)"
runs = pd.concat([per_run(real), per_run(orig)], ignore_index=True)
N5 = runs[runs.nStations == 5]

summary = runs.groupby(["scenario", "jammerDistance", "nStations"])[["servicePct", "lossPct", "meanDelayMs",
                                                                    "recoveryMs"]].agg(["mean", "std"])
summary.columns = [f"{a}_{b}" for a, b in summary.columns]
summary.round(3).to_csv("summary_realistic.csv")
print("wrote summary_realistic.csv")

rad = []
for sc, g in N5[~N5.scenario.str.startswith("No jammer")].groupby("scenario"):
    loss = g.groupby("jammerDistance").lossPct.mean()
    if len(loss) > 1:
        rad.append((sc, round(radius(loss, 50), 1), round(radius(loss, 5), 1), round(loss.iloc[0], 1)))
rad = pd.DataFrame(rad, columns=["scenario", "radius50Pct_m", "radius5Pct_m", "lossAt10m_pct"])
rad.to_csv("radius_realistic.csv", index=False)
print("wrote radius_realistic.csv")
print(rad.to_string(index=False))


def curves(ax, names, col="servicePct"):
    for name, c in names:
        line(ax, N5[N5.scenario == name], col, color=c, label=name)


fig, axes = plt.subplots(1, 3, figsize=(15, 4.6))
curves(axes[0], [("Original model", "#eb6834"), ("Walls (5 dB each)", "#1baf7a")])
axes[0].set_title("Walls between jammer and network")
curves(axes[1], [("Brick-wall jammer, ch 3", "#eda100"), ("Leaky jammer, ch 3", "#a8201a"),
                 ("Brick-wall jammer, ch 6", "#1baf7a"), ("Leaky jammer, ch 6", "#123a6b")])
axes[1].set_title("Jammer leaking into nearby channels")
curves(axes[2], [("Original model", "#eb6834"), ("Fixed MCS 0", "#7a5cd6"), ("TCP", "#2a78d6"),
                 ("UDP 5 Mbps", "#6b6b6b")])
axes[2].set_title("Traffic type, load and rate")
for ax in axes:
    ax.set_ylabel("Service (% of offered load)")
    ax.set_ylim(-5, 105)
    ax.legend(fontsize=8, loc="lower right")
    ax.set_xlabel("Jammer distance from AP (m)")
    ax.grid(alpha=0.3)
fig.suptitle("Test 2: one realism factor at a time (30 dBm jammer, 5 stations)")
fig.tight_layout()
fig.savefig("realistic_env.png", dpi=150)
plt.close(fig)
print("wrote realistic_env.png")

sw = runs[runs.scenario.str.startswith("Switch to ch 6 after")].copy()
sw["switchAt"] = sw.scenario.str.extract(r"after ([\d.]+) s").astype(float)
fig, axes = plt.subplots(1, 2, figsize=(11, 4.4))
for n, c in {1: "#8fbcf0", 5: "#2a78d6", 10: "#123a6b"}.items():
    d = sw[sw.nStations == n]
    line(axes[0], d, "lossPct", x="switchAt", color=c, label=f"{n} station{'s' * (n > 1)}")
    line(axes[1], d, "recoveryMs", x="switchAt", color=c, label=f"{n} station{'s' * (n > 1)}")
t = np.linspace(0.1, 5, 50)
axes[0].plot(t, t / 60 * 100, "k--", lw=1, label="Jammed time only (t / 60 s)")
axes[0].set_ylabel("Packet loss over the 60 s run (%)")
axes[1].set_ylabel("Time from switch to first packet (ms)")
axes[0].set_title("Loss grows with detection time")
axes[1].set_title("Re-association after the switch")
for ax in axes:
    ax.set_xscale("log")
    ax.set_xticks([0.1, 0.5, 1, 2, 5], ["0.1", "0.5", "1", "2", "5"])
    ax.legend(fontsize=8)
finish(fig, axes, "Test 2: switching to ch 6 takes time (30 dBm jammer at 10 m)", "switch_time.png",
       xlabel="Time before switching: detection + decision (s)")

fig, axes = plt.subplots(1, 2, figsize=(11, 4.4))
for name, c in [("Original model", "#eb6834"), ("All realistic, no fix", "#a8201a"),
                ("All realistic + switch to ch 6 after 1 s", "#1baf7a")]:
    line(axes[0], N5[N5.scenario == name], "servicePct", color=c, label=name)
    line(axes[1], N5[N5.scenario == name], "meanDelayMs", color=c, label=name)
axes[0].set_ylabel("Service (% of offered load)")
axes[1].set_ylabel("Mean delay (ms)")
axes[1].set_yscale("log")
finish(fig, axes, "Test 2: walls + leaky jammer + rate adaptation + TCP, together", "all_realistic.png")
