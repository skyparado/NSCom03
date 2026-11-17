# Running on WSL (what actually worked)

ns-3 lives in `~/ns-3-dev`; this repo is cloned separately at `~/NSCom03`.
Run the Python scripts from `~/NSCom03`, not from the ns-3 directory.

## One-time setup

```bash
cd ~ && git clone https://github.com/skyparado/NSCom03   # if not already cloned
cd ~/NSCom03
python3 -m venv ~/venv && ~/venv/bin/pip install -r requirements.txt
git -C ~/ns-3-dev apply ~/NSCom03/ns3-cca-busy-fix.patch    # ns-3 fix, see README
```

WSL blocks system-wide `pip` (externally-managed-environment), so the venv is required.

## Full run

```bash
~/venv/bin/python run_all.py --ns3-dir ~/ns-3-dev --out results.csv
~/venv/bin/python plot.py results.csv
~/venv/bin/python plot_duty.py results_duty.csv
```

`run_all.py` copies `wifi-jamming.cc` into `<ns-3>/scratch/`, builds, and runs 1,930 simulations
in parallel (one per CPU core minus one; `--jobs N` to change). About 70 minutes on 8 cores.
Add `--sim-time 5 --seeds 2` for a dry run that takes about a minute.

## Outputs (written to the directory you run from)

results.csv, results_duty.csv, summary.csv, denial_radius.csv, recovery.csv, and the PNGs.
Open figures from Windows with `explorer.exe .`
