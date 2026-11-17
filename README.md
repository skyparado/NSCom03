# Interference and Jamming Mitigation in Wi-Fi Networks Using ns-3

NSS S40B, Group 6. One 802.11n AP with 1/5/10 stations on a 10 m ring (2.4 GHz, channel 1) and a
constant jammer (waveform generator on channel 1) placed 10 to 100 m from the AP. The jammer is
run at three powers, and three mitigations are tested against the strongest one: switching to a
half-overlapping channel (3), switching to a clean channel (6), and rate adaptation.

Results and their interpretation are in [findings.md](findings.md).

## Requirements

- ns-3 **3.40 or newer** (the code uses the `ChannelSettings` string format from 3.40).
  Results were produced with ns-3-dev at `ns-3.48-192-g9611dfcb5`, optimized build.
- **One-line ns-3 fix, `ns3-cca-busy-fix.patch`.** Stock ns-3 aborts ("Invalid WifiPhy state RX")
  or hangs in this scenario; see "ns-3 fix" below. Apply once: `git -C ~/ns-3-dev apply ns3-cca-busy-fix.patch`.
  `run_all.py` refuses to start without it.
- Python 3 with `pandas` and `matplotlib`.

## Run

```sh
git -C ~/ns-3-dev apply "$PWD/ns3-cca-busy-fix.patch"      # once
(cd ~/ns-3-dev && ./ns3 configure --build-profile=optimized)

# everything: copies wifi-jamming.cc into scratch/, builds, runs 1,930 simulations in parallel
python3 run_all.py --ns3-dir ~/ns-3-dev --out results.csv   # add --sim-time 5 --seeds 2 for a dry run
python3 plot.py results.csv
python3 plot_duty.py results_duty.csv

# or a single run by hand
cp wifi-jamming.cc ~/ns-3-dev/scratch/
./ns3 run "wifi-jamming --nStations=5 --jammer=on --jammerPower=30 --jammerDistance=60 --simTime=5 --out=/tmp/test.csv"
```

## Experiment design

Every case is 60 s of traffic, 10 seeds, 1 Mbps UDP per station (1024-byte packets) to the AP.

| Proposal case | What is run | Where to look |
|---|---|---|
| T1 baseline | no jammer, N = 1/5/10 (also with rate adaptation, as a control) | dashed line in every figure |
| T2 constant jammer | jammer on channel 1 at 16, 23 and 30 dBm | `rq1_rq3_distance.png` |
| T3 load | N = 1/5/10 at every power and distance | `rq2_load.png` |
| T4 distance | jammer 10, 20, ... 100 m from the AP (was near/far only) | `rq1_rq3_distance.png` |
| T5 mitigation | 30 dBm jammer; BSS moved to channel 3 or channel 6, or Minstrel-HT rate adaptation | `rq4_mitigation.png` |
| extra: pulsed jammer | 10 m, N = 5, jammer on 0-100% of a 100 ms cycle | `duty_response.png` |

Jammer powers: **16 dBm** is the ns-3 default Wi-Fi Tx power (the proposal's jammer: as strong as
one station); **23 dBm** is 200 mW; **30 dBm** is 1 W, a typical handheld jammer.

## Outputs

| File | Contents |
|---|---|
| `results.csv` | one row per station per run: packets, throughput, loss, delay, SINR at AP, MAC retries/drops, CCA-busy fraction, distance to jammer |
| `summary.csv` | mean and std of every metric per scenario, jammer power, distance and station count; `runsWithDelivery` = runs where any packet arrived (delay/SINR average only those) |
| `denial_radius.csv` | distance at which mean loss falls through 50% ("denial radius") and 5%, per scenario, power and station count; empty = never crosses inside 10-100 m |
| `recovery.csv` | RQ4: % of the jammer's damage each mitigation wins back (100% = baseline), per distance and station count; empty = the jammer did no damage there |
| `rq1_rq3_distance.png` | throughput, loss and delay vs jammer distance, one line per jammer power |
| `rq2_load.png` | loss and delay vs distance for 1/5/10 stations, one column per jammer power |
| `l1_l2.png` | loss vs signal-to-jammer ratio at the AP, SINR of decoded frames, MAC retries per packet (Objective 6) |
| `rq4_mitigation.png` | delivery and delay vs distance per mitigation, and the denial radius per station count |
| `duty_response.png` | loss and throughput vs jammer on-fraction |

## Modeling notes (state these in the paper)

- **Path loss and fading.** Log-distance, exponent 3, reference loss 40.05 dB at 1 m (2.4 GHz free
  space; the ns-3 default is the 5 GHz value), plus Nakagami fading with m = 1.5 at every distance.
  Each Wi-Fi frame and each jammer burst gets an independent fading draw.
- **Station layout.** The 10 m ring is rotated by a random angle per seed. With a fixed layout a
  single station always sat on the side away from the jammer, which made "N = 1" look more robust
  for a reason that had nothing to do with load. A seed gives the same layout in every scenario.
- **Jammer.** Flat noise over channel 1 (2402-2422 MHz), sent as back-to-back 1 ms bursts so that
  it fades frame by frame like the Wi-Fi links. It does no carrier sensing.
- **Carrier sensing (`CcaSensitivity` = -62 dBm).** 802.11 holds CCA busy for energy that is not a
  decoded Wi-Fi preamble only above -62 dBm (energy detect). ns-3's default instead applies the
  -82 dBm preamble threshold to all in-band energy after any Wi-Fi frame, jammer noise included,
  and holds CCA until that energy drops, i.e. until the current jammer burst ends. With that
  default (the earlier version of this code) the burst length, not the physics, decided the loss
  between 30 and 90 m: in a calibration test (N = 5, 20 s, 2 seeds) changing only the burst
  length moved the 50%-loss distance of a 16 dBm jammer from about 23 m (1 ms) to 51 m (100 ms)
  to 88 m (1 s). With -62 dBm the loss curve is nearly the same for 1, 10 and 100 ms bursts, the
  no-jammer baseline is unchanged, and `ccaBusy` is a plain energy-detect reading.
- **ns-3 fix.** `WifiPhyStateHelper::SwitchMaybeToCcaBusy` sets the end of the busy period to
  `now + duration` even when a longer busy period is already running. A new indication (each
  jammer burst start causes one) can therefore end CCA-busy in the middle of a PHY header, the PHY
  goes idle while still decoding, accepts a second frame, and ns-3 then aborts in `SwitchToRx` or
  loops forever. The patch changes that line to keep the later of the two end times. Seen on
  ns-3-dev `9611dfcb5`; before the fix 4 of 24 ten-station test runs with a 16 dBm jammer
  aborted within 10 s, after it 190 of 190 test runs and all 1,930 runs of the study finished.
- **Rate.** Fixed `HtMcs7` data / `HtMcs0` control by default, as in the proposal's scope.
  `--rateAdaptation=on` uses `MinstrelHtWifiManager` instead.
- **Channel switching** is idealized: the BSS is on the new channel from t = 0; detection time and
  switching overhead are not modeled. Channel 3 overlaps half of the jammer's band; channel 6
  overlaps none of it, and the jammer has no out-of-band leakage in this model.
- **Pulsed jammer** (`--jammerDuty`, `--jammerPeriod`): `run_all.py` uses a 100 ms cycle at 10 m.
- Jammer and traffic start at t = 1 s, after association; packets still queued 1 s after traffic
  stops count as lost. Throughput counts UDP payload only.
- SINR is measured only on frames the AP decoded, so it is biased high and missing when nothing
  gets through. `l1_l2.png` therefore also plots loss against the mean signal-to-jammer ratio
  computed from the path-loss model, which has no such bias.
- Retries count ACK timeouts; MPDUs lost inside a Block-Ack'ed A-MPDU are not counted.
- The denial radius is interpolated linearly between 10 m grid points.
