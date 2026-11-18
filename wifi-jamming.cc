// One 802.11n BSS (AP + N stations) on 2.4 GHz with an optional constant jammer.
// Copy to <ns-3>/scratch/ and run:
//   ./ns3 run "wifi-jamming --nStations=5 --jammerDistance=10 --jammer=on --channelSwitch=off --seed=1"
// Appends one CSV row per station to --out; plot.py aggregates them per run.

#include "ns3/applications-module.h"
#include "ns3/core-module.h"
#include "ns3/flow-monitor-module.h"
#include "ns3/internet-module.h"
#include "ns3/mobility-module.h"
#include "ns3/network-module.h"
#include "ns3/spectrum-module.h"
#include "ns3/wifi-module.h"

#include <cmath>
#include <fstream>
#include <limits>
#include <map>
#include <vector>

using namespace ns3;

NS_LOG_COMPONENT_DEFINE("WifiJamming");

// Per-station Layer 1 / Layer 2 counters, filled by the trace callbacks below.
std::map<Mac48Address, uint32_t> g_staIndex;
std::vector<Ptr<WifiPhy>> g_staPhys;
std::vector<double> g_sinrSumDb;
std::vector<uint32_t> g_sinrFrames;
std::vector<uint32_t> g_retries;
std::vector<uint32_t> g_drops;
std::vector<uint32_t> g_busySamples;
uint32_t g_samples = 0;

// SINR of each data frame the AP decodes. The sniffer's "noise" is rxPower / SINR, so
// signal - noise is the SINR in dB. Templated on the frequency argument because its type
// changed across ns-3 releases (uint16_t -> MHz_u); it is deduced from MonitorSnifferRxCallback.
template <typename Freq>
void
OnApSnifferRx(Ptr<const Packet> packet,
              Freq,
              WifiTxVector,
              MpduInfo mpdu,
              SignalNoiseDbm sn,
              uint16_t)
{
    Ptr<Packet> p = packet->Copy();
    if (mpdu.type != NORMAL_MPDU)
    {
        AmpduSubframeHeader sub; // A-MPDU subframes carry this in front of the MAC header
        p->RemoveHeader(sub);
    }
    WifiMacHeader hdr;
    p->PeekHeader(hdr);
    auto it = g_staIndex.find(hdr.GetAddr2());
    if (hdr.IsData() && it != g_staIndex.end())
    {
        g_sinrSumDb[it->second] += sn.signal - sn.noise;
        g_sinrFrames[it->second]++;
    }
}

// shortcut: fires on ACK timeouts only; MPDUs lost inside a Block-Ack'ed A-MPDU are not
// counted. Upgrade to the MAC "AckedMpdu"/"DroppedMpdu" traces if aggregation dominates.
void
OnRetry(uint32_t i, Mac48Address)
{
    g_retries[i]++;
}

void
OnDrop(uint32_t i, Mac48Address)
{
    g_drops[i]++;
}

// Sample every 1 ms whether each station senses the medium busy without decoding a frame
// (CCA_BUSY), i.e. CSMA/CA deferral caused by energy such as the jammer. Polling avoids the
// State trace, which never reports a busy period that is still running at the end.
void
SampleCca(Time stop)
{
    for (uint32_t i = 0; i < g_staPhys.size(); ++i)
    {
        g_busySamples[i] += g_staPhys[i]->IsStateCcaBusy();
    }
    g_samples++;
    if (Simulator::Now() + MilliSeconds(1) < stop)
    {
        Simulator::Schedule(MilliSeconds(1), &SampleCca, stop);
    }
}

// Dynamic channel switch: cumulative packets received by the AP's UDP server, sampled at
// t = 0, 1, 2, ... s. (Reads GetReceived(), which is stable across ns-3 versions, unlike the
// server's Rx trace whose signature changed.) The difference of two samples is packets per second.
std::vector<uint64_t> g_rxCum;

void
SampleServerRx(Ptr<UdpServer> srv)
{
    size_t s = static_cast<size_t>(Simulator::Now().GetSeconds() + 0.5);
    if (s < g_rxCum.size())
    {
        g_rxCum[s] = srv->GetReceived();
    }
    if (s + 1 < g_rxCum.size())
    {
        Simulator::Schedule(Seconds(1), &SampleServerRx, srv);
    }
}

// Retune one device to another 20 MHz channel in the 2.4 GHz band, mid-run.
void
SwitchChannel(Ptr<WifiNetDevice> dev, uint8_t channel)
{
    dev->GetPhy()->SetOperatingChannel(
        WifiPhy::ChannelTuple{channel, 20, WIFI_PHY_BAND_2_4GHZ, 0});
}

int
main(int argc, char* argv[])
{
    uint32_t nStations = 5;
    double jammerDistance = 10.0; // m from the AP
    std::string jammerStr = "on";
    std::string channelSwitchStr = "off"; // T5: victim BSS moves to switchChannel, jammer stays on 1
    uint32_t switchChannel = 3;           // target channel when switching: 3 half-overlaps ch 1, 6/11 are clean
    std::string rateAdaptationStr = "off"; // off = fixed HtMcs7 (proposal), on = Minstrel-HT
    uint32_t seed = 1;
    double jammerPowerDbm = 16.0206; // ns-3 default WifiPhy TxPower
    double jammerDuty = 1.0;         // fraction of time the jammer is on (1.0 = constant)
    // One jammer burst cycle. Each burst gets its own fading draw, so 1 ms gives the jammer the
    // same frame-by-frame fading as the Wi-Fi links. Needs ns3-cca-busy-fix.patch: without it
    // ns-3 aborts ("Invalid WifiPhy state RX") or hangs when bursts start this often.
    double jammerPeriod = 0.001;
    double simTime = 60.0;           // traffic duration, s
    double switchTime = -1.0;        // >= 0: switch channel mid-run at this time (s); < 0 = static
    uint32_t pktSize = 1024;         // bytes
    double rateBps = 1e6;            // per station
    std::string out = "wifi-jamming.csv";

    CommandLine cmd(__FILE__);
    cmd.AddValue("nStations", "Number of stations", nStations);
    cmd.AddValue("jammerDistance", "Jammer distance from the AP (m)", jammerDistance);
    cmd.AddValue("jammer", "Enable the constant jammer (on/off)", jammerStr);
    cmd.AddValue("channelSwitch", "Move AP and stations off channel 1 (on/off)", channelSwitchStr);
    cmd.AddValue("switchChannel", "Target channel when switching (3=overlap, 6/11=clean)", switchChannel);
    cmd.AddValue("rateAdaptation", "Minstrel-HT rate adaptation instead of fixed HtMcs7 (on/off)", rateAdaptationStr);
    cmd.AddValue("seed", "Run number for the RNG", seed);
    cmd.AddValue("jammerPower", "Jammer Tx power (dBm), for calibration", jammerPowerDbm);
    cmd.AddValue("jammerDuty", "Jammer on-fraction 0..1 (1.0 = constant)", jammerDuty);
    cmd.AddValue("jammerPeriod", "Jammer burst cycle (s)", jammerPeriod);
    cmd.AddValue("simTime", "Traffic duration (s)", simTime);
    cmd.AddValue("switchTime",
                 "Time (s) of a mid-run channel switch with --channelSwitch=on; <0 = static",
                 switchTime);
    cmd.AddValue("out", "CSV file to append the result rows to", out);
    cmd.Parse(argc, argv);

    // CommandLine parses bool as true/false/1/0, not on/off, so take these as strings.
    NS_ABORT_MSG_IF(jammerStr != "on" && jammerStr != "off", "jammer must be on or off");
    NS_ABORT_MSG_IF(channelSwitchStr != "on" && channelSwitchStr != "off",
                    "channelSwitch must be on or off");
    bool jammer = jammerStr == "on";
    NS_ABORT_MSG_IF(rateAdaptationStr != "on" && rateAdaptationStr != "off",
                    "rateAdaptation must be on or off");
    bool channelSwitch = channelSwitchStr == "on";
    bool rateAdaptation = rateAdaptationStr == "on";
    bool dynamicSwitch = channelSwitch && switchTime >= 0;
    NS_ABORT_MSG_IF(dynamicSwitch && (switchTime < 1.0 || switchTime > 1.0 + simTime),
                    "switchTime must fall inside the traffic period (1 s to 1 s + simTime)");

    RngSeedManager::SetSeed(1);
    RngSeedManager::SetRun(seed);

    NodeContainer apNode;
    apNode.Create(1);
    NodeContainer staNodes;
    staNodes.Create(nStations);
    NodeContainer jammerNode;
    jammerNode.Create(1);

    // AP at origin, stations on a 10 m circle, jammer on the +x axis.
    // The ring is rotated by a random angle per seed: with a fixed layout a lone station always
    // sat on the side away from the jammer, so "fewer stations" looked more robust than it is.
    // Drawn first so a seed gives the same layout in every scenario (paired comparisons).
    double phase = CreateObject<UniformRandomVariable>()->GetValue(0, 2 * M_PI);
    Ptr<ListPositionAllocator> pos = CreateObject<ListPositionAllocator>();
    pos->Add(Vector(0, 0, 0));
    for (uint32_t i = 0; i < nStations; ++i)
    {
        double a = phase + 2 * M_PI * i / nStations;
        pos->Add(Vector(10 * std::cos(a), 10 * std::sin(a), 0));
    }
    pos->Add(Vector(jammerDistance, 0, 0));
    MobilityHelper mobility;
    mobility.SetPositionAllocator(pos);
    mobility.SetMobilityModel("ns3::ConstantPositionMobilityModel");
    mobility.Install(apNode);
    mobility.Install(staNodes);
    mobility.Install(jammerNode);

    Ptr<MultiModelSpectrumChannel> channel = CreateObject<MultiModelSpectrumChannel>();
    Ptr<LogDistancePropagationLossModel> loss = CreateObject<LogDistancePropagationLossModel>();
    // Free-space loss at 1 m for 2.4 GHz; the default (46.68 dB) is for 5.15 GHz.
    loss->SetAttribute("ReferenceLoss", DoubleValue(40.05));
    channel->AddPropagationLossModel(loss);
    // Multipath fading on top of path loss: makes per-frame SINR vary, so seeds differ and the
    // jammer's edge is a gradient instead of a cliff. One m for every distance: the default
    // drops to 0.75 beyond 80 m, which would put a kink in the 10-100 m jammer-distance sweep.
    Ptr<NakagamiPropagationLossModel> fading = CreateObject<NakagamiPropagationLossModel>();
    fading->SetAttribute("m1", DoubleValue(1.5));
    fading->SetAttribute("m2", DoubleValue(1.5));
    channel->AddPropagationLossModel(fading);
    channel->SetPropagationDelayModel(CreateObject<ConstantSpeedPropagationDelayModel>());

    SpectrumWifiPhyHelper phy;
    phy.SetChannel(channel);
    // Switch off channel 1 to switchChannel: channel 3 half-overlaps the jammer (partial relief),
    // channel 6/11 are clean (full escape). Comparing them shows what the mitigation actually buys.
    // Dynamic mode starts on channel 1 (jammed) and moves at switchTime instead.
    std::string chSettings = (channelSwitch && !dynamicSwitch)
                                 ? "{" + std::to_string(switchChannel) + ", 20, BAND_2_4GHZ, 0}"
                                 : "{1, 20, BAND_2_4GHZ, 0}";
    phy.Set("ChannelSettings", StringValue(chSettings));
    // 802.11 holds CCA busy for energy that is not a decoded Wi-Fi preamble only above -62 dBm.
    // ns-3's default applies -82 dBm to all in-band energy after any frame, so a jammer 20 dB
    // too weak to trip a real radio's energy detect still froze the stations until its burst
    // ended; the burst length then decided the loss (50%-loss distance 23 m at 1 ms bursts,
    // 51 m at 100 ms, 88 m at 1 s). The no-jammer baseline is the same with either value.
    phy.Set("CcaSensitivity", DoubleValue(-62.0));

    WifiHelper wifi;
    wifi.SetStandard(WIFI_STANDARD_80211n);
    // Fixed rate by default so results reflect jamming, not rate adaptation (see Scope).
    // Minstrel-HT is what real devices run: it falls back to slower, more robust rates.
    if (rateAdaptation)
    {
        wifi.SetRemoteStationManager("ns3::MinstrelHtWifiManager");
    }
    else
    {
        wifi.SetRemoteStationManager("ns3::ConstantRateWifiManager",
                                     "DataMode",
                                     StringValue("HtMcs7"),
                                     "ControlMode",
                                     StringValue("HtMcs0"));
    }

    WifiMacHelper mac;
    Ssid ssid("nss-jamming");
    mac.SetType("ns3::StaWifiMac", "Ssid", SsidValue(ssid));
    NetDeviceContainer staDevs = wifi.Install(phy, mac, staNodes);
    mac.SetType("ns3::ApWifiMac", "Ssid", SsidValue(ssid));
    NetDeviceContainer apDev = wifi.Install(phy, mac, apNode);

    // Constant jammer: waveform generator, back-to-back bursts over channel 1 (2402-2422 MHz).
    // It ignores CSMA/CA, unlike a regular Wi-Fi node.
    BandInfo band;
    band.fl = 2402e6;
    band.fc = 2412e6;
    band.fh = 2422e6;
    Bands bands{band};
    Ptr<SpectrumValue> psd = Create<SpectrumValue>(Create<SpectrumModel>(bands));
    *psd = std::pow(10.0, (jammerPowerDbm - 30) / 10) / 20e6; // W/Hz
    WaveformGeneratorHelper wg;
    wg.SetChannel(channel);
    wg.SetTxPowerSpectralDensity(psd);
    wg.SetPhyAttribute("Period", TimeValue(Seconds(jammerPeriod)));
    wg.SetPhyAttribute("DutyCycle", DoubleValue(jammerDuty));
    NetDeviceContainer jamDev = wg.Install(jammerNode);
    if (jammer)
    {
        Ptr<WaveformGenerator> gen = DynamicCast<NonCommunicatingNetDevice>(jamDev.Get(0))
                                         ->GetPhy()
                                         ->GetObject<WaveformGenerator>();
        // Start with the traffic, after the stations have associated.
        Simulator::Schedule(Seconds(1.0), &WaveformGenerator::Start, gen);
    }

    // Layer 1 / Layer 2 instrumentation.
    g_sinrSumDb.assign(nStations, 0);
    g_sinrFrames.assign(nStations, 0);
    g_retries.assign(nStations, 0);
    g_drops.assign(nStations, 0);
    g_busySamples.assign(nStations, 0);
    for (uint32_t i = 0; i < nStations; ++i)
    {
        Ptr<WifiNetDevice> dev = DynamicCast<WifiNetDevice>(staDevs.Get(i));
        g_staIndex[Mac48Address::ConvertFrom(dev->GetAddress())] = i;
        g_staPhys.push_back(dev->GetPhy());
        dev->GetRemoteStationManager()->TraceConnectWithoutContext(
            "MacTxDataFailed",
            MakeBoundCallback(&OnRetry, i));
        dev->GetRemoteStationManager()->TraceConnectWithoutContext(
            "MacTxFinalDataFailed",
            MakeBoundCallback(&OnDrop, i));
    }
    WifiPhy::MonitorSnifferRxCallback sniffer = &OnApSnifferRx;
    DynamicCast<WifiNetDevice>(apDev.Get(0))
        ->GetPhy()
        ->TraceConnectWithoutContext("MonitorSnifferRx", MakeCallback(sniffer));
    Simulator::Schedule(Seconds(1.0), &SampleCca, Seconds(1.0 + simTime));

    InternetStackHelper stack;
    stack.Install(apNode);
    stack.Install(staNodes);
    Ipv4AddressHelper addr;
    addr.SetBase("10.1.1.0", "255.255.255.0");
    Ipv4InterfaceContainer apIf = addr.Assign(apDev);
    Ipv4InterfaceContainer staIf = addr.Assign(staDevs);

    uint16_t port = 9;
    UdpServerHelper server(port);
    ApplicationContainer serverApp = server.Install(apNode);
    serverApp.Start(Seconds(0.5));
    serverApp.Stop(Seconds(simTime + 2));
    if (dynamicSwitch)
    {
        g_rxCum.assign(static_cast<size_t>(simTime) + 2, 0); // samples at t = 0 .. simTime + 1
        Simulator::ScheduleNow(&SampleServerRx, DynamicCast<UdpServer>(serverApp.Get(0)));
        // At switchTime the AP and every station move to the new channel; the jammer stays on 1.
        Simulator::Schedule(Seconds(switchTime),
                            &SwitchChannel,
                            DynamicCast<WifiNetDevice>(apDev.Get(0)),
                            static_cast<uint8_t>(switchChannel));
        for (uint32_t i = 0; i < nStations; ++i)
        {
            Simulator::Schedule(Seconds(switchTime),
                                &SwitchChannel,
                                DynamicCast<WifiNetDevice>(staDevs.Get(i)),
                                static_cast<uint8_t>(switchChannel));
        }
    }

    UdpClientHelper client(apIf.GetAddress(0), port);
    client.SetAttribute("MaxPackets", UintegerValue(std::numeric_limits<uint32_t>::max()));
    client.SetAttribute("Interval", TimeValue(Seconds(pktSize * 8 / rateBps)));
    client.SetAttribute("PacketSize", UintegerValue(pktSize));
    ApplicationContainer clientApps = client.Install(staNodes);
    clientApps.Start(Seconds(1.0));
    clientApps.Stop(Seconds(1.0 + simTime));

    FlowMonitorHelper fmHelper;
    fmHelper.Install(apNode);
    fmHelper.Install(staNodes);
    Ptr<FlowMonitor> monitor = fmHelper.GetMonitor();

    // 1 s after traffic stops lets in-flight packets arrive; anything still queued counts as lost.
    Simulator::Stop(Seconds(simTime + 2));
    Simulator::Run();

    // Map each flow to its station by source address (stations get consecutive addresses).
    monitor->CheckForLostPackets();
    Ptr<Ipv4FlowClassifier> classifier =
        DynamicCast<Ipv4FlowClassifier>(fmHelper.GetClassifier());
    std::vector<uint64_t> tx(nStations, 0);
    std::vector<uint64_t> rx(nStations, 0);
    std::vector<double> delaySum(nStations, 0);
    for (const auto& [id, st] : monitor->GetFlowStats())
    {
        uint32_t i = classifier->FindFlow(id).sourceAddress.Get() - staIf.GetAddress(0).Get();
        NS_ASSERT_MSG(i < nStations, "flow from an unknown source");
        tx[i] += st.txPackets;
        rx[i] += st.rxPackets;
        delaySum[i] += st.delaySum.GetSeconds();
    }

    bool newFile = !std::ifstream(out).good();
    std::ofstream f(out, std::ios::app);
    if (newFile)
    {
        f << "nStations,jammer,jammerPower,jammerDistance,channelSwitch,switchChannel,rateAdaptation,jammerDuty,seed,station,distToJammer,"
             "txPackets,rxPackets,throughputMbps,lossRatio,meanDelayMs,sinrDb,retries,drops,"
             "ccaBusy\n";
    }
    double nan = std::numeric_limits<double>::quiet_NaN();
    Ptr<MobilityModel> jamPos = jammerNode.Get(0)->GetObject<MobilityModel>();
    for (uint32_t i = 0; i < nStations; ++i)
    {
        double dist = staNodes.Get(i)->GetObject<MobilityModel>()->GetDistanceFrom(jamPos);
        f << nStations << ',' << jammer << ',' << jammerPowerDbm << ',' << jammerDistance << ','
          << channelSwitch << ','
          << switchChannel << ',' << rateAdaptation << ',' << jammerDuty << ','
          << seed << ',' << i << ',' << dist << ',' << tx[i] << ',' << rx[i] << ','
          << rx[i] * pktSize * 8.0 / simTime / 1e6 << ','                   // application bits
          << (tx[i] ? double(tx[i] - rx[i]) / tx[i] : nan) << ','           // loss ratio
          << (rx[i] ? delaySum[i] / rx[i] * 1000 : nan) << ','              // mean delay, ms
          << (g_sinrFrames[i] ? g_sinrSumDb[i] / g_sinrFrames[i] : nan) << ',' // SINR at AP, dB
          << g_retries[i] << ',' << g_drops[i] << ','
          << double(g_busySamples[i]) / g_samples << '\n';
    }
    uint64_t txAll = 0;
    uint64_t rxAll = 0;
    for (uint32_t i = 0; i < nStations; ++i)
    {
        txAll += tx[i];
        rxAll += rx[i];
    }
    if (dynamicSwitch)
    {
        // Packets received per second at the AP, one row per second, appended like the main CSV.
        std::string tl = out + ".timeline.csv";
        bool newTl = !std::ifstream(tl).good();
        std::ofstream t(tl, std::ios::app);
        if (newTl)
        {
            t << "nStations,jammerPower,jammerDistance,switchChannel,switchTime,seed,second,rxPackets\n";
        }
        for (size_t s = 0; s + 1 < g_rxCum.size(); ++s)
        {
            t << nStations << ',' << jammerPowerDbm << ',' << jammerDistance << ','
              << switchChannel << ',' << switchTime << ',' << seed << ',' << s << ','
              << g_rxCum[s + 1] - g_rxCum[s] << '\n'; // packets received in [s, s+1)
        }
    }
    std::cout << "tx=" << txAll << " rx=" << rxAll << " (" << nStations << " stations)\n";

    Simulator::Destroy();
    return 0;
}