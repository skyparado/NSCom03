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

## 60 s run results (10 seeds, N = 5 near unless noted)

- **Distance gradient (`distance_gradient.png`)** — a clean curve with seed spread:
  10 m ~96% loss, 20 m ~43%, 30 m ~8%, 40 m ~0.1%, 50 m+ 0%.
- **Duty cycle (`duty_response.png`)** — a *threshold*, not a straight line:
  duty 0.5 ~2% loss, 0.8 ~0.4%, 0.9 ~16%, 0.95 ~60%, 0.99 ~90%, 1.0 ~96%. Traffic is light
  (1 Mbps/station) so the backlog drains in the jammer's OFF gaps; only near-continuous jamming
  denies service. The knee between 0.9 and 1.0 is the headline result.
- **Mitigation (`mitigation.png`)** — channel switching helps only if the new channel is clean:
  no switch ~4% delivered (~96% loss); switch to the half-overlapping ch 3 ~24% delivered
  (~76% loss) — partial; switch to the clean ch 6 ~full recovery (no spectral overlap with the
  jammer). The contrast is the point: escaping the jammer's band works, dodging to an adjacent
  (still-overlapping) channel barely helps.

## Known limitations (state these in the paper)

- Right at the jammer (10 m, continuous) the outcome is nearly bimodal: fading decides whether a
  seed is fully denied (rx = 0) or scrapes ~8% through, so the mean there has wide error bars.
- One jammer power (4 dBm) and one traffic rate (1 Mbps/station): the duty threshold would shift
  left under heavier load. SINR/delay are missing wherever nothing got through (rx = 0).
