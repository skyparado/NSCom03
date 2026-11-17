# Findings

1,930 runs: 60 s each, 10 seeds per case, mean ± standard deviation over seeds. Numbers are for
5 stations unless stated. Everything here comes from `summary.csv`, `denial_radius.csv`,
`recovery.csv` and `results_duty.csv`, which `plot.py` regenerates from `results.csv`.

**Denial radius** below means the jammer distance at which mean packet loss falls through 50%.

## Answers to the research questions

### RQ1. How much does constant jamming hurt?

Inside its radius a constant jammer denies service completely; outside it the network recovers
loss first and delay much later.

| Jammer distance | 16 dBm loss | 23 dBm loss | 30 dBm loss |
|---|---|---|---|
| 10 m | 100% | 100% | 100% |
| 20 m | 72% | 100% | 100% |
| 30 m | 17% | 89% | 100% |
| 40 m | 0.2% | 44% | 99.8% |
| 50 m | 0% | 15% | 99.7% |
| 60 m | 0% | 0.3% | 74% |
| 70 m | 0% | 0.1% | 45% |
| 80 m | 0% | 0% | 21% |
| 90 m | 0% | 0% | 1.0% |
| 100 m | 0% | 0% | 0.7% |

Baseline without a jammer: 5.0 Mbps delivered, 0% loss, 1.2 ms mean delay, 38.3 dB SINR.

Delay is the last metric to recover. With the 30 dBm jammer at 100 m, loss is back under 1% but
mean delay is 12.8 ms, about 11 times the baseline. The same pattern holds for the weaker
jammers: 16 dBm at 40 m gives 0.2% loss and 6.0 ms (5 times baseline); 23 dBm at 60 m gives
0.3% loss and 11.0 ms (9 times baseline).

### RQ3. How does jammer distance change the damage?

Loss falls from 100% to about 0% over a band 30 to 40 m wide, and where that band sits
depends on jammer power (`rq1_rq3_distance.png`).

| Jammer power | Denial radius (50% loss) | Loss below 5% beyond |
|---|---|---|
| 16 dBm (same as a station) | 24 m | 37 m |
| 23 dBm (200 mW) | 39 m | 57 m |
| 30 dBm (1 W) | 68 m | 88 m |

- Each 7 dB of jammer power multiplied the denial radius by 1.6 and 1.8. Path loss with
  exponent 3 predicts 1.7.
- Plotted against the mean signal-to-jammer ratio (SIR) at the AP, the three curves fall on top of
  each other (`l1_l2.png`, top left). Loss is about 100% below 7 dB, crosses 50% at about 11 dB,
  and is under 1% above about 16 dB. That threshold, not a distance in metres, is the result that
  carries over to other powers and layouts for this fixed rate (HT MCS 7).
- The professor's suggestion to extend the sweep was what made this visible: at 30 dBm the whole
  transition lies between 50 and 90 m.

### RQ2. Does the number of stations matter?

Yes, at the edge of the jammer's reach. It does not matter deep inside the radius, where loss is
100% for any load (`rq2_load.png`).

| Jammer power | Denial radius, 1 station | 5 stations | 10 stations |
|---|---|---|---|
| 16 dBm | 21 m | 24 m | 26 m |
| 23 dBm | 38 m | 39 m | 44 m |
| 30 dBm | 63 m | 68 m | 76 m |

- Ten stations push the denial radius out by 15 to 25% compared with one station.
- Delay is far more sensitive to load than loss. With the 30 dBm jammer at 100 m, mean delay is
  4.6 ms with 1 station, 12.8 ms with 5 and 141 ms with 10 (baselines: 0.2, 1.2 and 2.1 ms).
- At 90 m from the 30 dBm jammer, loss is about 1% with 1 or 5 stations and 19% with 10.
- The single-station curves are noisy (standard deviation up to 50 points): one station is either
  on the jammer's side of the ring or not, so a run is close to all-or-nothing. Read the N = 1
  radius as approximate.

### RQ4. How much does channel switching recover?

It depends entirely on whether the new channel is clear of the jammer (`rq4_mitigation.png`,
30 dBm jammer).

| Mitigation | Denial radius, 5 stations | 10 stations |
|---|---|---|
| None | 68 m | 76 m |
| Switch to channel 3 (overlaps half the jammer's band) | 55 m | 61 m |
| Rate adaptation (Minstrel-HT), no switch | 43 m | 83 m |
| Switch to channel 6 (no overlap) | none | none |

- **Clean channel: full recovery.** On channel 6 loss is 0% and delay equals the baseline at
  every distance and station count, including 10 m from a 1 W jammer.
- **Half-overlapping channel: a 3 dB discount.** Channel 3 still receives half the jammer's
  power. The denial radius shrinks by about 20% (68 to 55 m), which is what 3 dB buys on this
  channel. Inside 30 m it recovers nothing; at 60 m it wins back 49% of the lost packets.
- **Rate adaptation helps a light network and hurts a loaded one.** With 5 stations it cuts the
  denial radius from 68 to 43 m and recovers 94% of the lost packets at 60 m. With 10 stations
  it makes things worse from 80 m outward: 29% loss at 100 m against 3% at the fixed rate. Without a
  jammer the same 10 stations lose 0.1%, so this is not a rate-adaptation baseline problem. The
  likely cause is that slower rates need more airtime than 10 stations leave free, but we did not
  measure airtime, so treat that explanation as a hypothesis.
- Nothing short of leaving the jammer's band helps inside the energy-detect zone (see below):
  within 30 m of the 1 W jammer, channel 3 and rate adaptation both recover 6% or less.

`recovery.csv` has the recovery percentage for every distance and station count.

## Why it happens: Layer 1 and Layer 2 (Objective 6)

The jammer hurts in two different ways, and the data separates them (`l1_l2.png`, 30 dBm).

| Distance | Stations sense medium busy | MAC retries per packet | Loss | Mechanism |
|---|---|---|---|---|
| 10 to 30 m | 88 to 99% | about 0 | 100% | Layer 2: energy detect keeps CCA busy, stations never transmit |
| 40 to 50 m | 48 to 71% | under 0.5 | about 100% | Both: some stations blocked, the rest drowned out |
| 60 to 90 m | 10 to 30% | 10 to 13 | 74% to 1% | Layer 1: stations transmit, frames arrive below the SINR the rate needs |
| baseline | 3% | 1.1 | 0% | |

- Near the jammer its power at the stations is above the −62 dBm energy-detect threshold.
  CSMA/CA defers indefinitely, so there are no transmissions to retry: 100% loss with zero
  retries is the signature of a Layer 2 denial.
- Farther out the stations can transmit, but the AP receives the frames at too low a SINR.
  Retries climb to 13 per packet, against 1.1 without a jammer.
- Frames the AP did decode averaged 18 to 30 dB SINR, against 38.3 dB without a jammer.

## Pulsed jammer (extra experiment)

16 dBm jammer at 10 m, 5 stations, on for a fraction of each 100 ms cycle (`duty_response.png`).

| On-fraction | 50% | 80% | 90% | 95% | 99% | 100% |
|---|---|---|---|---|---|---|
| Loss | 7% ± 10 | 3% ± 6 | 22% | 67% | 100% | 100% |

At this light load (1 Mbps per station) the queues drain in the gaps, so the jammer has to be on
at least 90% of the time before loss becomes serious. The 50% and 80% points are within each
other's spread.

## What changed from the first results, and why the numbers differ

The first deck reported that a 16 dBm jammer at 40 m caused 99.5% loss. In this data set the same
jammer at 40 m causes 0.2% loss (and 5 times the baseline delay). The earlier number was produced
by the simulator setup, not by the radio physics:

1. **Carrier sensing.** ns-3's default keeps a station's CCA busy while total in-band energy is
   above −82 dBm after any Wi-Fi frame, and counts jammer noise in that total. 802.11 only
   requires that for non-Wi-Fi energy above −62 dBm. The old runs therefore froze stations on a
   jammer 20 dB too weak to trip a real radio's energy detect, and the length of the jammer's
   bursts decided how long: changing only the burst length moved the 50%-loss distance from about
   23 m to 88 m. The model now uses −62 dBm. The no-jammer baseline is identical either way.
2. **Fading and layout.** The first runs had no fading and a fixed layout, so all 10 seeds gave
   the same result. Now each frame fades (Nakagami, m = 1.5) and the station ring is rotated per
   seed, so the standard deviations are real.
3. **Distance and power.** Two positions (10 and 40 m) at one power became ten positions (10 to
   100 m) at three powers.
4. **Mitigation.** The clean-channel switch is kept, and a half-overlapping channel and rate
   adaptation are added so that recovery is measured, not guaranteed by construction.
5. **ns-3 bug.** A one-line fix (`ns3-cca-busy-fix.patch`) was needed; without it runs aborted or
   hung. See README.

## Limitations to state in the paper

- Simulation only. Absolute distances depend on the path-loss exponent (3) and the ns-3 error
  model; the SIR threshold is the more portable result.
- Fixed rate HT MCS 7 except in the rate-adaptation case. A slower fixed rate would tolerate a
  lower SIR and have a smaller denial radius.
- Channel switching is idealized: the network is already on the new channel at t = 0. Detection
  time and switching overhead are not modeled, and the jammer does not follow.
- The jammer has a brick-wall 20 MHz spectrum. A real jammer leaks into adjacent channels, so
  channel 3 would do somewhat worse than shown, and channel 6 is only clean if the jammer is
  narrowband.
- Light UDP uplink traffic only (1 Mbps per station). TCP and heavier loads were not tested.
- The denial radius is interpolated between 10 m grid points, so it is good to a few metres.
- SINR is measured only on frames that were decoded, so it is biased high under heavy jamming.
