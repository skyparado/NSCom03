"""Run every test case (T1-T5) x station count x seed and collect the rows into one CSV.

Usage (from anywhere, after copying wifi-jamming.cc into <ns-3>/scratch/):
    python3 run_all.py --ns3-dir ~/ns-3-dev --out results.csv

The jammer Tx power is calibrated (default 4 dBm, not the ns-3 default 16 dBm). At 16 dBm the
jammer is as strong as the AP and denies service out to ~80 m, so distance makes no difference
indoors. At 4 dBm its effective radius is ~40 m, so loss falls off with distance (RQ3):
  10 m ~100%, 20 m ~80%, 30 m ~40%, 40 m ~6%, 50 m+ ~0%.
"""
import argparse
import pathlib
import subprocess

p = argparse.ArgumentParser()
p.add_argument("--ns3-dir", default=".", help="ns-3 top-level directory (contains ./ns3)")
p.add_argument("--out", default="results.csv")
p.add_argument("--seeds", type=int, default=10)
p.add_argument("--sim-time", type=float, default=60, help="use e.g. 5 for a quick test")
p.add_argument("--jammer-power", type=float, default=4.0, help="jammer Tx power in dBm (calibrated)")
args = p.parse_args()

out = pathlib.Path(args.out).resolve()
out.unlink(missing_ok=True)
dist_out = out.with_name(out.stem + "_distance" + out.suffix)
dist_out.unlink(missing_ok=True)
duty_out = out.with_name(out.stem + "_duty" + out.suffix)
duty_out.unlink(missing_ok=True)

PW = args.jammer_power
# near = 10 m (inside the jammer's radius), far = 40 m (at its edge).
# (jammer, channelSwitch, jammerDistance) -> the five configs covering T1-T5.
configs = [
    ("off", "off", 10),  # T1 baseline (distance unused)
    ("on", "off", 10),   # T2/T3 near
    ("on", "off", 40),   # T4 far
    ("on", "on", 10),    # T5 near
    ("on", "on", 40),    # T5 far
]
# each run: (jammer, switch, dist, duty), nStations, seed, target CSV.
runs = [(c + (1.0,), n, s, out) for c in configs for n in (1, 5, 10) for s in range(1, args.seeds + 1)]

# RQ3 distance sweep: jammed only, N=5, across the indoor range -> results_distance.csv.
runs += [(("on", "off", d, 1.0), 5, s, dist_out)
         for d in (10, 20, 30, 40, 50, 60) for s in range(1, args.seeds + 1)]

# Intensity sweep: near jammer, N=5, varying on-fraction -> results_duty.csv (the dose-response curve).
# Sampled finely near 1.0: light traffic drains in the jammer's OFF gaps, so denial only
# appears as the duty cycle approaches continuous -- the knee is between 0.9 and 1.0.
runs += [(("on", "off", 10, duty), 5, s, duty_out)
         for duty in (0.0, 0.5, 0.8, 0.9, 0.95, 0.99, 1.0) for s in range(1, args.seeds + 1)]

subprocess.run(["./ns3", "build"], cwd=args.ns3_dir, check=True)
for i, ((jammer, switch, dist, duty), n, seed, target) in enumerate(runs, 1):
    prog = (f"wifi-jamming --nStations={n} --jammerDistance={dist} --jammer={jammer} "
            f"--channelSwitch={switch} --jammerPower={PW} --jammerDuty={duty} --seed={seed} "
            f"--simTime={args.sim_time} --out={target}")
    print(f"[{i}/{len(runs)}] {prog}", flush=True)
    subprocess.run(["./ns3", "run", "--no-build", prog], cwd=args.ns3_dir, check=True)

print(f"Wrote {out}, {dist_out} and {duty_out}")
