import argparse
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor

p = argparse.ArgumentParser()
p.add_argument("--ns3-dir", default=".", help="ns-3 top-level directory (contains ./ns3)")
p.add_argument("--out", default="results.csv")
p.add_argument("--seeds", type=int, default=10)
p.add_argument("--sim-time", type=float, default=60, help="use e.g. 5 for a quick test")
p.add_argument("--realistic", action="store_true", help="run the test2 realism set instead")
p.add_argument("--jobs", type=int, default=max(1, (os.cpu_count() or 2) - 1), help="parallel runs")
args = p.parse_args()

ns3 = pathlib.Path(args.ns3_dir).expanduser().resolve()
out = pathlib.Path(args.out).resolve()
duty_out = out.with_name(out.stem + "_duty" + out.suffix)

DISTANCES = range(10, 101, 10)
STATIONS = (1, 5, 10)
SEEDS = range(1, args.seeds + 1)
POWERS = (16.0206, 23, 30)
MITIGATIONS = ("--channelSwitch=on --switchChannel=3",
               "--channelSwitch=on --switchChannel=6",
               "--rateAdaptation=on")

grid = [f"--nStations={n} --seed={s}" for n in STATIONS for s in SEEDS]
main = [f"{g} --jammer=off" for g in grid]
main += [f"{g} --jammer=on --jammerPower={pw} --jammerDistance={d}"
         for g in grid for pw in POWERS for d in DISTANCES]
main += [f"{g} --jammer=on --jammerPower={POWERS[-1]} --jammerDistance={d} {m}"
         for g in grid for m in MITIGATIONS for d in DISTANCES]
main += [f"{g} --jammer=off --rateAdaptation=on" for g in grid]
J30 = f"--jammer=on --jammerPower={POWERS[-1]}"
SW6 = "--channelSwitch=on --switchChannel=6"
REAL = "--walls=on --jammerMask=on --rateAdaptation=on --traffic=tcp"
realistic = [f"--nStations=5 --seed={s} {J30} --jammerDistance={d} {x}"
             for s in SEEDS for d in DISTANCES for x in (
                 "--walls=on",
                 f"{SW6.replace('6', '3')} --jammerMask=on",
                 f"{SW6} --jammerMask=on",
                 "--traffic=tcp",
                 "--rate=5",
                 "--mcs=0",
                 REAL,
                 f"{REAL} {SW6} --switchAt=1")]
realistic += [f"--nStations={n} --seed={s} {J30} --jammerDistance=10 {SW6} --switchAt={t}"
              for n in STATIONS for s in SEEDS for t in (0.1, 0.5, 1, 2, 5)]
realistic += [f"--nStations=5 --seed={s} --jammer=off {x}"
              for s in SEEDS for x in ("--traffic=tcp", "--rate=5", "--mcs=0", REAL)]
if args.realistic:
    main, duty = realistic, []
    out = out.with_name("results_realistic.csv")

duty = [f"--nStations=5 --seed={s} --jammer=on --jammerPower={POWERS[0]} --jammerDistance=10 "
        f"--jammerPeriod=0.1 --jammerDuty={dc}"
        for dc in (0.0, 0.5, 0.8, 0.9, 0.95, 0.99, 1.0) for s in SEEDS]


crashed = []


def sweep(runs, target, tmp):
    def one(job):
        i, flags = job
        part = tmp / f"{target.stem}-{i}.csv"
        retry = re.sub(r"--seed=(\d+)", lambda m: f"--seed={int(m[1]) + 1000}", flags)
        for attempt in (flags, retry):
            r = subprocess.run(["./ns3", "run", "--no-build",
                                f"wifi-jamming {attempt} --simTime={args.sim_time} --out={part}"],
                               cwd=ns3, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
            if r.returncode == 0:
                return part
            crashed.append(attempt)
        raise RuntimeError(f"wifi-jamming {attempt} failed twice:\n{r.stderr[-2000:]}")

    with ThreadPoolExecutor(args.jobs) as pool, open(target, "w") as f:
        for k, part in enumerate(pool.map(one, enumerate(runs))):
            lines = part.read_text().splitlines(keepends=True)
            f.writelines(lines if k == 0 else lines[1:])
            print(f"\r{target.name}: {k + 1}/{len(runs)}", end="", flush=True)
    print()


here = pathlib.Path(__file__).resolve().parent
patch = here / "ns3-cca-busy-fix.patch"
# Refuse to run unless the CCA-busy patch is already applied to ns-3.
if subprocess.run(["git", "apply", "--reverse", "--check", str(patch)], cwd=ns3,
                  capture_output=True).returncode:
    sys.exit(f"ns-3 needs a one-line fix or runs abort/hang (see README). Apply it once with:\n"
             f"  git -C {ns3} apply {patch}")
shutil.copy(here / "wifi-jamming.cc", ns3 / "scratch")
subprocess.run(["./ns3", "build"], cwd=ns3, check=True)
with tempfile.TemporaryDirectory() as tmp:
    sweep(main, out, pathlib.Path(tmp))
    if duty:
        sweep(duty, duty_out, pathlib.Path(tmp))
print(f"Wrote {out}" + ("" if args.realistic else f" and {duty_out}"))
print(f"{len(crashed)} run(s) aborted inside ns-3 and were redone with seed + 1000:", *crashed, sep="\n  ")
