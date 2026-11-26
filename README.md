# Interference and Jamming Mitigation in Wi-Fi Networks Using ns-3

NSS S40B, Group 6: Austria, Campos, Patricio, Parado.

An ns-3 simulation of one IEEE 802.11n access point with 1, 5 or 10 stations on 2.4 GHz
(channel 1) and a constant jammer placed 10 to 100 m from the AP at 16, 23 or 30 dBm.
Mitigations tested: switching to channel 3 (half overlap), switching to channel 6 (clean),
and Minstrel-HT rate adaptation. Test 2 repeats the study with walls, a leaky jammer,
delayed channel switching, and TCP / heavier traffic.

## Files

| File | Purpose |
|---|---|
| `wifi-jamming.cc` | ns-3 simulation; one run, appends one CSV row per station |
| `ns3-cca-busy-fix.patch` | one-line ns-3 fix needed for 1 ms jammer bursts |
| `run_all.py` | builds the simulation and runs every case in parallel |
| `plot.py` | Test 1 figures and tables from `results.csv` |
| `plot_duty.py` | pulsed-jammer figure from `results_duty.csv` |
| `plot_realistic.py` | Test 2 figures and tables from `results_realistic.csv` |

## Requirements

- ns-3.40 or newer (results were produced on ns-3-dev 3.48, optimized build)
- Python 3 with `pandas` and `matplotlib` (`pip install -r requirements.txt`)

## Setup (once)

```bash
git -C ~/ns-3-dev apply "$PWD/ns3-cca-busy-fix.patch"
(cd ~/ns-3-dev && ./ns3 configure --build-profile=optimized)
python3 -m venv ~/venv && ~/venv/bin/pip install -r requirements.txt
```

On WSL, system-wide `pip` is blocked, so use the venv as shown.

## Run

```bash
python3 run_all.py --ns3-dir ~/ns-3-dev --out results.csv
python3 run_all.py --ns3-dir ~/ns-3-dev --realistic
python3 plot.py results.csv
python3 plot_duty.py results_duty.csv
python3 plot_realistic.py results_realistic.csv results.csv
```

The first command runs 1,930 simulations (Test 1 and the pulsed jammer) and takes about
70 minutes on 8 cores. The second runs the 990 Test 2 simulations. Add `--sim-time 5 --seeds 2`
for a quick dry run.

A single run by hand:

```bash
cp wifi-jamming.cc ~/ns-3-dev/scratch/
cd ~/ns-3-dev
./ns3 run "wifi-jamming --nStations=5 --jammer=on --jammerPower=30 --jammerDistance=60 --simTime=5 --out=test.csv"
```

## Command-line options

| Option | Default | Meaning |
|---|---|---|
| `--nStations` | 5 | number of stations on a 10 m ring around the AP |
| `--jammer` | on | constant jammer on/off |
| `--jammerPower` | 16.02 | jammer power (dBm) |
| `--jammerDistance` | 10 | jammer distance from the AP (m) |
| `--jammerDuty`, `--jammerPeriod` | 1.0, 0.001 | jammer on-fraction and burst cycle (s) |
| `--channelSwitch`, `--switchChannel` | off, 3 | move the network to another channel |
| `--switchAt` | -1 | switch this many seconds after the jammer starts (-1 = from the start) |
| `--rateAdaptation` | off | Minstrel-HT instead of a fixed rate |
| `--mcs` | 7 | fixed HT MCS when rate adaptation is off |
| `--walls`, `--wallLoss` | off, 5 | 5 dB wall every 10 m beyond 12.5 m |
| `--jammerMask` | off | jammer leaks into adjacent channels (802.11 OFDM mask) |
| `--traffic`, `--rate` | udp, 1 | transport and offered load per station (Mbps) |
| `--simTime`, `--seed`, `--out` | 60, 1, wifi-jamming.csv | duration (s), RNG run, output CSV |

## Test cases

| Case | Setup |
|---|---|
| T1 | no jammer, N = 1/5/10 (also with rate adaptation) |
| T2 | jammer on channel 1 at 16, 23, 30 dBm |
| T3 | N = 1/5/10 at every power and distance |
| T4 | jammer 10 to 100 m from the AP in 10 m steps |
| T5 | 30 dBm jammer; channel 3, channel 6, or rate adaptation |
| Extra | pulsed jammer, 0 to 100% of a 100 ms cycle |
| Test 2 | walls, leaky jammer, switch after 0.1 to 5 s, TCP, 5 Mbps, MCS 0, all combined |

Each case: 60 s of traffic, 10 seeds, 1 Mbps UDP per station (1024-byte packets).

## Outputs

| File | Contents |
|---|---|
| `results.csv`, `results_duty.csv`, `results_realistic.csv` | raw per-station rows: packets, throughput, loss, delay, SINR, retries, drops, CCA busy time |
| `summary.csv`, `summary_realistic.csv` | mean and standard deviation per scenario |
| `denial_radius.csv`, `radius_realistic.csv` | distance where mean loss crosses 50% and 5% |
| `recovery.csv` | share of the jammer's damage each mitigation recovers |
| `rq1_rq3_distance.png`, `rq2_load.png`, `l1_l2.png`, `rq4_mitigation.png` | Test 1 figures |
| `duty_response.png` | pulsed jammer |
| `realistic_env.png`, `switch_time.png`, `all_realistic.png` | Test 2 figures |

## Model notes

- Path loss: log-distance, exponent 3, 40.05 dB at 1 m (2.4 GHz), plus Nakagami fading (m = 1.5).
- Jammer: `WaveformGenerator` sending back-to-back 1 ms bursts of flat noise over 2402 to 2422 MHz.
  It does not use carrier sensing.
- Carrier sensing for non-Wi-Fi energy uses the 802.11 energy-detect level of -62 dBm.
- The station ring is rotated randomly per seed; the same seed gives the same layout in every scenario.
- Channel switching in T5 is ideal (on the new channel from t = 0). Test 2 adds a delay and re-association.
- SINR is measured only on frames the AP decoded. Retries count ACK timeouts only.
- Denial radius is linearly interpolated between the 10 m grid points.
- **ns-3 fix:** `WifiPhyStateHelper::SwitchMaybeToCcaBusy` could shorten a CCA-busy period that was
  already running, which left the PHY idle mid-reception and made ns-3 abort or hang under
  frequent jammer bursts. The patch keeps the later end time. `run_all.py` will not start without it.
