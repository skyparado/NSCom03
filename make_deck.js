// Build the results deck from deck_data.json (run deck_data.py first).
// Usage: node make_deck.js [out.pptx]      needs: npm install pptxgenjs
const pptxgen = require("pptxgenjs");
const D = require("./deck_data.json");

const OUT = process.argv[2] || "NSCom03_deck_v3.pptx";
const C = {
  dark: "141B2D", ink: "1F2937", muted: "6B7280", card: "F1F4F9", line: "D5DBE5", white: "FFFFFF",
  accent: "EB6834", good: "1BAF7A", head: "123A6B",
  power: ["EDA100", "EB6834", "A8201A"], load: ["8FBCF0", "2A78D6", "123A6B"],
  mit: { none: "EB6834", ch3: "EDA100", ra: "7A5CD6", ch6: "1BAF7A" },
};
const HEAD = "Cambria", BODY = "Calibri";
const P = D.powers.map(String);            // ["16","23","30"]
const TOP = P[P.length - 1];
const DL = D.dist.map((d) => `${d}`);
const r0 = (x) => (x == null ? "none" : `${Math.round(x)} m`);
const f1 = (x) => (x == null ? "n/a" : x.toFixed(1));
const pct = (x) => (x == null ? "n/a" : x < 1 ? `${x.toFixed(1)}%` : `${Math.round(x)}%`);
const at = (arr, d) => arr[D.dist.indexOf(d)];
const b5 = D.base["5"];

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
pres.title = "Interference and Jamming Mitigation in Wi-Fi Networks Using ns-3";
pres.theme = { headFontFace: HEAD, bodyFontFace: BODY };

pres.defineSlideMaster({
  title: "CONTENT",
  background: { color: C.white },
  objects: [
    { text: { text: "NSS S40B · Group 6", options: { x: 0.6, y: 7.0, w: 5, h: 0.3, fontFace: BODY, fontSize: 10, color: C.muted, margin: 0 } } },
    { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.4, w: 12.1, h: 0.8, fontFace: HEAD, fontSize: 30, bold: true, color: C.head, valign: "middle", margin: 0 }, text: "" } },
  ],
  slideNumber: { x: 12.2, y: 7.0, w: 0.5, h: 0.3, fontFace: BODY, fontSize: 10, color: C.muted, align: "right" },
});
pres.defineSlideMaster({ title: "DARK", background: { color: C.dark }, objects: [] });

const tb = (s, text, o) => s.addText(text, { isTextBox: true, fontFace: BODY, fontSize: 14, color: C.ink, margin: 0, valign: "top", ...o });
const card = (s, x, y, w, h, fill = C.card) => s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: fill }, line: { color: fill }, rectRadius: 0.08 });
const takeaway = (s, text, fill = "E8F5EF") => { card(s, 0.6, 6.25, 12.1, 0.6, fill); tb(s, text, { x: 0.85, y: 6.25, w: 11.6, h: 0.6, bold: true, valign: "middle" }); };
const content = (title) => { const s = pres.addSlide({ masterName: "CONTENT" }); s.addText(title, { placeholder: "title" }); return s; };
const stat = (s, x, y, w, big, small, color) => {
  card(s, x, y, w, 1.05);
  tb(s, big, { x: x + 0.25, y: y + 0.12, w: w - 0.4, h: 0.5, fontFace: HEAD, fontSize: 26, bold: true, color });
  tb(s, small, { x: x + 0.25, y: y + 0.62, w: w - 0.4, h: 0.35, fontSize: 12, color: C.muted });
};
const bullets = (s, items, o) => tb(s, items.map((t, i) => ({
  text: typeof t === "string" ? t : t.text,
  options: { bullet: true, breakLine: i < items.length - 1, paraSpaceAfter: 8, ...(typeof t === "string" ? {} : t.options) },
})), o);

function chartOpts(o = {}) {
  return {
    catAxisLabelColor: C.muted, valAxisLabelColor: C.muted, catAxisLabelFontSize: 11, valAxisLabelFontSize: 11,
    catAxisLabelFontFace: BODY, valAxisLabelFontFace: BODY, legendFontFace: BODY, legendFontSize: 11, legendColor: C.ink,
    valGridLine: { color: "E5E7EB", size: 0.75 }, catGridLine: { style: "none" },
    catAxisLineShow: true, valAxisLineShow: false, showLegend: true, legendPos: "b",
    showCatAxisTitle: true, showValAxisTitle: true, catAxisTitleColor: C.muted, valAxisTitleColor: C.muted,
    catAxisTitleFontSize: 11, valAxisTitleFontSize: 11, catAxisTitleFontFace: BODY, valAxisTitleFontFace: BODY,
    lineSize: 2.25, lineDataSymbolSize: 6, ...o,
  };
}
// pptxgenjs can't take null in line data; cut series at the first gap so nothing is invented.
const series = (name, values) => ({ name, labels: DL, values: values.map((v) => (v == null ? "" : v)) });

// 1. Title
{
  const s = pres.addSlide({ masterName: "DARK" });
  tb(s, "Interference and Jamming Mitigation in Wi-Fi Networks Using ns-3", { x: 0.8, y: 2.0, w: 9.5, h: 1.6, fontFace: HEAD, fontSize: 38, bold: true, color: C.white });
  tb(s, `A constant jammer swept from 10 to 100 m at three powers, and three ways to fight it: ${D.nRuns.toLocaleString("en-US")} ns-3 runs`, { x: 0.8, y: 3.75, w: 9.5, h: 0.8, fontSize: 18, color: "C9D2E3" });
  tb(s, "NSS S40B  ·  Group 6", { x: 0.8, y: 5.3, w: 8, h: 0.4, fontSize: 16, bold: true, color: C.good });
  tb(s, "Austria  ·  Campos  ·  Parado  ·  Patricio  ·  De La Salle University", { x: 0.8, y: 5.7, w: 9, h: 0.4, fontSize: 14, color: "C9D2E3" });
  // motif: jammer rings
  [3.2, 2.3, 1.4].forEach((d, i) => s.addShape(pres.shapes.OVAL, { x: 11.1 - d / 2, y: 3.75 - d / 2, w: d, h: d, fill: { color: C.accent, transparency: 70 + i * 10 }, line: { color: C.accent, transparency: 40 } }));
  s.addShape(pres.shapes.OVAL, { x: 10.75, y: 3.4, w: 0.7, h: 0.7, fill: { color: C.accent }, line: { color: C.accent } });
  tb(s, "JAM", { x: 10.75, y: 3.4, w: 0.7, h: 0.7, fontSize: 11, bold: true, color: C.white, align: "center", valign: "middle" });
  s.addNotes(`All numbers in this deck come from ${D.nRuns} simulation runs (60 s each, 10 seeds per case), regenerated by run_all.py, plot.py, deck_data.py and make_deck.js.`);
}

// 2. Summary
{
  const s = content("Four questions, four answers");
  const l5 = D.loss;
  const qa = [
    ["RQ1", "How much does constant jamming hurt?", `Inside the jammer's radius, 100% loss. Outside it, loss recovers first: at 100 m from the ${TOP} dBm jammer, loss is ${pct(at(l5[TOP], 100))} but delay is ${f1(at(D.delay[TOP], 100))} ms, ${Math.round(at(D.delay[TOP], 100) / b5.delay)}× the baseline.`],
    ["RQ2", "Does the number of stations matter?", `At the edge, yes. Ten stations push the denial radius from ${r0(D.radius[TOP]["1"])} (1 station) to ${r0(D.radius[TOP]["10"])}, and multiply the delay.`],
    ["RQ3", "How does jammer distance change the damage?", `Denial radius is ${P.map((p) => r0(D.radius[p]["5"])).join(", ")} for a ${P.join(", ")} dBm jammer. Loss crosses 50% at a signal-to-jammer ratio of about 11 dB.`],
    ["RQ4", "How much does channel switching recover?", `A clean channel recovers everything. A half-overlapping channel only shrinks the denial radius from ${r0(D.mitRadius.none["5"])} to ${r0(D.mitRadius.ch3["5"])}.`],
  ];
  qa.forEach(([q, ask, ans], i) => {
    const x = 0.6 + (i % 2) * 6.15, y = 1.5 + Math.floor(i / 2) * 2.5;
    card(s, x, y, 5.95, 2.3);
    tb(s, q, { x: x + 0.3, y: y + 0.25, w: 1, h: 0.4, fontFace: HEAD, fontSize: 20, bold: true, color: C.accent });
    tb(s, ask, { x: x + 1.2, y: y + 0.3, w: 4.5, h: 0.4, fontSize: 13, italic: true, color: C.muted });
    tb(s, ans, { x: x + 0.3, y: y + 0.85, w: 5.35, h: 1.3, fontSize: 15 });
  });
  s.addNotes("Denial radius = the jammer distance at which mean packet loss falls through 50%. Numbers are for 5 stations unless stated.");
}

// 3. Setup
{
  const s = content("What we simulated");
  // diagram: AP + ring of stations, jammer on an axis
  const cx = 2.4, cy = 3.4;
  s.addShape(pres.shapes.OVAL, { x: cx - 1.1, y: cy - 1.1, w: 2.2, h: 2.2, fill: { color: C.card }, line: { color: C.line, dashType: "dash" } });
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * 2 * Math.PI;
    s.addShape(pres.shapes.OVAL, { x: cx + 1.1 * Math.cos(a) - 0.14, y: cy + 1.1 * Math.sin(a) - 0.14, w: 0.28, h: 0.28, fill: { color: C.load[1] }, line: { color: C.white } });
  }
  s.addShape(pres.shapes.OVAL, { x: cx - 0.35, y: cy - 0.35, w: 0.7, h: 0.7, fill: { color: C.head }, line: { color: C.head } });
  tb(s, "AP", { x: cx - 0.35, y: cy - 0.35, w: 0.7, h: 0.7, fontSize: 12, bold: true, color: C.white, align: "center", valign: "middle" });
  s.addShape(pres.shapes.LINE, { x: cx + 0.35, y: cy, w: 2.4, h: 0, line: { color: C.accent, width: 1.5, dashType: "dash", endArrowType: "none" } });
  s.addShape(pres.shapes.OVAL, { x: cx + 2.75, y: cy - 0.35, w: 0.7, h: 0.7, fill: { color: C.accent }, line: { color: C.accent } });
  tb(s, "JAM", { x: cx + 2.75, y: cy - 0.35, w: 0.7, h: 0.7, fontSize: 11, bold: true, color: C.white, align: "center", valign: "middle" });
  tb(s, "10 to 100 m", { x: cx + 1.0, y: cy - 0.5, w: 1.6, h: 0.3, fontSize: 12, color: C.accent, bold: true, align: "center" });
  tb(s, "1, 5 or 10 stations on a 10 m ring, rotated at random per seed; uplink UDP to the AP", { x: 0.6, y: 5.0, w: 5.2, h: 0.8, fontSize: 13, color: C.muted });

  const rows = [
    ["Simulator", "ns-3 (3.48 development branch) + one-line CCA fix; FlowMonitor"],
    ["Network", "IEEE 802.11n, 2.4 GHz, 20 MHz, channel 1, fixed HT MCS 7"],
    ["Traffic", "UDP uplink, 1 Mbps per station, 1024-byte packets"],
    ["Channel", "Log-distance path loss (exponent 3), Nakagami fading (m = 1.5)"],
    ["Jammer", `Constant noise on channel 1 at ${P.join(", ")} dBm`],
    ["Mitigations", "Switch to channel 3 (half overlap) or 6 (clean); Minstrel-HT"],
    ["Runs", `60 s each, 10 seeds per case, ${D.nRuns.toLocaleString("en-US")} runs`],
  ].map(([k, v]) => [{ text: k, options: { bold: true, color: C.head } }, { text: v }]);
  s.addTable(rows, { x: 6.3, y: 1.5, w: 6.4, colW: [1.5, 4.9], fontFace: BODY, fontSize: 13, color: C.ink, border: { type: "solid", pt: 0.75, color: C.line }, fill: { color: C.white }, margin: 0.08, rowH: 0.55 });
  takeaway(s, `Baseline without a jammer (5 stations): ${b5.thr.toFixed(1)} Mbps delivered, 0% loss, ${b5.delay.toFixed(1)} ms delay, ${b5.sinr} dB SINR.`, C.card);
  s.addNotes("Jammer powers: 16 dBm is the ns-3 default Wi-Fi Tx power (as strong as one station); 23 dBm is 200 mW; 30 dBm is 1 W, a typical handheld jammer. Channel switching is idealized: the network is on the new channel from t = 0.");
}

// 4. Loss vs distance
{
  const s = content("Each jammer power has its own denial radius");
  s.addChart(pres.charts.LINE, P.map((p) => series(`${p} dBm jammer`, D.loss[p])), {
    x: 0.6, y: 1.4, w: 8.2, h: 4.7, ...chartOpts({ chartColors: C.power, catAxisTitle: "Jammer distance from AP (m)", valAxisTitle: "Packet loss (%), 5 stations", valAxisMaxVal: 100, valAxisMinVal: 0 }),
  });
  tb(s, "Denial radius (50% loss)", { x: 9.2, y: 1.45, w: 3.5, h: 0.35, fontSize: 13, color: C.muted });
  P.forEach((p, i) => stat(s, 9.2, 1.9 + i * 1.2, 3.5, r0(D.radius[p]["5"]), `${p} dBm jammer · <5% loss beyond ${r0(D.radius5[p])}`, C.power[i]));
  const k1 = D.radius[P[1]]["5"] / D.radius[P[0]]["5"], k2 = D.radius[P[2]]["5"] / D.radius[P[1]]["5"];
  takeaway(s, `Each 7 dB of jammer power multiplies the radius by ${k1.toFixed(1)} and ${k2.toFixed(1)}; path loss with exponent 3 predicts 1.7.`);
  s.addNotes("RQ1 and RQ3. Mean of 10 seeds, 5 stations. Radius interpolated between the 10 m grid points.");
}

// 5. Delay
{
  const s = content("Delay stays high long after the loss is gone");
  s.addChart(pres.charts.LINE, [...P.map((p) => series(`${p} dBm jammer`, D.delay[p])), series("No jammer", D.dist.map(() => b5.delay))], {
    x: 0.6, y: 1.4, w: 8.2, h: 4.7, ...chartOpts({ chartColors: [...C.power, C.load[1]], catAxisTitle: "Jammer distance from AP (m)", valAxisTitle: "Mean delay (ms), log scale", valAxisLogScaleBase: 10 }),
  });
  // where loss first drops under 1%, per power
  P.forEach((p, i) => {
    const d = D.dist.find((x) => at(D.loss[p], x) < 1);
    if (d == null) return;
    const dl = at(D.delay[p], d);
    stat(s, 9.2, 1.45 + i * 1.2, 3.5, `${Math.round(dl / b5.delay)}× baseline`, `${p} dBm at ${d} m: ${pct(at(D.loss[p], d))} loss, ${f1(dl)} ms`, C.power[i]);
  });
  takeaway(s, "Where loss first falls under 1%, every packet still waits through retries: watch delay, not only loss.", "FDECE6");
  s.addNotes(`RQ1. Baseline delay with 5 stations is ${b5.delay} ms. Gaps near the jammer: no packet arrived, so no delay to measure.`);
}

// 6. SIR threshold (scatter)
{
  const s = content("One threshold explains all three jammers");
  const xs = P.flatMap((p) => D.sir[p]);
  const data = [{ name: "SIR", values: xs }, ...P.map((p, i) => ({ name: `${p} dBm jammer`, values: xs.map((_, j) => (Math.floor(j / D.dist.length) === i ? D.loss[p][j % D.dist.length] : "")) }))];
  s.addChart(pres.charts.SCATTER, data, {
    x: 0.6, y: 1.4, w: 8.2, h: 4.7, ...chartOpts({ chartColors: C.power, lineSize: 0, lineDataSymbol: "circle", lineDataSymbolSize: 8, catAxisTitle: "Mean signal-to-jammer ratio at the AP (dB)", valAxisTitle: "Packet loss (%)", valAxisMaxVal: 100, valAxisMinVal: 0 }),
  });
  stat(s, 9.2, 1.45, 3.5, "below 7 dB", "about 100% loss", C.power[2]);
  stat(s, 9.2, 2.65, 3.5, "about 11 dB", "50% loss", C.power[1]);
  stat(s, 9.2, 3.85, 3.5, "above 16 dB", "under 1% loss", C.good);
  takeaway(s, "The portable result is a ratio, not a distance: HT MCS 7 fails once the signal is less than about 11 dB above the jammer.");
  s.addNotes("RQ3. Same data as the loss-versus-distance slide, re-plotted against SIR from the path-loss model. The three powers fall on one curve.");
}

// 7. Load
{
  const s = content("More stations widen the damage at the edge");
  s.addChart(pres.charts.LINE, ["1", "5", "10"].map((n) => series(`${n} station${n === "1" ? "" : "s"}`, D.lossByN[n])), {
    x: 0.6, y: 1.4, w: 7.4, h: 4.7, ...chartOpts({ chartColors: C.load, catAxisTitle: `Distance from the ${TOP} dBm jammer (m)`, valAxisTitle: "Packet loss (%)", valAxisMaxVal: 100, valAxisMinVal: 0 }),
  });
  tb(s, "Denial radius (m)", { x: 8.4, y: 1.45, w: 4.3, h: 0.35, fontSize: 13, color: C.muted });
  const hdr = ["Jammer", "1 sta", "5 sta", "10 sta"].map((t) => ({ text: t, options: { bold: true, color: C.white, fill: { color: C.head } } }));
  const body = P.map((p) => [`${p} dBm`, ...["1", "5", "10"].map((n) => (D.radius[p][n] == null ? "–" : `${Math.round(D.radius[p][n])}`))]);
  s.addTable([hdr, ...body], { x: 8.4, y: 1.85, w: 4.3, colW: [1.3, 1, 1, 1], fontFace: BODY, fontSize: 13, color: C.ink, align: "center", border: { type: "solid", pt: 0.75, color: C.line }, rowH: 0.42 });
  const dn = D.delayByN;
  bullets(s, [
    `At 90 m: ${pct(at(D.lossByN["10"], 90))} loss with 10 stations, ${pct(at(D.lossByN["5"], 90))} with 5`,
    `At 100 m, delay is ${f1(at(dn["1"], 100))}, ${f1(at(dn["5"], 100))} and ${f1(at(dn["10"], 100))} ms for 1, 5, 10 stations`,
    "Deep inside the radius load makes no difference",
  ], { x: 8.4, y: 3.75, w: 4.3, h: 2.3, fontSize: 14 });
  takeaway(s, "Ten stations push the denial radius out and turn a small delay into a large one.");
  s.addNotes("RQ2. The 1-station curve is noisy: one station is either on the jammer's side of the ring or not, so each run is close to all-or-nothing.");
}

// 8. Layer 1 vs Layer 2
{
  const s = content("Blocked near the jammer, corrupted farther out");
  tb(s, "Layer 2: time stations sense the medium busy (%)", { x: 0.6, y: 1.35, w: 6, h: 0.35, fontSize: 14, bold: true, color: C.head });
  tb(s, "Layer 1: MAC retries per offered packet", { x: 6.8, y: 1.35, w: 6, h: 0.35, fontSize: 14, bold: true, color: C.head });
  const o = chartOpts({ chartColors: C.power, catAxisTitle: "Jammer distance from AP (m)", showValAxisTitle: false });
  s.addChart(pres.charts.LINE, P.map((p) => series(`${p} dBm jammer`, D.cca[p])), { x: 0.6, y: 1.75, w: 5.9, h: 4.35, ...o, valAxisMaxVal: 100, valAxisMinVal: 0 });
  s.addChart(pres.charts.LINE, P.map((p) => series(`${p} dBm jammer`, D.retries[p])), { x: 6.8, y: 1.75, w: 5.9, h: 4.35, ...chartOpts({ chartColors: C.power, catAxisTitle: "Jammer distance from AP (m)", showValAxisTitle: false }) });
  takeaway(s, `100% loss with zero retries means stations never transmitted. Many retries (baseline ${D.base["5"].retries}) means they did, and the frames were corrupted.`);
  s.addNotes(`Objective 6. Near the jammer its power at the stations is above the −62 dBm energy-detect threshold, so CSMA/CA defers. Baseline busy time is ${D.base["5"].cca}%.`);
}

// 9. Mitigation curves
{
  const s = content("Only a channel clear of the jammer recovers everything");
  const names = { none: "No mitigation", ch3: "Channel 3 (half overlap)", ra: "Rate adaptation", ch6: "Channel 6 (clean)" };
  s.addChart(pres.charts.LINE, Object.keys(names).map((k) => series(names[k], D.delivered[k])), {
    x: 0.6, y: 1.4, w: 7.6, h: 4.7, ...chartOpts({ chartColors: Object.keys(names).map((k) => C.mit[k]), catAxisTitle: `Distance from the ${TOP} dBm jammer (m), 5 stations`, valAxisTitle: "Packets delivered (%)", valAxisMaxVal: 100, valAxisMinVal: 0 }),
  });
  bullets(s, [
    { text: `Channel 6: ${pct(Math.min(...D.delivered.ch6))} or more delivered at every distance`, options: { bold: true, color: "11845B" } },
    `Channel 3 still takes half the jammer's power: radius ${r0(D.mitRadius.none["5"])} → ${r0(D.mitRadius.ch3["5"])}`,
    `Rate adaptation, no channel change: radius ${r0(D.mitRadius.none["5"])} → ${r0(D.mitRadius.ra["5"])}`,
    "Inside 30 m only leaving the band helps: carrier sense blocks the stations",
  ], { x: 8.6, y: 1.5, w: 4.1, h: 4.6, fontSize: 14 });
  takeaway(s, "Channel switching works when the new channel is clean, and barely helps when it still overlaps the jammer.");
  s.addNotes("RQ4. The switch is idealized: no detection time or switching overhead. The jammer's spectrum is a perfect 20 MHz block; a real one leaks into neighbouring channels.");
}

// 10. Mitigation in numbers
{
  const s = content("What each mitigation buys, in numbers");
  const ks = ["none", "ch3", "ra"], nm = { none: "No mitigation", ch3: "Channel 3", ra: "Rate adaptation" };
  s.addChart(pres.charts.BAR, ks.map((k) => ({ name: nm[k], labels: ["5 stations", "10 stations"], values: ["5", "10"].map((n) => D.mitRadius[k][n] ?? 0) })), {
    x: 0.6, y: 1.4, w: 6.2, h: 4.7, barDir: "col", barGapWidthPct: 60,
    ...chartOpts({ chartColors: ks.map((k) => C.mit[k]), showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0", dataLabelColor: C.ink, dataLabelFontSize: 11, catAxisTitle: `${TOP} dBm jammer`, valAxisTitle: "Denial radius, 50% loss (m)", valAxisMinVal: 0 }),
  });
  tb(s, "Lost packets won back at 60 m, 5 stations", { x: 7.2, y: 1.45, w: 5.5, h: 0.35, fontSize: 13, color: C.muted });
  [["ch3", "Channel 3"], ["ra", "Rate adaptation"], ["ch6", "Channel 6"]].forEach(([k, n], i) => stat(s, 7.2 + i * 1.88, 1.85, 1.75, `${D.recovery60[k]}%`, n, C.mit[k]));
  card(s, 7.2, 3.2, 5.5, 2.85, "FDECE6");
  tb(s, "Rate adaptation under load", { x: 7.45, y: 3.35, w: 5, h: 0.4, fontSize: 15, bold: true, color: "B4441A" });
  tb(s, `With 10 stations it loses ${pct(D.lossMit100.ra["10"])} at 100 m, against ${pct(D.lossMit100.none["10"])} at the fixed rate. Without a jammer the same network loses ${pct(D.raBaseLoss10)}, so jammer and load together cause it. Likely cause: slower rates need more airtime than 10 stations leave free (a hypothesis; airtime was not measured).`, { x: 7.45, y: 3.8, w: 5.05, h: 2.15, fontSize: 14 });
  takeaway(s, "Channel 6 has no bar: its loss never reached 50% at any distance or load.", C.card);
  s.addNotes("RQ4. Recovery = share of the jammer's damage a mitigation wins back, 100% = back to the no-jammer baseline. recovery.csv has every distance and station count.");
}

// 11. Pulsed jammer
{
  const s = content("A part-time jammer has to be on almost all the time");
  s.addChart(pres.charts.BAR, [{ name: "Packet loss (%)", labels: D.duty.x.map((x) => `${x}%`), values: D.duty.mean }], {
    x: 0.6, y: 1.4, w: 7.6, h: 4.7, barDir: "col", barGapWidthPct: 50,
    ...chartOpts({ chartColors: [C.accent], showLegend: false, showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0", dataLabelColor: C.ink, dataLabelFontSize: 11, catAxisTitle: "Share of each 100 ms cycle the jammer is on", valAxisTitle: "Packet loss (%)", valAxisMaxVal: 100, valAxisMinVal: 0 }),
  });
  const dv = (x) => D.duty.mean[D.duty.x.indexOf(x)];
  bullets(s, [
    `${P[0]} dBm jammer 10 m from the AP, 5 stations`,
    `On 90% of the time: ${pct(dv(90))} loss. On 95%: ${pct(dv(95))}. On 99%: ${pct(dv(99))}`,
    "Light traffic (1 Mbps per station): queues drain in the gaps",
    `Spread between seeds is large below 90% (±${Math.round(D.duty.std[D.duty.x.indexOf(50)])} points at 50%)`,
  ], { x: 8.6, y: 1.5, w: 4.1, h: 4.6, fontSize: 14 });
  takeaway(s, "At this load a jammer needs to be on at least 90% of the time to do serious damage.");
  s.addNotes("Extra experiment beyond the proposal. Heavier traffic would move the knee left.");
}

// 12. Recommendations & limits
{
  const s = content("Recommendations and limits");
  card(s, 0.6, 1.45, 5.95, 4.6, "E8F5EF");
  card(s, 6.75, 1.45, 5.95, 4.6, C.card);
  tb(s, "Recommendations", { x: 0.9, y: 1.65, w: 5.4, h: 0.4, fontFace: HEAD, fontSize: 20, bold: true, color: "11845B" });
  tb(s, "Limits of this study", { x: 7.05, y: 1.65, w: 5.4, h: 0.4, fontFace: HEAD, fontSize: 20, bold: true, color: C.head });
  bullets(s, [
    "Move to a channel that does not overlap the jammer; a neighbouring channel buys only about 3 dB",
    "Watch delay, not only loss: it shows a jammer before packets drop",
    "Use rate adaptation on light networks; test it under load first",
    "Keep the signal-to-jammer ratio at the AP above about 16 dB for this rate",
  ], { x: 0.9, y: 2.2, w: 5.4, h: 3.7, fontSize: 15 });
  bullets(s, [
    "Simulation only; distances depend on the path-loss model, the SIR threshold is more portable",
    "Idealized channel switch: no detection time or overhead, and the jammer does not follow",
    "Brick-wall 20 MHz jammer spectrum; real jammers leak into neighbours",
    "Constant jammer, fixed HT MCS 7, light UDP traffic only",
  ], { x: 7.05, y: 2.2, w: 5.4, h: 3.7, fontSize: 15 });
  s.addNotes("Next steps: model jammer detection and switching delay to measure recovery time, repeat with heavier traffic and TCP, and compare fixed rates.");
}

// 13. Conclusion
{
  const s = pres.addSlide({ masterName: "DARK" });
  tb(s, "Conclusion", { x: 0.8, y: 0.8, w: 11, h: 0.8, fontFace: HEAD, fontSize: 36, bold: true, color: C.white });
  tb(s, `A constant jammer denies an 802.11n network completely inside a radius set by its power: ${r0(D.radius[P[0]]["5"])} at ${P[0]} dBm, ${r0(D.radius[TOP]["5"])} at 1 W. Near the jammer stations are silenced by carrier sense; farther out their frames are corrupted.`, { x: 0.8, y: 1.9, w: 11.7, h: 1.4, fontSize: 18, color: "C9D2E3" });
  const items = [
    [C.good, "Clean channel", "Full recovery at every distance and load"],
    [C.power[0], "Half-overlapping channel", `Denial radius shrinks only ${r0(D.mitRadius.none["5"])} → ${r0(D.mitRadius.ch3["5"])}`],
    [C.mit.ra, "Rate adaptation", "Helps a light network, hurts a loaded one"],
  ];
  items.forEach(([col, h, t], i) => {
    const x = 0.8 + i * 4.0;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 3.8, w: 3.7, h: 2.2, fill: { color: "1F2940" }, line: { color: col, width: 1.5 }, rectRadius: 0.08 });
    s.addShape(pres.shapes.OVAL, { x: x + 0.3, y: 4.1, w: 0.35, h: 0.35, fill: { color: col }, line: { color: col } });
    tb(s, h, { x: x + 0.8, y: 4.05, w: 2.8, h: 0.45, fontSize: 17, bold: true, color: C.white, valign: "middle" });
    tb(s, t, { x: x + 0.3, y: 4.75, w: 3.15, h: 1.1, fontSize: 15, color: "C9D2E3" });
  });
  s.addNotes("Headline numbers are for 5 stations.");
}

pres.writeFile({ fileName: OUT }).then(() => console.log("wrote", OUT));
