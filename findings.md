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

## What the 5 s dry run showed (replace with 60 s numbers for the paper)

- **Distance gradient (`distance_gradient.png`)** — now a clean curve with seed-to-seed spread:
  10 m ~95-100% loss, 20 m ~50%, 30 m ~10%, 40 m ~1%, 50 m+ 0%.
- **Channel switch (`recovery.csv`)** — partial, not 100%: near N=5 goes from ~3% delivered
  (jammed) to ~20-29% delivered (switched). A half-overlapping channel helps but does not cure.
- **Duty cycle (`duty_response.png`)** — a *threshold*, not a straight line: loss stays small
  until the jammer is nearly continuous, then collapses near duty 1.0. The traffic is light
  (1 Mbps/station), so during the jammer's OFF gaps the backlog drains; only near-continuous
  jamming denies service. The sweep samples 0.9/0.95/0.99/1.0 to show the knee.

This is the finding to lead with: jamming damage depends on *distance* (smooth) and on the
*jammer's continuity* (threshold), and channel switching recovers only part of the loss.
