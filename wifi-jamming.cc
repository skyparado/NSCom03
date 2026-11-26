// Usage: ./ns3 run "wifi-jamming --nStations=5 --jammer=on --jammerPower=30 --jammerDistance=60"

#include "ns3/applications-module.h"
#include "ns3/propagation-loss-model.h"
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

class WallLossModel : public PropagationLossModel
{
  public:
    double m_wallLoss = 5.0;
    double m_roomEdge = 12.5;
    double m_wallSpacing = 10.0;

    uint32_t Walls(double xa, double xb) const
    {
        auto k = [this](double x) {
            return x < m_roomEdge ? -1.0 : std::floor((x - m_roomEdge) / m_wallSpacing);
        };
        return uint32_t(std::abs(k(xa) - k(xb)));
    }

  private:
    double DoCalcRxPower(double txPowerDbm, Ptr<MobilityModel> a, Ptr<MobilityModel> b) const override
    {
        return txPowerDbm - m_wallLoss * Walls(a->GetPosition().x, b->GetPosition().x);
    }

    int64_t DoAssignStreams(int64_t) override
    {
        return 0;
    }
};

std::map<Mac48Address, uint32_t> g_staIndex;
std::vector<Ptr<WifiPhy>> g_staPhys;
std::vector<double> g_sinrSumDb;
std::vector<uint32_t> g_sinrFrames;
std::vector<uint32_t> g_retries;
std::vector<uint32_t> g_drops;
std::vector<uint32_t> g_busySamples;
uint32_t g_samples = 0;
double g_switchTime = -1;
std::vector<double> g_firstRxAfterSwitch;

// Frequency argument type differs across ns-3 versions, so it is templated.
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
        AmpduSubframeHeader sub;
        p->RemoveHeader(sub);
    }
    WifiMacHeader hdr;
    p->PeekHeader(hdr);
    auto it = g_staIndex.find(hdr.GetAddr2());
    if (hdr.IsData() && it != g_staIndex.end())
    {
        g_sinrSumDb[it->second] += sn.signal - sn.noise;
        g_sinrFrames[it->second]++;
        double now = Simulator::Now().GetSeconds();
        if (g_switchTime >= 0 && now >= g_switchTime && std::isnan(g_firstRxAfterSwitch[it->second]))
        {
            g_firstRxAfterSwitch[it->second] = now;
        }
    }
}

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

void
SwitchChannel(std::vector<Ptr<WifiPhy>> phys, std::string settings)
{
    g_switchTime = Simulator::Now().GetSeconds();
    for (auto& phy : phys)
    {
        phy->SetAttribute("ChannelSettings", StringValue(settings));
    }
}

int
main(int argc, char* argv[])
{
    uint32_t nStations = 5;
    double jammerDistance = 10.0;
    std::string jammerStr = "on";
    std::string channelSwitchStr = "off";
    uint32_t switchChannel = 3;
    std::string rateAdaptationStr = "off";
    uint32_t seed = 1;
    double jammerPowerDbm = 16.0206;
    double jammerDuty = 1.0;
    // 1 ms bursts need ns3-cca-busy-fix.patch, otherwise ns-3 aborts or hangs.
    double jammerPeriod = 0.001;
    double simTime = 60.0;
    uint32_t pktSize = 1024;
    double rateBps = 1e6;
    std::string out = "wifi-jamming.csv";
    std::string wallsStr = "off";
    double wallLoss = 5.0;
    std::string jammerMaskStr = "off";
    double switchAt = -1;
    std::string traffic = "udp";
    double rateMbps = 1.0;
    uint32_t mcs = 7;

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
    cmd.AddValue("out", "CSV file to append the result rows to", out);
    cmd.AddValue("walls", "Interior walls every 10 m beyond the network's room (on/off)", wallsStr);
    cmd.AddValue("wallLoss", "Attenuation per wall (dB)", wallLoss);
    cmd.AddValue("jammerMask", "Jammer leaks into adjacent channels per 802.11 mask (on/off)", jammerMaskStr);
    cmd.AddValue("switchAt", "Switch channel this many s after the jammer starts (<0: from t=0)", switchAt);
    cmd.AddValue("traffic", "Uplink transport: udp or tcp", traffic);
    cmd.AddValue("rate", "Offered load per station (Mbps)", rateMbps);
    cmd.AddValue("mcs", "Fixed HT MCS index (0-7) when rate adaptation is off", mcs);
    cmd.Parse(argc, argv);

    NS_ABORT_MSG_IF(jammerStr != "on" && jammerStr != "off", "jammer must be on or off");
    NS_ABORT_MSG_IF(channelSwitchStr != "on" && channelSwitchStr != "off",
                    "channelSwitch must be on or off");
    bool jammer = jammerStr == "on";
    NS_ABORT_MSG_IF(rateAdaptationStr != "on" && rateAdaptationStr != "off",
                    "rateAdaptation must be on or off");
    bool channelSwitch = channelSwitchStr == "on";
    bool rateAdaptation = rateAdaptationStr == "on";
    NS_ABORT_MSG_IF(wallsStr != "on" && wallsStr != "off", "walls must be on or off");
    NS_ABORT_MSG_IF(jammerMaskStr != "on" && jammerMaskStr != "off", "jammerMask must be on or off");
    NS_ABORT_MSG_IF(traffic != "udp" && traffic != "tcp", "traffic must be udp or tcp");
    NS_ABORT_MSG_IF(mcs > 7, "mcs must be 0-7");
    NS_ABORT_MSG_IF(switchAt >= 0 && !channelSwitch, "switchAt needs channelSwitch=on");
    bool walls = wallsStr == "on";
    bool jammerMask = jammerMaskStr == "on";
    bool delayedSwitch = channelSwitch && switchAt >= 0;
    rateBps = rateMbps * 1e6;
    Config::SetDefault("ns3::TcpSocket::SegmentSize", UintegerValue(pktSize));

    RngSeedManager::SetSeed(1);
    RngSeedManager::SetRun(seed);

    NodeContainer apNode;
    apNode.Create(1);
    NodeContainer staNodes;
    staNodes.Create(nStations);
    NodeContainer jammerNode;
    jammerNode.Create(1);

    // Ring rotated per seed so no station is always shielded from the jammer.
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
    // Free-space loss at 1 m for 2.4 GHz (ns-3 default is for 5 GHz).
    loss->SetAttribute("ReferenceLoss", DoubleValue(40.05));
    channel->AddPropagationLossModel(loss);
    Ptr<NakagamiPropagationLossModel> fading = CreateObject<NakagamiPropagationLossModel>();
    fading->SetAttribute("m1", DoubleValue(1.5));
    fading->SetAttribute("m2", DoubleValue(1.5));
    channel->AddPropagationLossModel(fading);
    if (walls)
    {
        Ptr<WallLossModel> wallModel = CreateObject<WallLossModel>();
        wallModel->m_wallLoss = wallLoss;
        channel->AddPropagationLossModel(wallModel);
    }
    channel->SetPropagationDelayModel(CreateObject<ConstantSpeedPropagationDelayModel>());

    SpectrumWifiPhyHelper phy;
    phy.SetChannel(channel);
    std::string target = "{" + std::to_string(switchChannel) + ", 20, BAND_2_4GHZ, 0}";
    std::string chSettings = channelSwitch && !delayedSwitch ? target : "{1, 20, BAND_2_4GHZ, 0}";
    phy.Set("ChannelSettings", StringValue(chSettings));
    // 802.11 energy-detect threshold for non-Wi-Fi energy such as the jammer.
    phy.Set("CcaSensitivity", DoubleValue(-62.0));

    WifiHelper wifi;
    wifi.SetStandard(WIFI_STANDARD_80211n);
    if (rateAdaptation)
    {
        wifi.SetRemoteStationManager("ns3::MinstrelHtWifiManager");
    }
    else
    {
        wifi.SetRemoteStationManager("ns3::ConstantRateWifiManager",
                                     "DataMode",
                                     StringValue("HtMcs" + std::to_string(mcs)),
                                     "ControlMode",
                                     StringValue("HtMcs0"));
    }

    WifiMacHelper mac;
    Ssid ssid("nss-jamming");
    mac.SetType("ns3::StaWifiMac", "Ssid", SsidValue(ssid));
    NetDeviceContainer staDevs = wifi.Install(phy, mac, staNodes);
    mac.SetType("ns3::ApWifiMac", "Ssid", SsidValue(ssid));
    NetDeviceContainer apDev = wifi.Install(phy, mac, apNode);

    Bands bands;
    std::vector<double> rel;
    if (jammerMask)
    {
        for (double f = 2372e6; f < 2452e6; f += 1e6)
        {
            BandInfo b;
            b.fl = f;
            b.fc = f + 0.5e6;
            b.fh = f + 1e6;
            bands.push_back(b);
            double off = std::abs(b.fc - 2412e6) / 1e6;
            double dbr = off <= 9    ? 0
                         : off <= 11 ? -20 * (off - 9) / 2
                         : off <= 20 ? -20 - 8 * (off - 11) / 9
                         : off <= 30 ? -28 - 12 * (off - 20) / 10
                                     : -40;
            rel.push_back(std::pow(10.0, dbr / 10));
        }
    }
    else
    {
        BandInfo band;
        band.fl = 2402e6;
        band.fc = 2412e6;
        band.fh = 2422e6;
        bands.push_back(band);
        rel.push_back(1.0);
    }
    Ptr<SpectrumValue> psd = Create<SpectrumValue>(Create<SpectrumModel>(bands));
    double relSum = 0;
    for (uint32_t k = 0; k < bands.size(); ++k)
    {
        relSum += rel[k] * (bands[k].fh - bands[k].fl);
    }
    double jamW = std::pow(10.0, (jammerPowerDbm - 30) / 10);
    for (uint32_t k = 0; k < bands.size(); ++k)
    {
        (*psd)[k] = jamW * rel[k] / relSum;
    }
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
        Simulator::Schedule(Seconds(1.0), &WaveformGenerator::Start, gen);
    }

    g_sinrSumDb.assign(nStations, 0);
    g_sinrFrames.assign(nStations, 0);
    g_retries.assign(nStations, 0);
    g_drops.assign(nStations, 0);
    g_busySamples.assign(nStations, 0);
    g_firstRxAfterSwitch.assign(nStations, std::numeric_limits<double>::quiet_NaN());
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
    if (delayedSwitch)
    {
        std::vector<Ptr<WifiPhy>> allPhys = g_staPhys;
        allPhys.push_back(DynamicCast<WifiNetDevice>(apDev.Get(0))->GetPhy());
        Simulator::Schedule(Seconds(1.0 + switchAt), &SwitchChannel, allPhys, target);
    }

    InternetStackHelper stack;
    stack.Install(apNode);
    stack.Install(staNodes);
    Ipv4AddressHelper addr;
    addr.SetBase("10.1.1.0", "255.255.255.0");
    Ipv4InterfaceContainer apIf = addr.Assign(apDev);
    Ipv4InterfaceContainer staIf = addr.Assign(staDevs);

    uint16_t port = 9;
    ApplicationContainer serverApp;
    ApplicationContainer clientApps;
    if (traffic == "udp")
    {
        UdpServerHelper server(port);
        serverApp = server.Install(apNode);
        UdpClientHelper client(apIf.GetAddress(0), port);
        client.SetAttribute("MaxPackets", UintegerValue(std::numeric_limits<uint32_t>::max()));
        client.SetAttribute("Interval", TimeValue(Seconds(pktSize * 8 / rateBps)));
        client.SetAttribute("PacketSize", UintegerValue(pktSize));
        clientApps = client.Install(staNodes);
    }
    else
    {
        PacketSinkHelper sink("ns3::TcpSocketFactory", InetSocketAddress(Ipv4Address::GetAny(), port));
        serverApp = sink.Install(apNode);
        OnOffHelper client("ns3::TcpSocketFactory", InetSocketAddress(apIf.GetAddress(0), port));
        client.SetConstantRate(DataRate(uint64_t(rateBps)), pktSize);
        clientApps = client.Install(staNodes);
    }
    serverApp.Start(Seconds(0.5));
    serverApp.Stop(Seconds(simTime + 2));
    clientApps.Start(Seconds(1.0));
    clientApps.Stop(Seconds(1.0 + simTime));

    FlowMonitorHelper fmHelper;
    fmHelper.Install(apNode);
    fmHelper.Install(staNodes);
    Ptr<FlowMonitor> monitor = fmHelper.GetMonitor();

    Simulator::Stop(Seconds(simTime + 2));
    Simulator::Run();

    monitor->CheckForLostPackets();
    Ptr<Ipv4FlowClassifier> classifier =
        DynamicCast<Ipv4FlowClassifier>(fmHelper.GetClassifier());
    std::vector<uint64_t> tx(nStations, 0);
    std::vector<uint64_t> rx(nStations, 0);
    std::vector<double> delaySum(nStations, 0);
    for (const auto& [id, st] : monitor->GetFlowStats())
    {
        uint32_t i = classifier->FindFlow(id).sourceAddress.Get() - staIf.GetAddress(0).Get();
        if (i >= nStations)
        {
            continue;
        }
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
             "ccaBusy,walls,jammerMask,traffic,rateMbps,mcs,switchAt,recoveryMs\n";
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
          << rx[i] * pktSize * 8.0 / simTime / 1e6 << ','
          << (tx[i] ? double(tx[i] - rx[i]) / tx[i] : nan) << ','
          << (rx[i] ? delaySum[i] / rx[i] * 1000 : nan) << ','
          << (g_sinrFrames[i] ? g_sinrSumDb[i] / g_sinrFrames[i] : nan) << ','
          << g_retries[i] << ',' << g_drops[i] << ','
          << double(g_busySamples[i]) / g_samples << ','
          << walls << ',' << jammerMask << ',' << traffic << ',' << rateMbps << ','
          << (rateAdaptation ? -1 : int(mcs)) << ',' << switchAt << ','
          << (g_switchTime >= 0 ? (g_firstRxAfterSwitch[i] - g_switchTime) * 1000 : nan) << '\n';
    }
    uint64_t txAll = 0;
    uint64_t rxAll = 0;
    for (uint32_t i = 0; i < nStations; ++i)
    {
        txAll += tx[i];
        rxAll += rx[i];
    }
    std::cout << "tx=" << txAll << " rx=" << rxAll << " (" << nStations << " stations)\n";

    Simulator::Destroy();
    return 0;
}
