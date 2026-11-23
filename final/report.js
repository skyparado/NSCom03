// Builds the final report (IEEE two-column, full prose) and a bullet-point version.
const fs = require('fs');
const D = require('docx');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType,
  HeadingLevel, ImageRun, BorderStyle, ShadingType, LevelFormat, SectionType } = D;

const F = 'Times New Roman';
const LETTER = { width: 12240, height: 15840 };
const MARGIN = { top: 1080, bottom: 1440, left: 1022, right: 1022 };
const COLW = Math.floor((12240 - 2 * 1022 - 360) / 2); // one IEEE column, DXA

const t = (s, o = {}) => new TextRun({ text: s, font: F, ...o });
// "**x**" -> bold run
const runs = (s, o = {}) => s.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map(p =>
  p.startsWith('**') ? t(p.slice(2, -2), { ...o, bold: true }) : t(p, o));
const P = (s, o = {}) => new Paragraph({ children: runs(s, { size: 20 }), alignment: AlignmentType.JUSTIFIED,
  indent: { firstLine: 202 }, spacing: { after: 40, line: 240 }, ...o });
const H1 = s => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [t(s)] });
const H2 = s => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [t(s)] });
const B = (s, ref = 'ieeebul') => new Paragraph({ numbering: { reference: ref, level: 0 }, children: runs(s, { size: 20 }),
  alignment: AlignmentType.JUSTIFIED, spacing: { after: 20 } });
const N = (s, inst) => new Paragraph({ numbering: { reference: 'num', level: 0, instance: inst }, children: runs(s, { size: 20 }),
  alignment: AlignmentType.JUSTIFIED, spacing: { after: 20 } });
const cap = s => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 60 }, keepNext: true,
  children: [t(s, { size: 16, smallCaps: true })] });
const figcap = s => new Paragraph({ alignment: AlignmentType.LEFT, spacing: { after: 160 },
  children: runs(s, { size: 16 }) });

const bd = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
function table(rows, widths) {
  const total = widths.reduce((a, b) => a + b, 0);
  return new Table({ width: { size: total, type: WidthType.DXA }, columnWidths: widths,
    rows: rows.map((r, i) => new TableRow({ tableHeader: i === 0, children: r.map((c, j) => new TableCell({
      width: { size: widths[j], type: WidthType.DXA }, borders: { top: bd, bottom: bd, left: bd, right: bd },
      margins: { top: 30, bottom: 30, left: 60, right: 60 },
      shading: i === 0 ? { type: ShadingType.CLEAR, fill: 'E7E6E6' } : undefined,
      children: [new Paragraph({ alignment: j === 0 ? AlignmentType.LEFT : AlignmentType.CENTER,
        children: [t(c, { size: 15, bold: i === 0 })] })] })) })) });
}
const img = (f, w, h) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120 }, keepNext: true,
  children: [new ImageRun({ type: 'png', data: fs.readFileSync(f), transformation: { width: w, height: h },
    altText: { title: f, description: f, name: f } })] });

// ---------- shared facts (from findings.md) ----------
const REFS = [
  'G. Bianchi, "Performance analysis of the IEEE 802.11 distributed coordination function," IEEE J. Sel. Areas Commun., vol. 18, no. 3, pp. 535–547, Mar. 2000.',
  'W. Xu, W. Trappe, Y. Zhang, and T. Wood, "The feasibility of launching and detecting jamming attacks in wireless networks," in Proc. ACM MobiHoc, 2005, pp. 46–57.',
  'K. Pelechrinis, M. Iliofotou, and S. V. Krishnamurthy, "Denial of service attacks in wireless networks: The case of jammers," IEEE Commun. Surveys Tuts., vol. 13, no. 2, pp. 245–257, 2011.',
  'G. F. Riley and T. R. Henderson, "The ns-3 network simulator," in Modeling and Tools for Network Simulation, K. Wehrle, M. Güneş, and J. Gross, Eds. Berlin, Germany: Springer, 2010, pp. 15–34.',
  'ns-3 Project, "Wi-Fi model," ns-3 Model Library. [Online]. Available: https://www.nsnam.org/docs/models/html/wifi.html',
  'G. Carneiro, P. Fortuna, and M. Ricardo, "FlowMonitor: A network monitoring framework for the network simulator 3 (ns-3)," in Proc. VALUETOOLS, 2009.',
  'H. Pirayesh and H. Zeng, "Jamming attacks and anti-jamming strategies in wireless networks: A comprehensive survey," arXiv:2101.00292, 2021.',
  'W. Xu, W. Trappe, and Y. Zhang, "Channel surfing: Defending wireless sensor networks from interference," in Proc. IPSN, 2007, pp. 499–508.',
];
const AUTH = [
  ['Ma. Alexandria Austria', 'Manila, Philippines', 'ma_alexandria_austria@dlsu.edu.ph'],
  ['Don Oswin Campos', 'Pampanga, Philippines', 'don_campos@dlsu.edu.ph'],
  ['Anne Beatriz Patricio', 'Laguna, Philippines', 'bea_patricio@dlsu.edu.ph'],
  ['Sky Hannah Parado', 'Manila, Philippines', 'sky_parado@dlsu.edu.ph'],
];
const TITLE = 'Interference and Jamming Mitigation in Wi-Fi Networks Using ns-3';

const T_LOSS = [['Distance', '16 dBm', '23 dBm', '30 dBm'],
  ['10 m', '100%', '100%', '100%'], ['20 m', '72%', '100%', '100%'], ['30 m', '17%', '89%', '100%'],
  ['40 m', '0.2%', '44%', '99.8%'], ['50 m', '0%', '15%', '99.7%'], ['60 m', '0%', '0.3%', '74%'],
  ['70 m', '0%', '0.1%', '45%'], ['80 m', '0%', '0%', '21%'], ['90 m', '0%', '0%', '1.0%'], ['100 m', '0%', '0%', '0.7%']];
const T_RADIUS = [['Jammer power', '1 STA', '5 STA', '10 STA', '<5% loss (5 STA)'],
  ['16 dBm', '21 m', '24 m', '26 m', '37 m'], ['23 dBm', '38 m', '39 m', '44 m', '57 m'], ['30 dBm', '63 m', '68 m', '76 m', '88 m']];
const T_MIT = [['Mitigation (30 dBm jammer)', '5 STA', '10 STA'],
  ['None', '68 m', '76 m'], ['Switch to channel 3 (half overlap)', '55 m', '61 m'],
  ['Rate adaptation (Minstrel-HT)', '43 m', '83 m'], ['Switch to channel 6 (clean)', 'none', 'none']];
const T_L12 = [['Distance', 'CCA busy', 'Retries/pkt', 'Loss', 'Mechanism'],
  ['10–30 m', '88–99%', '≈0', '100%', 'L2: carrier sense'], ['40–50 m', '48–71%', '<0.5', '≈100%', 'Both'],
  ['60–90 m', '10–30%', '10–13', '74%→1%', 'L1: low SINR'], ['Baseline', '3%', '1.1', '0%', '—']];
const T_CASES = [['Case', 'What was run'],
  ['T1', 'No jammer; N = 1, 5, 10 (also with rate adaptation)'], ['T2', 'Constant jammer on ch. 1 at 16, 23, 30 dBm'],
  ['T3', 'N = 1, 5, 10 at every power and distance'], ['T4', 'Jammer 10, 20, …, 100 m from the AP'],
  ['T5', '30 dBm jammer; BSS on ch. 3 or ch. 6, or Minstrel-HT'], ['Extra', 'Pulsed jammer, 0–100% of a 100 ms cycle']];
const T_PARAM = [['Parameter', 'Value'],
  ['Simulator', 'ns-3-dev (3.48), optimized build'], ['Standard', 'IEEE 802.11n, 2.4 GHz, 20 MHz, ch. 1'],
  ['Rate', 'Fixed HT MCS 7 (data), HT MCS 0 (control)'], ['Stations', '1, 5, 10 on a 10 m ring, random rotation'],
  ['Traffic', 'UDP uplink, 1 Mbps/STA, 1024-byte packets'],
  ['Propagation', 'Log-distance (n = 3, 40.05 dB at 1 m) + Nakagami m = 1.5'],
  ['Jammer', 'Flat noise over 2402–2422 MHz, 1 ms bursts, 16/23/30 dBm'],
  ['CCA (energy detect)', '−62 dBm'], ['Runs', '60 s, 10 seeds per case, 1,930 runs']];

// ---------- FULL REPORT ----------
const head = [
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [t(TITLE, { size: 48 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 },
    children: [t('NSS S40B, Group 6 — Final Report', { size: 20, italics: true })] }),
  new Table({ width: { size: 10196, type: WidthType.DXA }, columnWidths: [2549, 2549, 2549, 2549],
    borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
    rows: [new TableRow({ children: AUTH.map(a => new TableCell({ width: { size: 2549, type: WidthType.DXA },
      borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
      children: [a[0], 'BS Computer Science major in Network and Information Security', 'De La Salle University', a[1], a[2]].map((l, i) =>
        new Paragraph({ alignment: AlignmentType.CENTER, children: [t(l, { size: i === 0 ? 20 : 16, italics: i === 1 || i === 2 })] })) })) })] }),
  new Paragraph({ spacing: { after: 200 }, children: [] }),
];

const body = [
  new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 80 }, children: [
    t('Abstract', { size: 18, bold: true, italics: true }),
    t('—Wi-Fi operates in shared, unlicensed spectrum and is therefore exposed to interference and deliberate jamming. This study uses the ns-3 network simulator to measure how a constant co-channel jammer degrades an IEEE 802.11n network of one access point (AP) and 1, 5 or 10 stations, and how much channel switching and rate adaptation recover. Across 1,930 runs of 60 s each, the jammer was swept from 10 to 100 m at 16, 23 and 30 dBm. Inside a power-dependent "denial radius" (24, 39 and 68 m for the three powers with five stations) loss is total; outside it, loss recovers before delay, which remained up to 11 times the baseline when loss was already below 1%. Loss crossed 50% at a signal-to-jammer ratio of about 11 dB for all three powers. More stations widened the denial radius by 15–25%. Moving the network to a channel clear of the jammer restored baseline performance at every distance, whereas a half-overlapping channel shrank the denial radius by only about 20%, and rate adaptation helped a light network but hurt a loaded one. Near the jammer stations are silenced by carrier sense (Layer 2); farther out their frames are corrupted by low SINR (Layer 1).', { size: 18, bold: true })] }),
  new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 120 }, children: [
    t('Keywords', { size: 18, bold: true, italics: true }),
    t('—Wi-Fi, IEEE 802.11, interference, jamming, CSMA/CA, channel switching, ns-3', { size: 18, bold: true })] }),

  H1('I. Introduction'),
  H2('A. Background'),
  P('Wi-Fi, based on the IEEE 802.11 standard, is the dominant wireless LAN technology in homes, campuses and offices. It operates mainly in unlicensed bands, where it shares spectrum with neighboring Wi-Fi networks, Bluetooth and Zigbee devices, and appliances such as microwave ovens. To share the medium, a station senses the channel, defers while it is busy and waits a random backoff before it transmits; this procedure is CSMA/CA [1]. The protocol assumes that every other transmitter follows the same rules.'),
  P('Interference from non-Wi-Fi sources breaks this assumption, and a jammer, which transmits on purpose to deny service, breaks it completely [2], [3]. Jamming experiments on real unlicensed bands are restricted by regulation and hard to repeat, so this study uses the ns-3 simulator [4] for controlled, repeatable experiments.'),
  H2('B. Problem Statement'),
  P('Wi-Fi networks are vulnerable to radio-frequency interference and intentional jamming, which reduce throughput, increase packet loss and delay transmissions. Channel switching has been proposed as a mitigation, but how much it recovers in an 802.11 network still needs to be measured. This study answers four research questions:'),
  N('How does constant co-channel jamming affect the throughput, packet loss and delay of a Wi-Fi network compared with its baseline? (RQ1)', 1),
  N('How does the number of connected stations influence performance under jamming? (RQ2)', 1),
  N('How does the distance between the jammer and the AP influence the severity of degradation? (RQ3)', 1),
  N('To what extent can channel switching recover throughput, loss and delay? (RQ4)', 1),
  H2('C. Objectives'),
  P('The main objective is to simulate a Wi-Fi network in ns-3 under constant jamming and evaluate how much a channel-switching mitigation recovers its throughput, packet loss and delay. The specific objectives are to (1) build an ns-3 802.11 network with one AP, multiple stations and one jammer; (2) measure baseline throughput, loss and delay; (3) measure the same metrics under a co-channel jammer; (4) vary the number of stations and the jammer distance; (5) apply channel switching and measure the recovery; (6) explain the results with Layer 1 (SINR) and Layer 2 (CSMA/CA, retransmission) concepts; and (7) present findings with graphs and recommendations.'),
  H2('D. Scope and Limitations'),
  B('One 802.11n infrastructure BSS in the 2.4 GHz band: one AP, static stations and one jammer; PHY and MAC behavior only.'),
  B('Only a constant jammer is modeled, plus one pulsed (duty-cycled) variant as an extra experiment. Deceptive, random and reactive jammers are not studied.'),
  B('Channel switching is idealized: the network is on the new channel from the start, so detection time and switching overhead are not modeled. Rate adaptation was added as a second mitigation.'),
  B('Traffic is light UDP uplink (1 Mbps per station). TCP and higher-layer effects are not covered.'),
  B('Results come from simulation only; absolute distances depend on the ns-3 propagation and error models.'),

  H1('II. Review of Related Literature'),
  H2('A. Wi-Fi Interference and Network Performance'),
  P('IEEE 802.11 stations contend for the medium through the distributed coordination function (DCF), which uses CSMA/CA with binary exponential backoff. Bianchi [1] showed that DCF saturation throughput depends on the number of contending stations and on the backoff parameters, assuming an ideal channel in which collisions are the only cause of failure. Interference removes this assumption in two ways: energy above the carrier-sense threshold keeps the channel busy so stations defer, and energy overlapping a reception lowers the SINR so frames are corrupted and retransmitted, each failure enlarging the contention window.'),
  P('Xu et al. [2] defined constant, deceptive, random and reactive jammers and studied how signal strength, carrier-sensing time and packet delivery ratio can detect them. A constant jammer, the model used here, transmits continuously and ignores the MAC protocol. Pelechrinis et al. [3] surveyed jammer types, detection methods and countermeasures. These works characterize jamming at the radio level or by detection; this study instead measures the resulting throughput, loss and delay as load and jammer distance change.'),
  H2('B. Simulation of Wi-Fi Interference in ns-3'),
  P('ns-3 is an open-source discrete-event network simulator [4]. Its Wi-Fi module computes the SINR of each received frame from signal power and accumulated interference and derives the frame error probability from it [5]. SpectrumWifiPhy represents signals by their power spectral density, so non-Wi-Fi sources such as a waveform generator can share the channel; it is therefore the suitable PHY for a jammer. FlowMonitor [6] records per-flow transmitted, received and lost packets and accumulated delay, from which throughput, loss ratio and mean delay follow.'),
  H2('C. Jamming Mitigation Techniques'),
  P('Countermeasures fall into detection, spread spectrum and frequency hopping, channel adaptation and spatial retreat [2], [7]. Xu et al. [8] proposed channel surfing, in which affected nodes move to another channel, and showed that it restores communication in sensor networks. Pirayesh and Zeng [7] noted that practical jamming-resilient WLAN designs remain limited. The reviewed studies show that jamming is harmful and channel switching is feasible, but they do not quantify, for an 802.11 network, how much performance is recovered as load and jammer distance change. This study addresses that gap.'),

  H1('III. Methodology'),
  H2('A. Simulation Tools'),
  P('The scenario is written in C++ (wifi-jamming.cc) against ns-3-dev 3.48 in an optimized build. The Wi-Fi, spectrum, mobility and applications modules build the network; UdpClient and UdpServer generate traffic; FlowMonitor and PHY/MAC trace sources collect the metrics. A Python driver (run_all.py) runs all cases in parallel, and pandas and matplotlib summarize and plot the results.'),
  H2('B. Network Topology and Jammer Model'),
  P('One AP sits at the origin and N stations are placed evenly on a 10 m ring around it, rotated by a random angle per seed so that no station is always on the far side of the jammer. All nodes are static on channel 1 (2.4 GHz, 20 MHz), and each station sends a constant-rate UDP flow to the AP. The jammer is a waveform generator on SpectrumWifiPhy that emits flat noise over 2402–2422 MHz in back-to-back 1 ms bursts, so that it fades frame by frame like the Wi-Fi links. It does no carrier sensing. Path loss is log-distance with exponent 3 and a 2.4 GHz reference loss of 40.05 dB at 1 m, plus Nakagami fading (m = 1.5). Table I lists the parameters.'),
  cap('Table I. Simulation Parameters'), table(T_PARAM, [1500, COLW - 1500]),
  H2('C. Test Cases'),
  P('Table II maps the proposal\'s test cases to what was run. Following the panel\'s feedback, the near/far jammer positions were replaced by a 10–100 m sweep in 10 m steps, and the jammer was run at three powers: 16 dBm (the ns-3 default Wi-Fi Tx power, as strong as one station), 23 dBm (200 mW) and 30 dBm (1 W, a typical handheld jammer). Besides the clean-channel switch, a half-overlapping channel (3) and Minstrel-HT rate adaptation were added so that recovery is measured rather than guaranteed by construction.'),
  cap('Table II. Test Cases'), table(T_CASES, [800, COLW - 800]),
  H2('D. Metrics'),
  P('Throughput is received UDP payload bits divided by the traffic time. Packet loss ratio is the fraction of sent packets not received; packets still queued 1 s after traffic stops count as lost. Delay is the mean send-to-receive time of delivered packets. SINR at the AP, MAC retries per packet and the fraction of time stations sensed the medium busy (CCA busy) are also recorded to separate Layer 1 and Layer 2 effects. The denial radius is the jammer distance at which mean loss falls through 50%, interpolated between grid points. All values are means over 10 seeds with standard deviations.'),
  H2('E. Calibration and Corrections'),
  P('Two issues in the simulator setup had to be corrected before the results could be trusted. First, ns-3\'s default carrier sensing applied the −82 dBm preamble threshold to all in-band energy, including jammer noise, so stations froze on a jammer 20 dB too weak to trip a real radio\'s energy detect, and the jammer\'s burst length rather than the physics decided the loss. The model now uses the 802.11 energy-detect threshold of −62 dBm, which leaves the no-jammer baseline unchanged. Second, a bug in WifiPhyStateHelper::SwitchMaybeToCcaBusy could end a busy period early and abort or hang the simulation; a one-line patch (keep the later of the two end times) fixed it, after which all 1,930 runs completed.'),

  H1('IV. Results and Discussion'),
  P('Unless stated otherwise, results are for five stations. Without a jammer, the network delivered 5.0 Mbps with 0% loss, 1.2 ms mean delay and 38.3 dB SINR.'),
  H2('A. Effect of Constant Jamming (RQ1)'),
  P('Inside its radius a constant jammer denies service completely (Table III, Fig. 1). Outside it, loss recovers first and delay much later: with the 30 dBm jammer at 100 m, loss is back under 1% but mean delay is 12.8 ms, about 11 times the baseline. The same holds for weaker jammers: 16 dBm at 40 m gives 0.2% loss but 6.0 ms delay (5×), and 23 dBm at 60 m gives 0.3% loss but 11.0 ms (9×). A network can therefore look healthy on packet loss while every packet still waits through retries.'),
  cap('Table III. Mean Packet Loss vs. Jammer Distance (5 Stations)'), table(T_LOSS, [1300, 1300, 1300, COLW - 3900]),
  img('fig1.png', 228, 148), figcap('Fig. 1. Packet loss vs. jammer distance for three jammer powers (5 stations). Dotted line: 50% loss, which defines the denial radius.'),
  H2('B. Effect of Jammer Distance (RQ3)'),
  P('Loss falls from 100% to about 0% across a band 30–40 m wide whose position depends on jammer power (Table IV). Each 7 dB of power multiplied the denial radius by 1.6–1.8, close to the 1.7 that path loss with exponent 3 predicts. Plotted against the mean signal-to-jammer ratio (SIR) at the AP, the three curves coincide: loss is about 100% below 7 dB, crosses 50% at about 11 dB and is under 1% above about 16 dB. This SIR threshold, rather than a distance in meters, is the result that carries over to other powers and layouts at this fixed rate (HT MCS 7).'),
  H2('C. Effect of the Number of Stations (RQ2)'),
  P('Load matters at the edge of the jammer\'s reach but not deep inside it, where loss is 100% for any N. Ten stations pushed the denial radius out by 15–25% compared with one station (Table IV). Delay is far more sensitive to load than loss: with the 30 dBm jammer at 100 m, mean delay is 4.6, 12.8 and 141 ms for 1, 5 and 10 stations (baselines 0.2, 1.2 and 2.1 ms), and at 90 m loss is about 1% with 1 or 5 stations but 19% with 10. Single-station results are noisy (standard deviation up to 50 points) because one station is either on the jammer\'s side of the ring or not.'),
  cap('Table IV. Denial Radius (50% Loss) by Jammer Power and Load'), table(T_RADIUS, [1100, 750, 750, 750, COLW - 3350]),
  H2('D. Channel Switching and Rate Adaptation (RQ4)'),
  P('Recovery depends entirely on whether the new channel is clear of the jammer (Table V, Fig. 2). On channel 6 loss was 0% and delay equaled the baseline at every distance and load, even 10 m from a 1 W jammer. Channel 3 still receives half the jammer\'s power, a 3 dB discount: the denial radius shrank by about 20% (68 to 55 m), nothing was recovered inside 30 m, and 49% of the lost packets were won back at 60 m. Rate adaptation cut the radius from 68 to 43 m with five stations and recovered 94% of lost packets at 60 m, but with ten stations it made things worse from 80 m outward (29% loss at 100 m against 3% at the fixed rate). Without a jammer the same ten stations lose 0.1%, so the likely cause is that slower rates need more airtime than ten stations leave free; airtime was not measured, so this remains a hypothesis.'),
  cap('Table V. Denial Radius by Mitigation (30 dBm Jammer)'), table(T_MIT, [COLW - 1600, 800, 800]),
  img('fig2.png', 228, 148), figcap('Fig. 2. Denial radius per mitigation against the 30 dBm jammer. Channel 6 never reached 50% loss.'),
  H2('E. Layer 1 and Layer 2 Mechanisms'),
  P('The jammer hurts in two distinct ways (Table VI). Within 30 m of the 30 dBm jammer, its power at the stations exceeds the −62 dBm energy-detect threshold, so CSMA/CA defers indefinitely: 100% loss with almost zero retries is the signature of a Layer 2 denial. From 60 to 90 m stations can transmit, but frames reach the AP below the SINR the rate needs, and retries climb to 10–13 per packet against 1.1 without a jammer: a Layer 1 failure. Frames that were decoded averaged 18–30 dB SINR, against 38.3 dB at baseline. This explains why only leaving the jammer\'s band helps near the jammer: no rate or partial-overlap change makes stations transmit when carrier sense keeps them silent.'),
  cap('Table VI. Layer 1 vs. Layer 2 Effects (30 dBm Jammer)'), table(T_L12, [850, 800, 800, 750, COLW - 3200]),
  H2('F. Pulsed Jammer'),
  P('A 16 dBm jammer 10 m from the AP, switched on for part of each 100 ms cycle, caused 7% loss at 50% on-time, 3% at 80%, 22% at 90%, 67% at 95% and 100% at 99%. At this light load the queues drain during the gaps, so a jammer must be on at least 90% of the time to do serious damage. The 50% and 80% points are within each other\'s spread.'),

  H1('V. Conclusion and Recommendations'),
  P('A constant jammer denies an 802.11n network completely inside a radius set by its power: 24 m at 16 dBm and 68 m at 1 W for five stations. Near the jammer, stations are silenced by carrier sense; farther out, their frames are corrupted by low SINR. Delay is the last metric to recover and the first to reveal a jammer, and heavier load widens the damage at the edge. A channel clear of the jammer restores full performance, a half-overlapping channel is worth only about 3 dB, and rate adaptation helps a lightly loaded network but can hurt a loaded one.'),
  P('We recommend (1) moving to a channel that does not overlap the jammer at all; (2) monitoring delay, not only loss; (3) using rate adaptation on lightly loaded networks only after checking it under load; and (4) judging exposure by the signal-to-jammer ratio at the AP, keeping it above about 16 dB for this rate.'),
  P('Future work should model jammer detection and switching delay, a jammer that follows the network or leaks into adjacent channels, reactive and random jammers, heavier and TCP traffic, and airtime measurements to confirm the rate-adaptation explanation.'),

  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 80 }, children: [t('References', { size: 20, smallCaps: true })] }),
  ...REFS.map((r, i) => new Paragraph({ spacing: { after: 30 }, indent: { left: 360, hanging: 360 },
    children: [t(`[${i + 1}]\t${r}`, { size: 16 })], tabStops: [{ type: 'left', position: 360 }] })),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 80 }, children: [t('Appendix', { size: 20, smallCaps: true })] }),
  P('Source code, the ns-3 patch and run instructions are in the group repository (github.com/skyparado/NSCom03): wifi-jamming.cc (scenario), run_all.py (runs all 1,930 simulations), plot.py and plot_duty.py (figures), ns3-cca-busy-fix.patch, README.md and RUN.md.'),
];

const numbering = { config: [
  { reference: 'ieeebul', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 360, hanging: 200 } } } }] },
  { reference: 'bul', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
    { level: 1, format: LevelFormat.BULLET, text: '–', alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 1440, hanging: 360 } } } }] },
  { reference: 'num', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1)', alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 360, hanging: 260 } } } }] },
] };

const full = new Document({
  creator: 'NSS S40B Group 6', title: TITLE, numbering,
  styles: { default: { document: { run: { font: F, size: 20 } } }, paragraphStyles: [
    { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
      run: { font: F, size: 20, smallCaps: true }, paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 200, after: 80 }, keepNext: true, outlineLevel: 0 } },
    { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
      run: { font: F, size: 20, italics: true }, paragraph: { spacing: { before: 100, after: 60 }, keepNext: true, outlineLevel: 1 } },
  ] },
  sections: [
    { properties: { page: { size: LETTER, margin: MARGIN } }, children: head },
    { properties: { type: SectionType.CONTINUOUS, page: { size: LETTER, margin: MARGIN }, column: { count: 2, space: 360 } }, children: body },
  ],
});

// ---------- BULLET-POINT VERSION ----------
const A = 'Arial';
const ta = (s, o = {}) => new TextRun({ text: s, font: A, ...o });
const bh1 = s => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [ta(s)] });
const bh2 = s => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [ta(s)] });
const bb = (s, lvl = 0) => new Paragraph({ numbering: { reference: 'bul', level: lvl }, spacing: { after: 60 },
  children: s.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map(p => p.startsWith('**') ? ta(p.slice(2, -2), { size: 22, bold: true }) : ta(p, { size: 22 })) });
const W = 9360;
function btable(rows, widths) {
  const sc = W / widths.reduce((a, b) => a + b, 0); const w = widths.map(x => Math.floor(x * sc)); w[w.length - 1] += W - w.reduce((a, b) => a + b, 0);
  const b = { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' };
  return new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: w, rows: rows.map((r, i) => new TableRow({ tableHeader: i === 0,
    children: r.map((c, j) => new TableCell({ width: { size: w[j], type: WidthType.DXA }, borders: { top: b, bottom: b, left: b, right: b },
      margins: { top: 60, bottom: 60, left: 100, right: 100 }, shading: i === 0 ? { type: ShadingType.CLEAR, fill: '1F4E79' } : undefined,
      children: [new Paragraph({ children: [ta(c, { size: 20, bold: i === 0, color: i === 0 ? 'FFFFFF' : undefined })] })] })) })) });
}
const sp = () => new Paragraph({ spacing: { after: 120 }, children: [] });

const bul = new Document({
  creator: 'NSS S40B Group 6', title: TITLE + ' (bullet version)', numbering,
  styles: { default: { document: { run: { font: A, size: 22 } } }, paragraphStyles: [
    { id: 'Title', name: 'Title', basedOn: 'Normal', run: { font: A, size: 36, bold: true, color: '1F4E79' }, paragraph: { spacing: { before: 0, after: 120 }, keepNext: true } },
    { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: A, size: 28, bold: true, color: '1F4E79' },
      paragraph: { spacing: { before: 280, after: 100 }, keepNext: true, outlineLevel: 0 } },
    { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: A, size: 24, bold: true },
      paragraph: { spacing: { before: 160, after: 60 }, keepNext: true, outlineLevel: 1 } },
  ] },
  sections: [{ properties: { page: { size: LETTER, margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } }, children: [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [ta(TITLE)] }),
    new Paragraph({ spacing: { after: 240 }, children: [ta('NSS S40B, Group 6 — Final report in bullet points. Austria · Campos · Patricio · Parado, De La Salle University', { size: 20, italics: true, color: '595959' })] }),

    bh1('Abstract'),
    bb('ns-3 study of a **constant co-channel jammer** against an 802.11n network (1 AP, 1/5/10 stations).'),
    bb('**1,930 runs**: jammer swept 10–100 m at 16, 23 and 30 dBm; 60 s per run, 10 seeds.'),
    bb('**Denial radius** (50% loss, 5 stations): 24 m, 39 m, 68 m for the three powers.'),
    bb('**Delay recovers last**: up to 11× baseline when loss is already under 1%.'),
    bb('**Clean channel = full recovery**; half-overlapping channel only shrinks the radius ~20%; rate adaptation helps light load, hurts heavy load.'),

    bh1('I. Introduction'),
    bh2('Background'),
    bb('Wi-Fi shares the unlicensed 2.4 GHz band with other networks, Bluetooth, Zigbee and microwaves.'),
    bb('CSMA/CA assumes every transmitter senses and defers [1]; a jammer ignores this [2], [3].'),
    bb('Real jamming is illegal and hard to repeat → simulate in ns-3 [4].'),
    bh2('Problem statement and research questions'),
    bb('**RQ1** How does constant jamming affect throughput, loss and delay vs. baseline?'),
    bb('**RQ2** How does the number of stations change the damage?'),
    bb('**RQ3** How does jammer distance change the damage?'),
    bb('**RQ4** How much does channel switching recover?'),
    bh2('Objectives'),
    bb('Build the ns-3 network; measure baseline; measure under jamming.'),
    bb('Vary load and jammer distance (and power); test channel switching and rate adaptation.'),
    bb('Explain results with Layer 1 (SINR) and Layer 2 (CSMA/CA, retries); present graphs and recommendations.'),
    bh2('Scope and limitations'),
    bb('One BSS, 2.4 GHz, static nodes, PHY/MAC only.'),
    bb('Constant jammer (+ pulsed variant); no reactive/random/deceptive jammers.'),
    bb('Idealized switching: no detection time or switching overhead.'),
    bb('Light UDP uplink only; simulation only.'),

    bh1('II. Review of Related Literature'),
    bb('**Bianchi [1]**: DCF throughput depends on number of stations; assumes ideal channel.'),
    bb('**Interference** acts two ways: keeps channel busy (deferral) and lowers SINR (corrupted frames, retries).'),
    bb('**Xu et al. [2]**: four jammer models; constant jammer keeps medium busy. **Pelechrinis et al. [3]**: survey of jammers and countermeasures.'),
    bb('**ns-3 [4], [5]**: SpectrumWifiPhy lets a waveform generator act as a jammer. **FlowMonitor [6]** gives throughput, loss, delay.'),
    bb('**Mitigation**: channel surfing [8]; anti-jamming survey [7].'),
    bb('**Gap**: no one quantifies how much an 802.11 network recovers as load and jammer distance vary.'),

    bh1('III. Methodology'),
    bh2('Tools and setup'),
    btable(T_PARAM, [1, 2.4]), sp(),
    bh2('Test cases'),
    btable(T_CASES, [1, 5]), sp(),
    bh2('Metrics'),
    bb('Throughput, packet loss ratio, mean delay (FlowMonitor / app counters).'),
    bb('Plus SINR at AP, MAC retries per packet, CCA-busy fraction → separates L1 vs. L2.'),
    bb('Denial radius = distance where mean loss crosses 50%.'),
    bh2('Corrections made after first results'),
    bb('**Carrier sense**: ns-3 default froze stations on jammer noise at −82 dBm; changed to 802.11 energy-detect −62 dBm. Baseline unchanged.'),
    bb('**Fading + random layout** added so seeds differ and error bars are real.'),
    bb('**ns-3 bug** in SwitchMaybeToCcaBusy fixed with a one-line patch; all 1,930 runs completed.'),

    bh1('IV. Results and Discussion'),
    bb('Baseline (5 stations, no jammer): **5.0 Mbps, 0% loss, 1.2 ms delay, 38.3 dB SINR**.'),
    bh2('RQ1 — Effect of jamming'),
    btable(T_LOSS, [1, 1, 1, 1]), sp(),
    bb('Inside the radius: **100% loss**.'),
    bb('Outside: loss recovers first, delay later — 16 dBm @ 40 m: 0.2% loss, 6.0 ms (5×); 23 dBm @ 60 m: 0.3%, 11.0 ms (9×); 30 dBm @ 100 m: 0.7%, 12.8 ms (11×).'),
    bh2('RQ3 — Effect of distance'),
    btable(T_RADIUS, [1.2, 1, 1, 1, 1.4]), sp(),
    bb('Loss drops from 100% to ~0% over a 30–40 m band.'),
    bb('+7 dB jammer power → radius × 1.6–1.8 (path loss predicts 1.7).'),
    bb('**Portable threshold**: loss ≈100% below 7 dB SIR, 50% at ~11 dB, <1% above ~16 dB.'),
    bh2('RQ2 — Effect of number of stations'),
    bb('10 stations push the denial radius out **15–25%** vs. 1 station.'),
    bb('Delay at 100 m from 30 dBm jammer: **4.6 / 12.8 / 141 ms** for 1 / 5 / 10 stations.'),
    bb('At 90 m: ~1% loss with 1 or 5 stations, **19%** with 10.'),
    bb('Deep inside the radius load does not matter (100% loss either way).'),
    bh2('RQ4 — Mitigation'),
    btable(T_MIT, [3, 1, 1]), sp(),
    bb('**Channel 6 (clean)**: 0% loss, baseline delay at every distance — full recovery.'),
    bb('**Channel 3 (half overlap)**: ~3 dB benefit; radius 68 → 55 m; 49% of lost packets recovered at 60 m; nothing inside 30 m.'),
    bb('**Rate adaptation**: 5 STA radius 68 → 43 m, 94% recovered at 60 m; 10 STA worse (29% loss at 100 m vs 3%). Likely airtime shortage (hypothesis).'),
    bh2('Layer 1 vs. Layer 2'),
    btable(T_L12, [1, 1, 1, 1, 1.4]), sp(),
    bb('**Near (L2)**: jammer above −62 dBm → stations never transmit; 100% loss, ~0 retries.'),
    bb('**Far (L1)**: stations transmit but SINR too low; 10–13 retries per packet vs 1.1 baseline.'),
    bh2('Extra — Pulsed jammer'),
    bb('On-time 50% / 80% / 90% / 95% / 99%: loss 7% / 3% / 22% / 67% / 100%.'),
    bb('Light load lets queues drain in gaps → jammer must be on ≥90% of the time.'),

    bh1('V. Conclusion and Recommendations'),
    bb('Constant jammer = total denial inside a power-dependent radius (24 m at 16 dBm, 68 m at 1 W).'),
    bb('Near: blocked by carrier sense (L2). Far: corrupted by low SINR (L1).'),
    bb('**Recommendations**:'),
    bb('Switch to a channel with **no overlap** with the jammer.', 1),
    bb('Monitor **delay**, not just loss.', 1),
    bb('Use rate adaptation on light load; test it under load first.', 1),
    bb('Keep SIR at the AP above ~16 dB for HT MCS 7.', 1),
    bb('**Future work**: detection/switch delay, following or leaky jammer, reactive jammers, TCP/heavier load, airtime measurement.'),

    bh1('References'),
    ...REFS.map((r, i) => new Paragraph({ spacing: { after: 60 }, indent: { left: 540, hanging: 540 }, children: [ta(`[${i + 1}]  ${r}`, { size: 20 })] })),
  ] }],
});

(async () => {
  fs.writeFileSync(process.argv[2] + '/NSS_S40B_G06_Final_Report.docx', await Packer.toBuffer(full));
  fs.writeFileSync(process.argv[2] + '/NSS_S40B_G06_Final_Report_Bullets.docx', await Packer.toBuffer(bul));
})();
