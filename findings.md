# Why the data changed (addressing "the results had no real meaning")

## What was wrong before

The old model produced an all-or-nothing step function: every run was either total kill
(`rx=0`) or perfect delivery (`rx=tx`), nothing in between.

1. **Recovery was 100% by construction.** Channel switching moved the BSS to channel 6, which
   does not overlap the jammer's channel 1 at all — so "mitigation" was total escape, trivially
   perfect for every distance and station count. Nothing was measured.
2. **The jammer was always-on at full power**, so inside its radius it killed every frame and
   outside it killed none — a cliff, not a curve.
3. **Seeds were meaningless.** No fading, fixed positions, fixed rate → every seed gave the
   identical `tx`/`rx`. "10 seeds" implied statistics that were really one deterministic point.

## What was changed

- **Nakagami multipath fading** added on top of log-distance path loss → per-frame SINR now
  varies, so seeds actually differ (genuine mean ± std) and the jammer's edge is a gradient.
- **`--jammerDuty`** parameter (jammer on-fraction), swept 0 → 100% near the AP → a dose-response
  curve of throughput and loss vs jamming intensity (`duty_response.png`). This is the headline
  "things that matter" result: loss rises roughly in proportion to the on-fraction.
- **Channel switch now targets channel 3**, which half-overlaps the jammer's channel 1, so
  recovery is *partial and measured* (< 100%), not a foregone conclusion — a realistic 2.4 GHz
  scenario where no clean non-overlapping channel is free.

## What to expect now (fill in with your actual numbers after the full run)

- `duty_response.png`: loss climbs from ~0% at duty 0 toward ~100% at duty 1; throughput falls
  in step. A sloped line, not a jump.
- `distance_gradient.png`: a smooth loss-vs-distance curve with real error bars (fading adds spread).
- `recovery.csv`: channel-switch recovery now below 100%, and differing by distance / station
  count — quantifying how much a half-overlapping channel actually buys you.
