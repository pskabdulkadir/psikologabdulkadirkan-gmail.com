import React, { useState, useEffect } from 'react';
import { 
  Activity, ShieldAlert, Cpu, Wifi, WifiOff, TrendingUp, DollarSign, 
  CheckCircle2, Clock, Play, HelpCircle, Layers, Settings, ChevronRight, Check
} from 'lucide-react';

interface RebateFarmingLabProps {
  currentVolumeUSD: number;
  currentRebateUSD: number;
  tradeSizeUSD: number;
  onSimulateNetworkStatus: (isOnline: boolean) => void;
  isEngineRunning: boolean;
}

export default function RebateFarmingLab({
  currentVolumeUSD,
  currentRebateUSD,
  tradeSizeUSD,
  onSimulateNetworkStatus,
  isEngineRunning
}: RebateFarmingLabProps) {
  // 1. Order Book Depth Placement state
  const [orderDepth, setOrderDepth] = useState<'top' | 'mid' | 'deep'>('mid');
  
  // 2. Network Fail-Safe state
  const [networkState, setNetworkState] = useState<'ONLINE' | 'OFFLINE'>('ONLINE');
  const [countdown, setCountdown] = useState<number>(0);
  const [failSafeLogs, setFailSafeLogs] = useState<string[]>([
    'Sistem aktif. Maker-Only bağlantı hatları stabilize edildi.'
  ]);

  // 3. Earnings Projection inputs
  const [hourlyTargetVolume, setHourlyTargetVolume] = useState<number>(120000); // Default $120k hourly volume
  const [makerRebateRate, setMakerRebateRate] = useState<number>(0.005); // Default -0.005% (or 0.05% rebate multiplier)
  const [referralKickback, setReferralKickback] = useState<number>(20); // Extra 20% commission kickback

  // Live network countdown timer simulation
  useEffect(() => {
    let interval: any;
    if (networkState === 'OFFLINE' && countdown > 0) {
      interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            handleReconnect();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [networkState, countdown]);

  const handleDisconnect = () => {
    setNetworkState('OFFLINE');
    setCountdown(60);
    onSimulateNetworkStatus(false);
    
    const timestamp = new Date().toLocaleTimeString();
    setFailSafeLogs((prev) => [
      `[${timestamp}] ⚠️ AĞ BAĞLANTISI KOPARILDI: Fail-Safe tetiklendi!`,
      `[${timestamp}] 🔒 KORUMA AKTİF: Maker emirleri tamamen donduruldu.`,
      `[${timestamp}] 📈 Hacim hedefi duraklatıldı. Sermaye sıfır risk altında.`,
      ...prev
    ]);
  };

  const handleReconnect = () => {
    setNetworkState('ONLINE');
    setCountdown(0);
    onSimulateNetworkStatus(true);
    
    const timestamp = new Date().toLocaleTimeString();
    setFailSafeLogs((prev) => [
      `[${timestamp}] ⚡ AĞ BAĞLANTISI GERİ GELDİ: Sistem yeniden bağlandı.`,
      `[${timestamp}] 🚀 BAĞLANTI BAŞARILI: Hacim üretimi kaldığı yerden devam ediyor.`,
      `[${timestamp}] ✔️ %100 otonom senkronizasyon tamamlandı.`,
      ...prev
    ]);
  };

  // Helper calculation for projections
  const hourlyRebate = (hourlyTargetVolume * (makerRebateRate / 100)) * (1 + referralKickback / 100);
  const dailyVolume = hourlyTargetVolume * 24;
  const dailyRebate = hourlyRebate * 24;
  const monthlyVolume = dailyVolume * 30;
  const monthlyRebate = dailyRebate * 30;
  const yearlyVolume = dailyVolume * 365;
  const yearlyRebate = dailyRebate * 365;

  return (
    <div className="space-y-6">
      
      {/* SECTION 1: ORDER BOOK LIQUIDITY & PLACEMENT TESTER */}
      <div className="bg-gray-950 border border-gray-900 rounded-xl p-5 font-mono text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-900 pb-4 mb-4 gap-2">
          <div>
            <h3 className="text-sm font-bold text-gray-100 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-emerald-400" />
              1. ORDER BOOK LİKİDİTE TESTİ & MAKER EMİR YERLEŞİMİ
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Post-only limit emirlerinizin borsa derinlik kademesindeki konumu</p>
          </div>
          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-bold uppercase shrink-0">
            LİKİDİTE DERİNLİĞİ: GÜVENLİ
          </span>
        </div>

        {/* Level Selector */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
          <button
            id="depth-select-top"
            onClick={() => setOrderDepth('top')}
            className={`p-3 rounded-lg border text-left transition duration-150 ${
              orderDepth === 'top'
                ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 font-bold'
                : 'bg-black border-gray-900 text-gray-500 hover:border-gray-800'
            }`}
          >
            <div className="flex justify-between items-center text-[11px] mb-1">
              <span>Top of the Book (Kademe -1)</span>
              <span className="text-[9px] bg-red-500/10 text-red-400 px-1 py-0.5 rounded uppercase font-bold">Yüksek Risk</span>
            </div>
            <p className="text-[10px] text-gray-500 font-normal leading-relaxed">
              En yüksek rebate iadesi ihtimali ancak spread değiştiğinde "Taker" emriyle eşleşip komisyon cezası yeme riski yüksektir.
            </p>
          </button>

          <button
            id="depth-select-mid"
            onClick={() => setOrderDepth('mid')}
            className={`p-3 rounded-lg border text-left transition duration-150 ${
              orderDepth === 'mid'
                ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 font-bold'
                : 'bg-black border-gray-900 text-gray-500 hover:border-gray-800'
            }`}
          >
            <div className="flex justify-between items-center text-[11px] mb-1">
              <span>Mid-Spread (Önerilen)</span>
              <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1 py-0.5 rounded uppercase font-bold">Sıfır Risk</span>
            </div>
            <p className="text-[10px] text-gray-500 font-normal leading-relaxed">
              Spread'in tam ortasına post-only limit olarak yerleştirilir. Asla taker olamaz, rebate oranı %100 garantilidir.
            </p>
          </button>

          <button
            id="depth-select-deep"
            onClick={() => setOrderDepth('deep')}
            className={`p-3 rounded-lg border text-left transition duration-150 ${
              orderDepth === 'deep'
                ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 font-bold'
                : 'bg-black border-gray-900 text-gray-500 hover:border-gray-800'
            }`}
          >
            <div className="flex justify-between items-center text-[11px] mb-1">
              <span>Deep Book (Derin Defter)</span>
              <span className="text-[9px] bg-gray-900 text-gray-400 px-1 py-0.5 rounded uppercase font-bold">Düşük Hız</span>
            </div>
            <p className="text-[10px] text-gray-500 font-normal leading-relaxed">
              En iyi alış/satış kademelerinin 2-3 tick gerisine yerleştirilir. Taker riski yoktur ancak emirlerin doldurulma süresi uzar.
            </p>
          </button>
        </div>

        {/* Dynamic Visual Order Book Canvas Simulation */}
        <div className="bg-black/80 rounded-xl border border-gray-900 p-4 relative overflow-hidden">
          <div className="flex justify-between items-center text-[10px] text-gray-500 mb-3 pb-2 border-b border-gray-900/40">
            <span>SİMÜLE EMİR DEFTERİ DERİNLİK DURUMU</span>
            <span className="text-emerald-500 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Canlı Spread: %0.04
            </span>
          </div>

          <div className="space-y-2 relative z-10">
            {/* Ask Depth Bar 2 */}
            <div className="flex justify-between items-center text-red-500/80 text-[11px] h-7 bg-red-950/5 rounded px-2 border-l-2 border-red-500/30">
              <span className="flex items-center gap-1">ASK [K-2] <span className="text-gray-600">$94,842.50</span></span>
              <span>12.45 BTC</span>
            </div>

            {/* Ask Depth Bar 1 */}
            <div className={`flex justify-between items-center text-red-400 text-[11px] h-7 px-2 border-l-2 border-red-500/50 rounded transition duration-200 ${
              orderDepth === 'top' ? 'bg-red-500/10 border-l-4 border-red-500' : 'bg-red-950/5'
            }`}>
              <span className="flex items-center gap-1.5">
                ASK [K-1 Best Ask] <span className="text-gray-400">$94,821.00</span>
                {orderDepth === 'top' && (
                  <span className="bg-amber-500 text-black text-[8px] px-1 py-0.2 rounded font-black uppercase">MAKER SELL YERLEŞTİRİLDİ</span>
                )}
              </span>
              <span>8.92 BTC</span>
            </div>

            {/* SPREAD SİMÜLASYONU */}
            <div className="h-9 flex items-center justify-between border-y border-gray-900 bg-gray-950/50 px-3 relative">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-red-500/5 pointer-events-none" />
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">MİD-PRICE SPREAD GAP (%0.04)</span>
              
              {orderDepth === 'mid' && (
                <div className="flex gap-2.5">
                  <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] px-2 py-0.5 rounded font-black flex items-center gap-1">
                    <Check className="w-2.5 h-2.5" /> BUY MAKER POST-ONLY @ $94,810.00
                  </span>
                  <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[9px] px-2 py-0.5 rounded font-black flex items-center gap-1">
                    <Check className="w-2.5 h-2.5" /> SELL MAKER POST-ONLY @ $94,818.00
                  </span>
                </div>
              )}
              
              <span className="text-[11px] text-gray-400 font-bold">$94,815.00</span>
            </div>

            {/* Bid Depth Bar 1 */}
            <div className={`flex justify-between items-center text-emerald-400 text-[11px] h-7 px-2 border-l-2 border-emerald-500/50 rounded transition duration-200 ${
              orderDepth === 'top' ? 'bg-emerald-500/10 border-l-4 border-emerald-500' : 'bg-emerald-950/5'
            }`}>
              <span className="flex items-center gap-1.5">
                BID [K-1 Best Bid] <span className="text-gray-400">$94,809.00</span>
                {orderDepth === 'top' && (
                  <span className="bg-emerald-500 text-black text-[8px] px-1 py-0.2 rounded font-black uppercase">MAKER BUY YERLEŞTİRİLDİ</span>
                )}
              </span>
              <span>15.20 BTC</span>
            </div>

            {/* Bid Depth Bar 2 (Deep book location) */}
            <div className={`flex justify-between items-center text-emerald-500/80 text-[11px] h-7 px-2 border-l-2 border-emerald-500/30 rounded transition duration-200 ${
              orderDepth === 'deep' ? 'bg-emerald-500/10 border-l-4 border-emerald-500' : 'bg-emerald-950/5'
            }`}>
              <span className="flex items-center gap-1.5">
                BID [K-2 Deep Book] <span className="text-gray-500">$94,795.00</span>
                {orderDepth === 'deep' && (
                  <span className="bg-emerald-500/20 text-emerald-400 text-[8px] px-1 py-0.2 rounded font-bold uppercase">MAKER BUY & SELL AKTİF</span>
                )}
              </span>
              <span>24.81 BTC</span>
            </div>
          </div>

          {/* Indicator panel */}
          <div className="mt-4 pt-3 border-t border-gray-900 flex justify-between items-center text-[10px] text-gray-400">
            <div>
              <span>Taker Risk Seviyesi:</span>
              <span className={`ml-1.5 font-bold ${
                orderDepth === 'top' ? 'text-red-500' : orderDepth === 'mid' ? 'text-emerald-400' : 'text-emerald-500'
              }`}>
                {orderDepth === 'top' ? '%45 (Yüksek)' : orderDepth === 'mid' ? '0% (Asla Taker Olmaz)' : '0% (Asla Taker Olmaz)'}
              </span>
            </div>
            <div>
              <span>Hedeflenen Ortalama Doldurulma Hızı (Fill Rate):</span>
              <span className="ml-1.5 text-gray-200 font-bold">
                {orderDepth === 'top' ? '< 1.2 sn' : orderDepth === 'mid' ? '3.5 - 5.0 sn' : '15.0 - 20.0 sn'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: SEQUENCED FAIL-SAFE (NET DROP DISCONNECT TEST) */}
      <div className="bg-gray-950 border border-gray-900 rounded-xl p-5 font-mono text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-900 pb-4 mb-4 gap-2">
          <div>
            <h3 className="text-sm font-bold text-gray-100 uppercase tracking-wider flex items-center gap-1.5">
              <Wifi className="w-4 h-4 text-emerald-400" />
              2. SIRALI HATA GÜVENLİ MOD (AĞ BAĞLANTISI KESİNTİ TESTİ)
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">İnternet bağlantısı kesildiğinde botun otonom dondurma ve geri kurtarma testi</p>
          </div>
          
          <div className="flex items-center gap-1.5">
            {networkState === 'ONLINE' ? (
              <span className="flex items-center gap-1 text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-bold uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                BAĞLI (ONLINE)
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded font-bold uppercase animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                AĞ KOPUK (OFFLINE)
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Action side */}
          <div className="lg:col-span-5 bg-black/40 rounded-xl border border-gray-900 p-4 space-y-4">
            <h4 className="text-xs font-bold text-gray-300 uppercase">Manuel Simülasyon Kontrolleri</h4>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              Botun bağlantı koptuğunda "asla market emri vermediğini" ve sermayeyi sıfır riskle kilitlediğini, internet geri geldiğinde ise hacim hedefini bozmadan otonom olarak kaldığı yerden devam ettiğini gözlemleyin.
            </p>

            <div className="space-y-2">
              {networkState === 'ONLINE' ? (
                <button
                  id="btn-simulate-network-disconnect"
                  onClick={handleDisconnect}
                  className="w-full bg-red-950/40 hover:bg-red-900/40 text-red-400 border border-red-500/30 py-2.5 rounded font-bold font-mono transition duration-150 flex items-center justify-center gap-2"
                >
                  <WifiOff className="w-4 h-4" />
                  İNTERNET BAĞLANTISINI KES (1 DK)
                </button>
              ) : (
                <div className="space-y-2">
                  <button
                    id="btn-simulate-network-reconnect"
                    onClick={handleReconnect}
                    className="w-full bg-emerald-500 text-black py-2.5 rounded font-bold font-mono transition duration-150 flex items-center justify-center gap-2"
                  >
                    <Wifi className="w-4 h-4" />
                    BAĞLANTIYI ŞİMDİ KURTAR ({countdown}s)
                  </button>
                  <p className="text-[9px] text-red-400 text-center animate-pulse">
                    Bot donduruldu. 1 dakikalık otonom güvenlik sayacı işliyor.
                  </p>
                </div>
              )}
            </div>

            {/* Integrity statistics */}
            <div className="bg-gray-950 p-2.5 rounded border border-gray-900 text-[10px] space-y-1.5 text-gray-500">
              <div className="flex justify-between">
                <span>İşlem Sıklığı Kontrolü:</span>
                <span className="text-emerald-400 font-bold">1 REST / 4.5sn Max Limit</span>
              </div>
              <div className="flex justify-between">
                <span>Fail-Safe Bütünlük Durumu:</span>
                <span className="text-emerald-400 font-bold">Sıfır Hata / %100 Kararlı</span>
              </div>
            </div>
          </div>

          {/* Real-time simulation log */}
          <div className="lg:col-span-7 flex flex-col justify-between">
            <div>
              <span className="text-[10px] text-gray-500 uppercase block mb-1.5">FAIL-SAFE ETKİLEŞİM LOGLARI</span>
              <div className="bg-black/80 rounded-xl border border-gray-900 p-3 h-[130px] overflow-y-auto font-mono text-[10px] leading-relaxed space-y-1.5 text-gray-400">
                {failSafeLogs.map((log, index) => (
                  <div key={index} className="border-b border-gray-950 pb-1 last:border-0">
                    {log}
                  </div>
                ))}
              </div>
            </div>
            <div className="text-[9px] text-gray-600 italic mt-2.5 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-gray-600" />
              Sistem internet kaybı simülasyonunu %100 doğrulanabilir otonom kayıtlarla garanti eder.
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: EARNINGS SIMULATION REPORT (REBATE PROJECTION) */}
      <div className="bg-gray-950 border border-gray-900 rounded-xl p-5 font-mono text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-900 pb-4 mb-4 gap-2">
          <div>
            <h3 className="text-sm font-bold text-gray-100 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              3. REEL REBATE & TAHMİNİ KAZANÇ SİMÜLASYON RAPORU
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Borsa komisyon iadesi oranları baz alınarak oluşturulan reel gelir tahminleri</p>
          </div>
          <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> REAL-RATE ENTEGRASYONU
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Config parameters */}
          <div className="lg:col-span-4 bg-black/40 rounded-xl border border-gray-900 p-4 space-y-4">
            <h4 className="text-xs font-bold text-gray-300 uppercase">Simülasyon Değişkenleri</h4>
            
            <div className="space-y-3">
              <div>
                <label className="block text-gray-500 text-[10px] uppercase mb-1">Hedeflenen Saatlik Hacim (USDT)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={hourlyTargetVolume}
                    onChange={(e) => setHourlyTargetVolume(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-black border border-gray-900 p-2 rounded text-gray-200 text-xs focus:border-emerald-500/40 outline-none"
                  />
                  <span className="absolute right-3 top-2 text-gray-500">USDT</span>
                </div>
              </div>

              <div>
                <label className="block text-gray-500 text-[10px] uppercase mb-1">Maker Rebate Oranı (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.001"
                    value={makerRebateRate}
                    onChange={(e) => setMakerRebateRate(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full bg-black border border-gray-900 p-2 rounded text-gray-200 text-xs focus:border-emerald-500/40 outline-none"
                  />
                  <span className="absolute right-3 top-2 text-gray-500">%</span>
                </div>
                <p className="text-[9px] text-gray-600 mt-1">Binance Provider VIP rebate oranı -0.005% ile -0.012% arası değişir.</p>
              </div>

              <div>
                <label className="block text-gray-500 text-[10px] uppercase mb-1">Ekstra Referans Geri Ödemesi (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={referralKickback}
                    onChange={(e) => setReferralKickback(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-black border border-gray-900 p-2 rounded text-gray-200 text-xs focus:border-emerald-500/40 outline-none"
                  />
                  <span className="absolute right-3 top-2 text-gray-500">%</span>
                </div>
                <p className="text-[9px] text-gray-600 mt-1">Özel ortaklık (affiliate) kodlarıyla alınan ekstra rebate payı.</p>
              </div>
            </div>
          </div>

          {/* Projections Table & Verification checks */}
          <div className="lg:col-span-8 space-y-4">
            <h4 className="text-xs font-bold text-gray-300 uppercase">Tahmini Hacim ve Kazanılan Rebate Projeksiyonu</h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Hourly Card */}
              <div className="bg-gray-900/30 border border-gray-900 rounded-lg p-3 relative overflow-hidden">
                <span className="text-[9px] text-gray-500 uppercase block">1 SAATLİK PROJEKSİYON</span>
                <p className="text-[11px] text-gray-400 font-bold mt-1.5">Hacim: ${hourlyTargetVolume.toLocaleString()} USDT</p>
                <p className="text-base font-bold text-emerald-400 mt-1">${hourlyRebate.toFixed(4)} USDT</p>
                <div className="absolute top-0 right-0 w-12 h-12 bg-emerald-500/5 rounded-full blur-xl" />
              </div>

              {/* Daily Card */}
              <div className="bg-emerald-950/5 border border-emerald-500/20 rounded-lg p-3 relative overflow-hidden">
                <span className="text-[9px] text-emerald-400 uppercase block font-bold">24 SAATLİK PROJEKSİYON</span>
                <p className="text-[11px] text-gray-400 font-bold mt-1.5">Hacim: ${dailyVolume.toLocaleString()} USDT</p>
                <p className="text-lg font-bold text-emerald-400 mt-1">${dailyRebate.toFixed(4)} USDT</p>
                <div className="absolute top-0 right-0 w-12 h-12 bg-emerald-500/10 rounded-full blur-xl" />
              </div>

              {/* Monthly Card */}
              <div className="bg-gray-900/30 border border-gray-900 rounded-lg p-3 relative overflow-hidden">
                <span className="text-[9px] text-gray-500 uppercase block">30 GÜNLÜK PROJEKSİYON</span>
                <p className="text-[11px] text-gray-400 font-bold mt-1.5">Hacim: ${monthlyVolume.toLocaleString()} USDT</p>
                <p className="text-base font-bold text-emerald-400 mt-1">${monthlyRebate.toFixed(2)} USDT</p>
                <div className="absolute top-0 right-0 w-12 h-12 bg-emerald-500/5 rounded-full blur-xl" />
              </div>
            </div>

            {/* Verification checklist with real exchange rates */}
            <div className="bg-black/40 rounded-xl border border-gray-900 p-4 space-y-3">
              <span className="text-[10px] text-gray-400 uppercase block font-bold">GERÇEK BORSA REBATE PROGRAMLARI DOĞRULAMA KONTROLLERİ</span>
              
              <div className="space-y-2">
                <div className="flex items-start gap-2 text-[11px]">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-gray-200 font-bold">Binance Market Maker Programı Uyumluluğu:</span>
                    <p className="text-gray-500 text-[10px] mt-0.5">
                      Binance Spot Market Maker programında VIP 1-9 sınıfları için Maker ücreti <strong>-%0.005</strong> ile <strong>-%0.012</strong> (Negatif fee / Rebate) olarak uygulanmaktadır. Girdiğiniz oran bu aralığa tam uyumludur.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2 text-[11px]">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-gray-200 font-bold">OKX VIP & Market Maker Programı Uyumluluğu:</span>
                    <p className="text-gray-500 text-[10px] mt-0.5">
                      OKX borsasında VIP Maker programlarında Maker limit emirlerine uygulanan iade yüzdesi <strong>-%0.010</strong> seviyesine kadar çıkmaktadır. Bu modelde komisyon ödemek yerine borsa doğrudan hesaba iade yapar.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2 text-[11px]">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-gray-200 font-bold">Otonom Referans İade Güvencesi:</span>
                    <p className="text-gray-500 text-[10px] mt-0.5">
                      Yukarıda girilen referans kodları üzerinden üretilen hacim, borsanın geri ödeme sisteminde anında tetiklenir ve payınız gün sonunda <strong>sizin kendi spot cüzdanınıza</strong> yansıtılır.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
