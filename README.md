# Interference and Jamming Mitigation in Wi-Fi Networks Using ns-3

NSS S40B, Group 6. One 802.11n AP with 1/5/10 stations on 2.4 GHz, a constant jammer
(waveform generator, channel 1) at 10 m or 40 m, and channel switching (to channel 6) as the mitigation.

## Requirements

- ns-3 **3.40 or newer** (the code uses the `ChannelSettings` string format from 3.40).
  ns-3 version used for the reported results: `ns-3.__` (fill this in).
- Python 3 with `pandas` and `matplotlib`.

## Run

```sh
cp wifi-jamming.cc ~/ns-3-dev/scratch/
cd ~/ns-3-dev && ./ns3 configure --build-profile=optimized && ./ns3 build

# one quick run to check it works
./ns3 run "wifi-jamming --nStations=5 --jammer=on --simTime=5 --out=/tmp/test.csv"

# all test cases: 5 configs x 3 station counts x 10 seeds = 150 runs
python3 run_all.py --ns3-dir ~/ns-3-dev --out results.csv   # add --sim-time 5 for a dry run
python3 plot.py results.csv
```

The jammer power is calibrated to **4 dBm** (`run_all.py --jammer-power`). At the ns-3 default
(16 dBm) the jammer denies service out to ~80 m, so distance makes no difference indoors; at 4 dBm
its radius is ~40 m, giving a loss-vs-distance gradient (10 m ~100% → 50 m ~0%). Plot it with
`python3 plot_distance.py results_distance.csv`.

## Outputs

| File | Contents |
|---|---|
| `results.csv` | one row per station per run: packets, throughput, loss, delay, SINR at AP, MAC retries/drops, CCA-busy fraction, distance to jammer |
| `summary.csv` | mean and std per scenario and station count; `runsWithDelivery` = runs where any packet arrived (delay/SINR average only those) |
| `recovery.csv` | RQ4: % of the jamming damage recovered by channel switching (100% = baseline) |
| `t1_t2.png` | T1 vs T2 |
| `t3_load.png` | T3, per-station throughput vs number of stations |
| `t4_distance.png` | T4, near vs far jammer |
| `t5_switch.png` | T5, all scenarios incl. far |
| `l1_l2.png` | SINR, retries per packet, CCA busy time (Objective 6) |
| `per_station.png` | loss and SINR vs each station's distance to the jammer (RQ3) |
| `distance_gradient.png` | RQ3: packet loss and throughput vs jammer distance (10-60 m) |

## Modeling notes (state these in the paper)

- Log-distance path loss, reference loss 40.05 dB at 1 m (2.4 GHz free space; the ns-3 default is the 5 GHz value).
- Fixed rate: `ConstantRateWifiManager`, HtMcs7 data / HtMcs0 control.
- Jammer and traffic start at t = 1 s, after association; traffic runs `simTime` seconds; packets still queued 1 s after traffic stops count as lost.
- Throughput counts UDP payload only (no headers).
- SINR is measured only on frames the AP decoded, so it is biased high and missing when nothing gets through.
- Retries count ACK timeouts; MPDUs lost inside a Block-Ack'ed A-MPDU are not counted.
- CCA busy = fraction of 1 ms samples in which a station senses the medium busy without decoding a frame.
