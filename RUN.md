# Running on WSL (what actually worked)

ns-3 lives in `~/ns-3-dev`; this repo is cloned separately at `~/NSCom03`.
Run the Python scripts from `~/NSCom03`, not from the ns-3 directory.

## One-time setup

```bash
cd ~ && git clone https://github.com/skyparado/NSCom03   # if not already cloned
cd ~/NSCom03
python3 -m venv ~/venv && ~/venv/bin/pip install -r requirements.txt
```

WSL blocks system-wide `pip` (externally-managed-environment), so the venv is required.

## Full run

```bash
cp ~/NSCom03/wifi-jamming.cc ~/ns-3-dev/scratch/   # re-copy if you edited the .cc
~/venv/bin/python run_all.py --ns3-dir ~/ns-3-dev --out results.csv
~/venv/bin/python plot.py results.csv
~/venv/bin/python plot_distance.py results_distance.csv
~/venv/bin/python plot_duty.py results_duty.csv
```

Add `--sim-time 5` to `run_all.py` for a ~60x faster dry run.
`run_all.py` builds ns-3 but does NOT copy the .cc — copy it yourself after any edit.

## Outputs (written to the directory you run from)

results.csv, results_distance.csv, summary.csv, recovery.csv, and the PNGs.
Open figures from Windows with `explorer.exe .`
