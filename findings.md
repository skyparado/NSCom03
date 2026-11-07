# Findings (full run, simTime=60, 10 seeds)

## Channel-switch recovery (recovery.csv)

| jammer | nStations | throughput recovery | loss recovery |
|--------|-----------|---------------------|---------------|
| near   | 1 / 5 / 10 | 100% | 100% |
| far    | 5 / 10     | 100% | 100% |
| far    | 1          | NaN  | NaN  |

- **Near jammer (10 m):** channel switching to channel 6 fully restores service
  (100% recovery) at every station count — the key RQ4 mitigation result.
- **Far jammer (40 m):** at 1 station the jammer causes no measurable damage, so
  "percent recovered" is 0/0 = NaN. Report as "no measurable damage," not a gap.

## Distance gradient (results_distance.csv)

At 60 m the jammer has no effect: `tx == rx` (full delivery). This confirms the
4 dBm calibration gives a ~40 m effective radius, so loss falls off with distance
(10 m ~100% loss down to ~0% past 50 m), as intended for RQ3.
