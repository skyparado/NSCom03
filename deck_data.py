"""Collect the numbers the slide deck shows into deck_data.json (run after plot.py).

Usage: python3 deck_data.py   (reads summary.csv, denial_radius.csv, recovery.csv, results_duty.csv)
"""
import json

import numpy as np
import pandas as pd

s = pd.read_csv("summary.csv")
rad = pd.read_csv("denial_radius.csv")
rec = pd.read_csv("recovery.csv")
duty = pd.read_csv("results_duty.csv")

POWERS = sorted(s[s.scenario == "No mitigation"].jammerPower.unique())
TOP = POWERS[-1]
DIST = list(range(10, 101, 10))
MIT = {"none": "No mitigation", "ch3": "Switch to ch 3 (half overlap)",
       "ra": "Rate adaptation", "ch6": "Switch to ch 6 (clean)"}


def num(x, nd=2):
    return None if pd.isna(x) else round(float(x), nd)


def curve(scen, pw, n, col):
    d = s[(s.scenario == scen) & (s.jammerPower == pw) & (s.nStations == n)].set_index("jammerDistance")
    return [num(d[col].get(x)) for x in DIST]


def radius(scen, pw, n, col="radius50Pct_m"):
    r = rad[(rad.scenario == scen) & (rad.jammerPower == pw) & (rad.nStations == n)][col]
    return num(r.iloc[0], 1) if len(r) else None


base = s[s.scenario == "No jammer"].set_index("nStations")
runs = duty.groupby(["jammerDuty", "seed"]).agg(tx=("txPackets", "sum"), rx=("rxPackets", "sum"))
dl = ((1 - runs.rx / runs.tx) * 100).groupby("jammerDuty").agg(["mean", "std"])
r60 = rec[(rec.jammerDistance == 60) & (rec.nStations == 5)].iloc[0]

out = {
    "dist": DIST,
    "powers": [round(p) for p in POWERS],
    "nRuns": int(s.runs.sum() + len(runs)),
    "base": {str(n): {"thr": num(base.loc[n, "throughputMbps_mean"]),
                      "delay": num(base.loc[n, "meanDelayMs_mean"]),
                      "sinr": num(base.loc[n, "sinrDb_mean"], 1),
                      "cca": num(base.loc[n, "ccaBusy_mean"] * 100, 1),
                      "retries": num(base.loc[n, "retriesPerPkt_mean"])} for n in (1, 5, 10)},
    # N = 5 curves, one per jammer power
    "loss": {str(round(p)): curve("No mitigation", p, 5, "lossPct_mean") for p in POWERS},
    "delay": {str(round(p)): curve("No mitigation", p, 5, "meanDelayMs_mean") for p in POWERS},
    "cca": {str(round(p)): [num(v * 100 if v is not None else None)
                            for v in curve("No mitigation", p, 5, "ccaBusy_mean")] for p in POWERS},
    "retries": {str(round(p)): curve("No mitigation", p, 5, "retriesPerPkt_mean") for p in POWERS},
    # same SIR formula as plot.py: stations at 10 m, exponent 3
    "sir": {str(round(p)): [round(16.0206 - p + 30 * np.log10(d / 10), 1) for d in DIST] for p in POWERS},
    # load, strongest jammer
    "lossByN": {str(n): curve("No mitigation", TOP, n, "lossPct_mean") for n in (1, 5, 10)},
    "delayByN": {str(n): curve("No mitigation", TOP, n, "meanDelayMs_mean") for n in (1, 5, 10)},
    "radius": {str(round(p)): {str(n): radius("No mitigation", p, n) for n in (1, 5, 10)} for p in POWERS},
    "radius5": {str(round(p)): radius("No mitigation", p, 5, "radius5Pct_m") for p in POWERS},
    # mitigation, strongest jammer
    "delivered": {k: [None if v is None else round(100 - v, 2)
                      for v in curve(v_, TOP, 5, "lossPct_mean")] for k, v_ in MIT.items()},
    "mitRadius": {k: {str(n): radius(v, TOP, n) for n in (5, 10)} for k, v in MIT.items()},
    "lossMit100": {k: {str(n): curve(v, TOP, n, "lossPct_mean")[-1] for n in (5, 10)} for k, v in MIT.items()},
    "recovery60": {"ch3": num(r60[MIT["ch3"]], 0), "ra": num(r60[MIT["ra"]], 0), "ch6": num(r60[MIT["ch6"]], 0)},
    "duty": {"x": [round(d * 100) for d in dl.index], "mean": [num(v, 1) for v in dl["mean"]],
             "std": [num(v, 1) for v in dl["std"]]},
    "raBaseLoss10": num(s[(s.scenario == "No jammer (rate adaptation)") & (s.nStations == 10)].lossPct_mean.iloc[0]),
}
json.dump(out, open("deck_data.json", "w"), indent=1)
print("wrote deck_data.json")
