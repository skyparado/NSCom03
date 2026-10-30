"""Run every test case (T1-T5) x station count x seed and collect the rows into one CSV.

Usage (from anywhere, after copying wifi-jamming.cc into <ns-3>/scratch/):
    python3 run_all.py --ns3-dir ~/ns-3-dev --out results.csv
"""
import argparse
import pathlib
import subprocess

p = argparse.ArgumentParser()
p.add_argument("--ns3-dir", default=".", help="ns-3 top-level directory (contains ./ns3)")
p.add_argument("--out", default="results.csv")
p.add_argument("--seeds", type=int, default=10)
p.add_argument("--sim-time", type=float, default=60, help="use e.g. 5 for a quick test")
args = p.parse_args()

out = pathlib.Path(args.out).resolve()
out.unlink(missing_ok=True)

# (jammer, channelSwitch, jammerDistance). T3 and T4 reuse the T2 runs at each
# station count and distance, so these five configs cover T1-T5.
configs = [
    ("off", "off", 10),  # T1 baseline (distance unused)
    ("on", "off", 10),   # T2/T3/T4 near
    ("on", "off", 40),   # T4 far
    ("on", "on", 10),    # T5 near
    ("on", "on", 40),    # T5 far
]
runs = [(c, n, s) for c in configs for n in (1, 5, 10) for s in range(1, args.seeds + 1)]

subprocess.run(["./ns3", "build"], cwd=args.ns3_dir, check=True)
for i, ((jammer, switch, dist), n, seed) in enumerate(runs, 1):
    prog = (f"wifi-jamming --nStations={n} --jammerDistance={dist} --jammer={jammer} "
            f"--channelSwitch={switch} --seed={seed} --simTime={args.sim_time} --out={out}")
    print(f"[{i}/{len(runs)}] {prog}", flush=True)
    subprocess.run(["./ns3", "run", "--no-build", prog], cwd=args.ns3_dir, check=True)

print(f"Wrote {out}")
