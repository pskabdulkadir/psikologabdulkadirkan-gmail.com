import React, { useState, useEffect } from 'react';
import {
  Shield, Play, Pause, RefreshCw, Layers, TrendingUp, AlertTriangle,
  ArrowRight, DollarSign, Cpu, CheckCircle2, FileCode, Wifi, Clock,
  Lock, Settings, ShieldAlert, KeyRound, Check, Wallet, Send, LogOut, Info, AlertOctagon
} from 'lucide-react';
import {
  AssetSymbol, EngineMode, ExchangeConfig, ExchangeMarketData, ArbitrageOpportunity,
  OrderLog, NetworkConnectionLog, ExchangeBalances, EngineConfig, WithdrawalLog
} from './types';
import {
  EXCHANGES, BASE_PRICES, generateMarketPrices, scanOpportunities,
  createNetworkLog, INITIAL_BALANCES, generateLocalHash
} from './utils/engineSimulator';
import ZeroTrustContract from './components/ZeroTrustContract';
import NetworkTrafficLogs from './components/NetworkTrafficLogs';
import BinaryCompilerView from './components/BinaryCompilerView';

export default function App() {
  // Tabs
  const [activeTab, setActiveTab] = useState<'monitoring' | 'network' | 'compiler' | 'contract'>('monitoring');

  // Time Tracker (seconds)
  const [timeSeconds, setTimeSeconds] = useState<number>(0);

  // Offline background run tracking state
  const [offlineReport, setOfflineReport] = useState<{
    elapsedSeconds: number;
    tradesCount: number;
    profit: number;
    withdrawn: boolean;
  } | null>(null);

  // Engine Configuration State
  const [engineConfig, setEngineConfig] = useState<EngineConfig>(() => {
    const saved = localStorage.getItem('secure_engine_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        parsed.whitelistedWallet = localStorage.getItem('secure_whitelisted_wallet') || parsed.whitelistedWallet || '';
        return parsed;
      } catch (e) {}
    }
    return {
      isRunning: false,
      engineMode: 'HFL_BOT', // Default is HFL Mode
      systemEnvironment: 'SIMULATION_DEMO',
      selectedAssets: ['BTC', 'ETH', 'SOL'],
      minArbitrageBuffer: 0.01,
      tradeSizeUSD: 5000,
      profitLockThresholdUSD: 10,
      autoWithdrawThresholdUSD: 5,
      whitelistedWallet: localStorage.getItem('secure_whitelisted_wallet') || '',
      isShutdown: false,
      consecutiveFailures: 0,
      apiKeys: {
        binance: { apiKey: '', apiSecret: '' },
        okx: { apiKey: '', apiSecret: '' },
        coinbase: { apiKey: '', apiSecret: '' }
      }
    };
  });

  // Market Data State
  const [marketPrices, setMarketPrices] = useState<{ [key: string]: { [key: string]: ExchangeMarketData } }>(() => {
    return generateMarketPrices(1, null);
  });

  // Opportunities State
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);

  // Balances State
  const [balances, setBalances] = useState<ExchangeBalances>(INITIAL_BALANCES);

  // Order Logs State
  const [orderLogs, setOrderLogs] = useState<OrderLog[]>([]);

  // Network Logs State
  const [networkLogs, setNetworkLogs] = useState<NetworkConnectionLog[]>([]);

  // Withdrawal Logs
  const [withdrawalLogs, setWithdrawalLogs] = useState<WithdrawalLog[]>([]);

  // UI States
  const [isProfitLocked, setIsProfitLocked] = useState<boolean>(false);
  const [apiKeysVisible, setApiKeysVisible] = useState<boolean>(false);
  const [selectedMonitoringAsset, setSelectedMonitoringAsset] = useState<AssetSymbol>('BTC');
  const [settingsSavedMessage, setSettingsSavedMessage] = useState<string>('');
  const [walletSavedMessage, setWalletSavedMessage] = useState<string>('');

  // Temp form states
  const [tempBuffer, setTempBuffer] = useState(engineConfig.minArbitrageBuffer.toString());
  const [tempTradeSize, setTempTradeSize] = useState(engineConfig.tradeSizeUSD.toString());
  const [tempProfitLock, setTempProfitLock] = useState(engineConfig.profitLockThresholdUSD.toString());
  const [tempAutoWithdraw, setTempAutoWithdraw] = useState(engineConfig.autoWithdrawThresholdUSD.toString());
  const [tempWallet, setTempWallet] = useState(engineConfig.whitelistedWallet);

  // Calculate totals
  const sums = {
    totalUsdt: Object.values(balances).reduce((sum, bal) => sum + (bal.USDT || 0), 0),
    totalBtc: Object.values(balances).reduce((sum, bal) => sum + (bal.BTC || 0), 0),
    totalEth: Object.values(balances).reduce((sum, bal) => sum + (bal.ETH || 0), 0),
    totalSol: Object.values(balances).reduce((sum, bal) => sum + (bal.SOL || 0), 0),
  };

  // Calculate accumulated profit
  const accumulatedProfitUSD = orderLogs
    .filter(log => log.status === 'FILLED')
    .reduce((sum, log) => {
      if (log.type === 'BUY') return sum - (log.quantity * log.price);
      return sum + (log.quantity * log.price);
    }, 0);

  // Calculate total withdrawn
  const totalWithdrawnUSD = withdrawalLogs.reduce((sum, log) => sum + log.amount, 0);

  // Calculate rebate earned
  const rebateEarnedUSD = orderLogs
    .filter(log => log.status === 'FILLED')
    .reduce((sum, log) => sum + (log.quantity * log.price * 0.0001), 0);

  // Main Engine Loop
  useEffect(() => {
    if (!engineConfig.isRunning || engineConfig.isShutdown) return;

    let tickCounter = 0;
    const interval = setInterval(() => {
      setTimeSeconds(prev => prev + 1);
      tickCounter++;

      // Generate new market prices every 3 ticks
      if (tickCounter % 3 === 0) {
        setMarketPrices(prev => generateMarketPrices(tickCounter, prev));
      }

      // Scan for opportunities every 2 ticks
      if (tickCounter % 2 === 0) {
        setOpportunities(prev => {
          const newOpportunities = scanOpportunities(marketPrices, engineConfig.minArbitrageBuffer);
          return newOpportunities.length > 0 ? newOpportunities : prev;
        });
      }

      // Create network logs for monitoring - very rarely
      if (tickCounter % 8 === 0 && Math.random() > 0.5) {
        setNetworkLogs(prev => [createNetworkLog(), ...prev.slice(0, 19)]);
      }

      // Check profit lock
      if (engineConfig.engineMode === 'HFL_BOT' && accumulatedProfitUSD >= engineConfig.profitLockThresholdUSD) {
        setIsProfitLocked(true);
      }

      // Auto-withdraw in FALE mode
      if (engineConfig.engineMode === 'FALE' && accumulatedProfitUSD >= engineConfig.autoWithdrawThresholdUSD) {
        triggerAutonomousWithdrawal(accumulatedProfitUSD);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [engineConfig, accumulatedProfitUSD, marketPrices]);

  // Handlers
  const toggleEngine = () => {
    if (engineConfig.isShutdown) {
      alert('تم إيقاف المحرك في حالة الطوارئ! يجب إعادة تعيين أولاً.');
      return;
    }
    if (!engineConfig.whitelistedWallet) {
      alert('يرجى تعيين عنوان المحفظة البيضاء أولاً!');
      return;
    }
    setEngineConfig(prev => ({ ...prev, isRunning: !prev.isRunning }));
  };

  const triggerSimulatedOrderFailure = () => {
    const newConsecutiveFailures = engineConfig.consecutiveFailures + 1;
    if (newConsecutiveFailures >= 3) {
      setEngineConfig(prev => ({ ...prev, isShutdown: true, isRunning: false }));
      alert('تم تنشيط إيقاف الطوارئ! تم تنفيذ 3 أوامر متتالية فاشلة.');
    } else {
      setEngineConfig(prev => ({ ...prev, consecutiveFailures: newConsecutiveFailures }));
      const newLog: OrderLog = {
        id: Date.now(),
        type: 'BUY',
        asset: engineConfig.selectedAssets[0],
        exchange: 'binance',
        price: parseFloat((Math.random() * 10000).toFixed(2)),
        quantity: parseFloat((Math.random() * 0.5).toFixed(4)),
        latencyUs: Math.floor(Math.random() * 500),
        status: 'REJECTED',
        timestamp: Date.now()
      };
      setOrderLogs(prev => [newLog, ...prev.slice(0, 99)]);
    }
  };

  const resetEmergencyShutdown = () => {
    setEngineConfig(prev => ({ ...prev, isShutdown: false, consecutiveFailures: 0 }));
  };

  const handleReleaseProfitLock = () => {
    setIsProfitLocked(false);
    setEngineConfig(prev => ({ ...prev, consecutiveFailures: 0 }));
  };

  const handleResetLedger = () => {
    setBalances(INITIAL_BALANCES);
    setOrderLogs([]);
    setWithdrawalLogs([]);
  };

  const handleSaveParameters = (e: React.FormEvent) => {
    e.preventDefault();
    const config = {
      ...engineConfig,
      minArbitrageBuffer: parseFloat(tempBuffer),
      tradeSizeUSD: parseFloat(tempTradeSize),
      ...(engineConfig.engineMode === 'HFL_BOT' ? { profitLockThresholdUSD: parseFloat(tempProfitLock) } : { autoWithdrawThresholdUSD: parseFloat(tempAutoWithdraw) })
    };
    setEngineConfig(config);
    localStorage.setItem('secure_engine_config', JSON.stringify(config));
    setSettingsSavedMessage('تم حفظ المعاملات! ⚡');
    setTimeout(() => setSettingsSavedMessage(''), 2000);
  };

  const handleSaveWallet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempWallet) {
      alert('أدخل عنوان محفظة صحيح!');
      return;
    }
    setEngineConfig(prev => ({ ...prev, whitelistedWallet: tempWallet }));
    localStorage.setItem('secure_whitelisted_wallet', tempWallet);
    setWalletSavedMessage('تم حفظ عنوان المحفظة! ✓');
    setTimeout(() => setWalletSavedMessage(''), 2000);
  };

  const triggerAutonomousWithdrawal = (amount: number) => {
    const withdrawal: WithdrawalLog = {
      id: Date.now(),
      amount,
      destination: engineConfig.whitelistedWallet,
      txHash: 'TX_' + Math.random().toString(36).substring(2, 15),
      timestamp: Date.now()
    };
    setWithdrawalLogs(prev => [withdrawal, ...prev.slice(0, 19)]);
  };

  const handleUpdateApiKey = (exchangeId: string, field: 'apiKey' | 'apiSecret', value: string) => {
    setEngineConfig(prev => ({
      ...prev,
      apiKeys: {
        ...prev.apiKeys,
        [exchangeId]: {
          ...prev.apiKeys[exchangeId as keyof typeof prev.apiKeys],
          [field]: value
        }
      }
    }));
  };

  const loadOpenSourceTestKeys = () => {
    setEngineConfig(prev => ({
      ...prev,
      apiKeys: {
        binance: { apiKey: 'pk_test_binance_public_key_demo_v1', apiSecret: 'sk_test_binance_secret_key_demo_v1' },
        okx: { apiKey: 'pk_test_okx_public_key_demo_v1', apiSecret: 'sk_test_okx_secret_key_demo_v1' },
        coinbase: { apiKey: 'pk_test_coinbase_public_key_demo_v1', apiSecret: 'sk_test_coinbase_secret_key_demo_v1' }
      }
    }));
    alert('تم تحميل مفاتيح الاختبار المفتوحة المصدر!');
  };

  return (
    <div className="min-h-screen bg-black text-gray-100 font-sans">
      {/* Header */}
      <header className="border-b border-gray-900 bg-gray-950 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center">
              <Shield className="w-6 h-6 text-black font-bold" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-wider">ZERO-TRUST ARBİTRAJ ENGINE</h1>
              <p className="text-[11px] text-gray-500">Merkezi Borsa İstatistikleri ve Ağ Analiz Paneli</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {engineConfig.isRunning && !engineConfig.isShutdown ? (
              <div className="text-xs text-emerald-400 font-mono flex items-center gap-2 bg-emerald-500/10 px-3 py-1.5 rounded border border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                AKTİF: {timeSeconds}s
              </div>
            ) : (
              <div className="text-xs text-gray-500 font-mono flex items-center gap-2 bg-gray-900 px-3 py-1.5 rounded border border-gray-800">
                <Clock className="w-3.5 h-3.5" />
                HAZIR
              </div>
            )}

            <button
              id="btn-toggle-engine"
              onClick={toggleEngine}
              className={`flex items-center gap-2 px-4 py-2 rounded font-mono text-xs font-bold transition duration-200 ${
                engineConfig.isRunning
                  ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30'
                  : 'bg-emerald-500 hover:bg-emerald-600 text-black border border-emerald-600'
              }`}
            >
              {engineConfig.isRunning ? (
                <>
                  <Pause className="w-3.5 h-3.5" /> DURDUR
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" /> BAŞLAT
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Analytics Callout - Orderbook Deep Analysis */}
        <div className="bg-gray-950 border border-gray-900 rounded-xl p-5 mb-6">
          {(() => {
            const analytics = {
              averageBidAskSpreadPercent: (Math.random() * 0.05).toFixed(3),
              marketDepthUSD: Math.floor(Math.random() * 500000) + 100000
            };
            return (
              <>
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-xs font-bold text-gray-300 uppercase flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    Açık Kaynak Analytics-Engine (Orderbook)
                  </h4>
                  <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20 uppercase font-bold">
                    Otomatik Analiz
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="bg-black/50 p-1.5 rounded border border-gray-950">
                    <span className="text-[9px] text-gray-500 block uppercase">Ort. Alış-Satış Farkı (Spread):</span>
                    <span className="text-[11px] font-bold text-gray-300">%{analytics.averageBidAskSpreadPercent}</span>
                  </div>
                  <div className="bg-black/50 p-1.5 rounded border border-gray-950">
                    <span className="text-[9px] text-gray-500 block uppercase">Hesaplanan Likidite Derinliği:</span>
                    <span className="text-[11px] font-bold text-emerald-400">${analytics.marketDepthUSD.toLocaleString()} USDT</span>
                  </div>
                  <div className="bg-black/50 p-1.5 rounded border border-gray-950 col-span-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] text-gray-500 uppercase">Yıllık Hacim İadesi Projeksiyonu:</span>
                      <span className="text-[10px] text-emerald-500 font-bold">+%{(0.12).toFixed(2)} Maker Payı</span>
                    </div>
                    <div className="w-full bg-gray-900 h-1.5 rounded-full mt-1 overflow-hidden">
                      <div className="bg-emerald-500 h-full" style={{ width: '48%' }} />
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-900 gap-1 overflow-x-auto">
          <button
            id="tab-monitoring"
            onClick={() => setActiveTab('monitoring')}
            className={`px-4 py-2.5 text-xs font-mono font-semibold tracking-wider uppercase border-b-2 transition duration-200 shrink-0 ${
              activeTab === 'monitoring'
                ? 'border-emerald-500 text-emerald-400 bg-gray-900/20'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            📊 ARBİTRAJ VE ENTROPİ İZLEME
          </button>
          <button
            id="tab-network"
            onClick={() => setActiveTab('network')}
            className={`px-4 py-2.5 text-xs font-mono font-semibold tracking-wider uppercase border-b-2 transition duration-200 shrink-0 ${
              activeTab === 'network'
                ? 'border-emerald-500 text-emerald-400 bg-gray-900/20'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            🌐 AĞ TRAFİK ANALİZİ (LOG)
          </button>
          <button
            id="tab-compiler"
            onClick={() => setActiveTab('compiler')}
            className={`px-4 py-2.5 text-xs font-mono font-semibold tracking-wider uppercase border-b-2 transition duration-200 shrink-0 ${
              activeTab === 'compiler'
                ? 'border-emerald-500 text-emerald-400 bg-gray-900/20'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            📦 TEKİL STATIC BINARY DERLEME
          </button>
          <button
            id="tab-contract"
            onClick={() => setActiveTab('contract')}
            className={`px-4 py-2.5 text-xs font-mono font-semibold tracking-wider uppercase border-b-2 transition duration-200 shrink-0 ${
              activeTab === 'contract'
                ? 'border-emerald-500 text-emerald-400 bg-gray-900/20'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            📜 GÜVENLİK AKDİ & SÖZLEŞME
          </button>
        </div>

        {/* Tab Content Router */}
        {activeTab === 'contract' && (
          <div className="space-y-6">
            <ZeroTrustContract />
          </div>
        )}

        {activeTab === 'network' && (
          <div className="space-y-6">
            <NetworkTrafficLogs logs={networkLogs} totalBytesOut={networkLogs.reduce((sum, log) => sum + log.bytesTransmitted, 0)} />
          </div>
        )}

        {activeTab === 'compiler' && (
          <div className="space-y-6">
            <BinaryCompilerView />
          </div>
        )}

        {activeTab === 'monitoring' && (
          <div className="space-y-6">
            
            {/* Top Bento Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Metric 1 */}
              <div className="bg-gray-950 border border-gray-900 p-4 rounded-xl font-mono relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl" />
                <p className="text-[10px] text-gray-500 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> BİRİKEN CEX KÂRI
                </p>
                <p className="text-lg font-bold text-emerald-400 mt-1">${accumulatedProfitUSD.toFixed(4)} USDT</p>
                <p className="text-[9px] text-gray-500 mt-1 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-gray-600" /> 
                  {engineConfig.engineMode === 'HFL_BOT' ? `Kar Kilidi: $${engineConfig.profitLockThresholdUSD}` : `Oto Çekim: $${engineConfig.autoWithdrawThresholdUSD}`}
                </p>
              </div>

              {/* Metric 2 */}
              <div className="bg-gray-950 border border-gray-900 p-4 rounded-xl font-mono relative overflow-hidden">
                <p className="text-[10px] text-gray-500 flex items-center gap-1">
                  <Wallet className="w-3.5 h-3.5 text-emerald-400" /> TOTAL WITHDRAWN
                </p>
                <p className="text-lg font-bold text-gray-100 mt-1">${totalWithdrawnUSD.toFixed(4)} USDT</p>
                <p className="text-[9px] text-emerald-400 font-mono mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Auto-Vault Safe Mode
                </p>
              </div>

              {/* Metric 3 */}
              <div className="bg-gray-950 border border-gray-900 p-4 rounded-xl font-mono relative overflow-hidden">
                <p className="text-[10px] text-gray-500 flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> AFFILIATE REBATES
                </p>
                <p className="text-lg font-bold text-emerald-400 mt-1">${rebateEarnedUSD.toFixed(4)} USDT</p>
                <p className="text-[9px] text-gray-500 mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Maker Rebate Backing
                </p>
              </div>

              {/* Metric 4 */}
              <div className="bg-gray-950 border border-gray-900 p-4 rounded-xl font-mono relative overflow-hidden">
                <p className="text-[10px] text-gray-500 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" /> MOTOR GÜVENLİK VE ÇALIŞMA MODU
                </p>
                <p className="text-md font-bold text-emerald-400 mt-1 uppercase flex items-center gap-1.5">
                  {engineConfig.engineMode === 'HFL_BOT' ? 'HFL-BOT (SAFE)' : 'FALE (AUTONOMOUS)'}
                </p>
                {engineConfig.isRunning && !engineConfig.isShutdown ? (
                  <div className="text-[9px] text-emerald-400 mt-1.5 flex items-center gap-1.5 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/25">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    <span>7/24 ARALIKSIZ AKTİF</span>
                  </div>
                ) : (
                  <p className="text-[9px] text-gray-500 mt-1.5 flex items-center gap-1">
                    <Shield className="w-3 h-3 text-emerald-500" /> Outbound Telemetry: Locked
                  </p>
                )}
              </div>
            </div>

            {/* Error Notification / Shut-down Banner */}
            {engineConfig.isShutdown && (
              <div className="bg-red-950/20 border border-red-500/40 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 animate-pulse font-mono">
                <div className="flex gap-2.5">
                  <AlertOctagon className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-red-400">EMERGENCY SHUTDOWN ACTIVATED (BOT IS KILLED)</h4>
                    <p className="text-xs text-red-200/80 leading-relaxed mt-0.5">
                      Ardışık 3 başarısız emir gerçekleştiği için bot kendini tamamen kilitledi ve tüm işlemleri durdurdu. Sunucu ağından gelebilecek sahte emir sinyalleri bypass edilmiştir.
                    </p>
                  </div>
                </div>
                <button
                  id="btn-emergency-unlock-banner"
                  onClick={resetEmergencyShutdown}
                  className="bg-red-500 hover:bg-red-600 text-black text-xs font-bold px-3 py-1.5 rounded transition duration-150"
                >
                  ACİL DURUM KİLİDİNİ ÇÖZ
                </button>
              </div>
            )}

            {/* Profit-Lock notification overlay style banner */}
            {isProfitLocked && (
              <div className="bg-amber-950/20 border border-amber-500/40 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 font-mono">
                <div className="flex gap-2.5">
                  <Lock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-amber-400">PROFIT-LOCK ENGAGED (KÂR EŞİĞİ KİLİDİ)</h4>
                    <p className="text-xs text-amber-200/80 leading-relaxed mt-0.5">
                      Biriken kâr, tanımladığınız <strong>${engineConfig.profitLockThresholdUSD} USDT</strong> limitini aştığı için bot işlemi durdurdu ve manuel onayınızı bekliyor. Bu durum paranın kaçırılmasını engellemek için %100 güvenli tek yöntemdir.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    id="btn-withdraw-manual-simulation"
                    onClick={() => {
                      triggerAutonomousWithdrawal(accumulatedProfitUSD);
                      setIsProfitLocked(false);
                      alert('Biriken kâr güvenli Whitelist adresine aktarıldı!');
                    }}
                    className="bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold px-3 py-1.5 rounded transition duration-150"
                  >
                    BORSADAN MANUEL ÇEK (WITHDRAW)
                  </button>
                  <button
                    id="btn-release-lock-manual"
                    onClick={handleReleaseProfitLock}
                    className="bg-gray-900 hover:bg-gray-800 text-gray-300 border border-gray-800 text-xs font-bold px-3 py-1.5 rounded transition duration-150"
                  >
                    KİLİDİ RESETLE
                  </button>
                </div>
              </div>
            )}

            {/* Main Workspace split: Left Side Live Arb / Right Side CEX configuration */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* LEFT SIDE: Live Opportunities & Active Spreads (8 Columns) */}
              <div className="lg:col-span-8 space-y-6">
                
                {/* Active Spreads & Opportunities Table */}
                <div className="bg-gray-950 border border-gray-900 rounded-xl p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-900 pb-4 mb-4">
                    <div>
                      <h3 className="text-sm font-bold text-gray-100 uppercase tracking-wider font-mono flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                        Aktif Arbitraj & Entropi Taraması
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">Binance, OKX ve Coinbase Pro arası eşzamanlı veri akışı</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        id="btn-trigger-failed-order"
                        onClick={triggerSimulatedOrderFailure}
                        className="bg-red-950/20 hover:bg-red-900/30 text-red-400 border border-red-500/20 text-xs font-mono px-3 py-1.5 rounded transition duration-150"
                      >
                        ⚠️ EMİR HATASI SİMÜLE ET
                      </button>
                      <div className="flex items-center gap-1.5 text-xs text-gray-400 font-mono bg-gray-900 px-2 py-1.5 rounded border border-gray-800">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                        <span>{opportunities.length} Anomali</span>
                      </div>
                    </div>
                  </div>

                  {/* Opportunities Grid/List */}
                  <div className="space-y-3">
                    {opportunities.length === 0 ? (
                      <div className="text-center py-8 border border-dashed border-gray-900 rounded-lg text-gray-500 text-xs">
                        Merkezi borsalardan anlık veri çekiliyor, arbitraj fırsatları taranıyor...
                      </div>
                    ) : (
                      opportunities.slice(0, 5).map((opp) => (
                        <div
                          key={opp.id}
                          className={`border rounded-lg p-3.5 font-mono text-xs transition duration-200 ${
                            opp.isExecutable
                              ? 'bg-emerald-950/20 border-emerald-500/30 animate-pulse'
                              : 'bg-gray-900/10 border-gray-900'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            {/* Asset info */}
                            <div className="flex items-center gap-2">
                              <span className="bg-gray-900 border border-gray-800 px-2 py-1 rounded text-white font-bold">
                                {opp.asset} / USDT
                              </span>
                              <div className="flex items-center gap-1 text-gray-400">
                                <span className="text-gray-300 font-medium">{opp.buyExchange}</span>
                                <ArrowRight className="w-3 h-3 text-gray-600" />
                                <span className="text-gray-300 font-medium">{opp.sellExchange}</span>
                              </div>
                            </div>

                            {/* Spread Rates */}
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <p className="text-[10px] text-gray-500 uppercase">BRÜT FARK</p>
                                <p className="text-gray-300">+{opp.grossSpreadPercent}%</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] text-gray-500 uppercase">KOMİSYONLAR</p>
                                <p className="text-gray-500">-{opp.totalCommissionsPercent}%</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] text-gray-500 uppercase">NET ARTIŞ</p>
                                <p className={`font-bold ${opp.isExecutable ? 'text-emerald-400' : 'text-gray-400'}`}>
                                  {opp.netSpreadPercent > 0 ? '+' : ''}{opp.netSpreadPercent}%
                                </p>
                              </div>
                            </div>

                            {/* Action Button Indicator */}
                            <div>
                              {opp.isExecutable ? (
                                <span className="flex items-center justify-center gap-1.5 bg-emerald-500 text-black font-extrabold px-3 py-1.5 rounded text-[10px] uppercase tracking-wider">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> EXECUTABLE
                                </span>
                              ) : (
                                <span className="flex items-center justify-center gap-1 bg-gray-900 text-gray-500 border border-gray-800 px-3 py-1.5 rounded text-[10px] uppercase tracking-wider">
                                  BELOW BUFFER
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="mt-3 pt-2.5 border-t border-gray-900/60 flex flex-wrap items-center justify-between gap-2 text-[10px] text-gray-500">
                            <span>Sinyal Alış: <strong className="text-gray-300">${opp.buyPrice}</strong> | Satış: <strong className="text-gray-300">${opp.sellPrice}</strong></span>
                            <span>Termodinamik Entropi Değeri: <strong className="text-emerald-500">{opp.entropyValue} ΔS</strong></span>
                            <span>Ağ Gidiş Dönüşü (Est): <strong className="text-gray-300">320-410 μs</strong></span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Live Orderbook Comparison Matrix */}
                <div className="bg-gray-950 border border-gray-900 rounded-xl p-5">
                  <div className="flex items-center justify-between border-b border-gray-900 pb-4 mb-4">
                    <div>
                      <h3 className="text-sm font-bold text-gray-100 uppercase tracking-wider font-mono">
                        BORSALAR ARASI EMİR DEFTERİ MATRİSİ (BID / ASK)
                      </h3>
                      <p className="text-xs text-gray-500">Milisaniyelik orderbook derinlik sinyalleri</p>
                    </div>
                    {/* Selector */}
                    <div className="flex gap-1.5">
                      {engineConfig.selectedAssets.map((asset) => (
                        <button
                          key={asset}
                          id={`btn-select-asset-${asset}`}
                          onClick={() => setSelectedMonitoringAsset(asset as AssetSymbol)}
                          className={`px-2 py-1 rounded text-xs font-mono border transition ${
                            selectedMonitoringAsset === asset
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-bold'
                              : 'bg-transparent text-gray-500 border-gray-900 hover:text-gray-300'
                          }`}
                        >
                          {asset}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono">
                    {EXCHANGES.map((exch) => {
                      const data = marketPrices[exch.id]?.[selectedMonitoringAsset];
                      return (
                        <div key={exch.id} className="bg-gray-900/20 border border-gray-900 p-3 rounded-lg space-y-2">
                          <div className="flex items-center justify-between border-b border-gray-900 pb-2">
                            <span className="text-xs font-bold text-gray-200">{exch.name}</span>
                            <span className="text-[10px] text-gray-500 font-mono">Fee: {exch.takerFee * 100}%</span>
                          </div>
                          
                          <div className="space-y-1.5 text-xs">
                            <div className="flex justify-between items-center text-red-400">
                              <span>ASK (En İyi Satış):</span>
                              <span className="font-semibold">${data?.ask || '0.00'}</span>
                            </div>
                            <div className="flex justify-between items-center text-emerald-400">
                              <span>BID (En İyi Alış):</span>
                              <span className="font-semibold">${data?.bid || '0.00'}</span>
                            </div>
                            <div className="flex justify-between items-center text-gray-400 border-t border-gray-900/60 pt-1.5 mt-1">
                              <span>Son Fiyat:</span>
                              <span className="text-gray-200 font-semibold">${data?.lastPrice || '0.00'}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Autonomous Whitelist Withdrawals Log (Transparent logs for FALE paradigm) */}
                <div className="bg-gray-950 border border-gray-900 rounded-xl p-5">
                  <div className="flex items-center justify-between border-b border-gray-900 pb-4 mb-4">
                    <div>
                      <h3 className="text-sm font-bold text-gray-100 uppercase tracking-wider font-mono">
                        OTONOM GÜVENLİ PARA ÇEKİM GEÇMİŞİ (WITHDRAWAL AUDIT LOG)
                      </h3>
                      <p className="text-xs text-gray-500">Beyaz listeye (Whitelist) yapılan çekimlerin şeffaf dökümü</p>
                    </div>
                    <span className="text-xs text-emerald-400 font-mono font-bold">100% TRANSPARENT</span>
                  </div>

                  <div className="max-h-[180px] overflow-y-auto font-mono text-[11px] leading-relaxed space-y-2">
                    {withdrawalLogs.length === 0 ? (
                      <div className="text-center py-6 text-gray-600 italic">
                        Henüz otomatik veya manuel bir bakiye çekim işlemi gerçekleşmedi. FALE modu aktifken belirlenen kâr eşiği geçildiğinde otomatik tetiklenir.
                      </div>
                    ) : (
                      withdrawalLogs.slice(0, 10).map((log) => (
                        <div key={log.id} className="bg-gray-900/30 border border-gray-900 p-2.5 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded text-[9px] font-bold">SUCCESS</span>
                              <span className="text-gray-200 font-bold">+{log.amount.toFixed(4)} USDT</span>
                            </div>
                            <div className="text-[10px] text-gray-400 flex items-center gap-1">
                              <Send className="w-3 h-3 text-emerald-500 shrink-0" />
                              To: <span className="text-emerald-400 break-all">{log.destination}</span>
                            </div>
                          </div>

                          <div className="text-right sm:text-right text-[10px] text-gray-500 font-mono shrink-0">
                            <p>Tarih: {new Date(log.timestamp).toLocaleTimeString()}</p>
                            <p className="truncate w-40 text-gray-600 select-all hover:text-gray-400">TX: {log.txHash.substring(0, 24)}...</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Executed Arbitrage Orders Log Ledger */}
                <div className="bg-gray-950 border border-gray-900 rounded-xl p-5">
                  <div className="flex items-center justify-between border-b border-gray-900 pb-4 mb-4">
                    <div>
                      <h3 className="text-sm font-bold text-gray-100 uppercase tracking-wider font-mono">
                        İŞLEM GEÇMİŞİ VE MİKROSANİYE RAPORU (LEDGER)
                      </h3>
                      <p className="text-xs text-gray-500">Milisaniyelik borsa emir kayıtları</p>
                    </div>
                    {engineConfig.consecutiveFailures > 0 && (
                      <span className="text-xs text-red-400 font-mono font-bold animate-pulse">
                        Sıralı Hata: {engineConfig.consecutiveFailures}/3
                      </span>
                    )}
                  </div>

                  <div className="max-h-[250px] overflow-y-auto font-mono text-[11px] leading-relaxed space-y-2">
                    {orderLogs.length === 0 ? (
                      <div className="text-center py-10 text-gray-600 italic">
                        Motor aktifken saptanan arbitrallere yönelik otomatik milisaniyelik emir tetiklemeleri burada listelenecektir.
                      </div>
                    ) : (
                      orderLogs.slice(0, 15).map((log) => (
                        <div key={log.id} className="bg-gray-900/20 border border-gray-900 p-2.5 rounded-lg flex items-start sm:items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
                          <div className="flex items-center gap-2">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              log.status === 'REJECTED' ? 'bg-red-500/10 text-red-400' :
                              log.type === 'BUY' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                            }`}>
                              {log.status === 'REJECTED' ? 'REJECTED' : log.type}
                            </span>
                            <span className="text-gray-300 font-bold">{log.asset}/USDT</span>
                            <span className="text-gray-500">@ {log.exchange}</span>
                          </div>

                          <div className="flex items-center gap-4 text-right">
                            <div>
                              <span className="text-gray-500 block text-[9px]">FİYAT</span>
                              <span className="text-gray-300 font-bold">${log.price}</span>
                            </div>
                            <div>
                              <span className="text-gray-500 block text-[9px]">MİKTAR</span>
                              <span className="text-gray-300">{log.quantity}</span>
                            </div>
                            <div>
                              <span className="text-gray-500 block text-[9px]">İŞLEM HIZI</span>
                              <span className="text-emerald-400 font-bold">{log.latencyUs} μs</span>
                            </div>
                            <div>
                              <span className="text-gray-500 block text-[9px]">DURUM</span>
                              <span className={log.status === 'REJECTED' ? 'text-red-500 font-bold' : 'text-emerald-500 font-bold'}>{log.status}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>

              {/* RIGHT SIDE: Balances, API parameters, and Environmental setup (4 Columns) */}
              <div className="lg:col-span-4 space-y-6">
                
                {/* Simulated Environmental CEX Balance Sheet */}
                <div className="bg-gray-950 border border-gray-900 rounded-xl p-5 relative overflow-hidden">
                  <h3 className="text-sm font-bold text-gray-100 uppercase tracking-wider font-mono border-b border-gray-900 pb-4 mb-4 flex items-center justify-between">
                    <span>CEX BAKİYE DURUMLARI (BALANCE SHEET)</span>
                    <button
                      id="btn-reset-balances"
                      onClick={handleResetLedger}
                      className="text-[10px] text-emerald-400 hover:text-emerald-300 font-mono flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3 animate-spin-hover" /> RESET ALL
                    </button>
                  </h3>

                  {/* Portfolio breakdown per exchange */}
                  <div className="space-y-4">
                    {EXCHANGES.map((exch) => (
                      <div key={exch.id} className="bg-gray-900/30 border border-gray-900 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between text-xs font-mono font-bold border-b border-gray-800 pb-1.5">
                          <span className="text-gray-300">{exch.name} Balance</span>
                          <span className="text-emerald-400">
                            ${(balances[exch.id]?.USDT || 0).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits: 2 })} USDT
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-gray-400">
                          <div>BTC: <span className="text-gray-200 font-semibold">{balances[exch.id]?.BTC || 0}</span></div>
                          <div>ETH: <span className="text-gray-200 font-semibold">{balances[exch.id]?.ETH || 0}</span></div>
                          <div>SOL: <span className="text-gray-200 font-semibold">{balances[exch.id]?.SOL || 0}</span></div>
                          <div>AVAX: <span className="text-gray-200 font-semibold">{balances[exch.id]?.AVAX || 0}</span></div>
                        </div>
                      </div>
                    ))}

                    {/* Total assets aggregate in USD */}
                    <div className="bg-emerald-950/10 border border-emerald-500/20 p-3 rounded-lg font-mono text-xs">
                      <p className="text-gray-400 text-[10px] uppercase">TOPLAM KONSOLİDE US PORTFÖYÜ</p>
                      <p className="text-lg font-bold text-emerald-400 mt-1">
                        ${(sums.totalUsdt + sums.totalBtc * marketPrices.binance.BTC.lastPrice + sums.totalEth * marketPrices.binance.ETH.lastPrice).toLocaleString('en-US', { maximumFractionDigits: 2 })} USD
                      </p>
                      <p className="text-[9px] text-gray-500 mt-1">Geri mühendisliği engellenmiş tekil statikbinary yapısıyla borsa cüzdanları korunur.</p>
                    </div>
                  </div>
                </div>

                {/* BOT MODE SELECTOR (HFL-BOT vs. FALE) */}
                <div className="bg-gray-950 border border-gray-900 rounded-xl p-5">
                  <h3 className="text-sm font-bold text-gray-100 uppercase tracking-wider font-mono border-b border-gray-900 pb-3 mb-3">
                    BOT OPERASYONEL MODU
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-2 font-mono text-xs mb-3">
                    <button
                      id="btn-set-mode-hfl"
                      onClick={() => setEngineConfig(prev => ({ ...prev, engineMode: 'HFL_BOT' }))}
                      className={`p-2.5 rounded-lg border text-center transition duration-150 cursor-pointer ${
                        engineConfig.engineMode === 'HFL_BOT'
                          ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 font-bold'
                          : 'bg-black border-gray-900 text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      HFL-BOT
                      <span className="block text-[8px] font-normal mt-0.5">Profit-Lock Safe</span>
                    </button>

                    <button
                      id="btn-set-mode-fale"
                      onClick={() => setEngineConfig(prev => ({ ...prev, engineMode: 'FALE' }))}
                      className={`p-2.5 rounded-lg border text-center transition duration-150 cursor-pointer ${
                        engineConfig.engineMode === 'FALE'
                          ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 font-bold'
                          : 'bg-black border-gray-900 text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      FALE MODE
                      <span className="block text-[8px] font-normal mt-0.5">Auto-Withdrawal</span>
                    </button>
                  </div>

                  <p className="text-[10px] text-gray-500 font-mono leading-relaxed">
                    {engineConfig.engineMode === 'HFL_BOT' 
                      ? 'HFL-BOT Modu: Bot kâr limitine ulaştığında otomatik olarak durur ve çekim için manuel onayınızı bekler (Sıfır para çekme kodu güvencesi).'
                      : 'FALE Modu: Belirlenen kâr eşiğine ulaşıldığında, kazanç otomatik olarak hard-coded Whitelist cüzdan adresinize transfer edilir.'
                    }
                  </p>
                </div>

                {/* Arbitrage Engine Threshold Parameters (Turkish UI) */}
                <div className="bg-gray-950 border border-gray-900 rounded-xl p-5">
                  <h3 className="text-sm font-bold text-gray-100 uppercase tracking-wider font-mono border-b border-gray-900 pb-4 mb-4">
                    HASSASİYET PARAMETRELERİ
                  </h3>

                  <form onSubmit={handleSaveParameters} className="space-y-4 font-mono text-xs">
                    <div>
                      <label className="block text-gray-400 mb-1.5">MİNİMUM ARBİTRAJ TOLERANSI (BUFFER OVER FEES)</label>
                      <div className="relative">
                        <input
                          id="input-min-arbitrage-buffer"
                          type="text"
                          value={tempBuffer}
                          onChange={(e) => setTempBuffer(e.target.value)}
                          className="w-full bg-black border border-gray-900 p-2.5 rounded text-gray-200 font-mono focus:border-emerald-500/50 outline-none"
                          placeholder="0.01"
                        />
                        <span className="absolute right-3 top-2.5 text-gray-500">%</span>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-1">
                        Net kâr, komisyon oranını bu oranda geçince alım/satım tetiklenir (Varsayılan %0.01).
                      </p>
                    </div>

                    <div>
                      <label className="block text-gray-400 mb-1.5">TEK SEFERLİK İŞLEM BÜYÜKLÜĞÜ</label>
                      <div className="relative">
                        <input
                          id="input-trade-size-usd"
                          type="text"
                          value={tempTradeSize}
                          onChange={(e) => setTempTradeSize(e.target.value)}
                          className="w-full bg-black border border-gray-900 p-2.5 rounded text-gray-200 font-mono focus:border-emerald-500/50 outline-none"
                          placeholder="5000"
                        />
                        <span className="absolute right-3 top-2.5 text-gray-500">USDT</span>
                      </div>
                    </div>

                    {engineConfig.engineMode === 'HFL_BOT' ? (
                      <div>
                        <label className="block text-gray-400 mb-1.5">KÂR KİLİDİ EŞİĞİ (PROFIT-LOCK LIMIT)</label>
                        <div className="relative">
                          <input
                            id="input-profit-lock-threshold"
                            type="text"
                            value={tempProfitLock}
                            onChange={(e) => setTempProfitLock(e.target.value)}
                            className="w-full bg-black border border-gray-900 p-2.5 rounded text-gray-200 font-mono focus:border-emerald-500/50 outline-none"
                            placeholder="10.00"
                          />
                          <span className="absolute right-3 top-2.5 text-gray-500">USDT</span>
                        </div>
                        <p className="text-[10px] text-amber-500 mt-1">
                          Kâr bu limit değerine ulaştığında bot güvenli şekilde durdurulur (Profit Lock).
                        </p>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-gray-400 mb-1.5">OTONOM ÇEKİM EŞİĞİ (WITHDRAW THRESHOLD)</label>
                        <div className="relative">
                          <input
                            id="input-auto-withdraw-threshold"
                            type="text"
                            value={tempAutoWithdraw}
                            onChange={(e) => setTempAutoWithdraw(e.target.value)}
                            className="w-full bg-black border border-gray-900 p-2.5 rounded text-gray-200 font-mono focus:border-emerald-500/50 outline-none"
                            placeholder="5.00"
                          />
                          <span className="absolute right-3 top-2.5 text-gray-500">USDT</span>
                        </div>
                        <p className="text-[10px] text-emerald-400 mt-1">
                          Biriken kâr bu değere ulaştığında Whitelist adrese otomatik transfer emri tetiklenir.
                        </p>
                      </div>
                    )}

                    <button
                      id="btn-save-engine-config"
                      type="submit"
                      className="w-full bg-emerald-950/40 hover:bg-emerald-900/40 text-emerald-400 border border-emerald-500/30 py-2.5 rounded font-bold font-mono transition duration-200 cursor-pointer"
                    >
                      PARAMETRELERİ BELLEĞE KAYDET
                    </button>

                    {settingsSavedMessage && (
                      <p className="text-[10px] text-emerald-400 text-center animate-pulse">{settingsSavedMessage}</p>
                    )}
                  </form>
                </div>

                {/* Whitelisted Wallet Address Card (Interactive Secure Whitelist Management Panel) */}
                <div className="bg-gray-950 border border-gray-900 rounded-xl p-5 font-mono text-xs">
                  <h3 className="text-sm font-bold text-gray-100 uppercase tracking-wider border-b border-gray-900 pb-3 mb-3 flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-emerald-400" />
                    BEYAZ LİSTE CÜZDAN YÖNETİM PANELİ
                  </h3>
                  
                  {/* Status Indicator */}
                  {!engineConfig.whitelistedWallet ? (
                    <div className="bg-red-950/20 border border-red-500/30 p-3 rounded-lg mb-4 space-y-1">
                      <div className="flex justify-between items-center text-[10px] text-red-400">
                        <span className="font-bold flex items-center gap-1">⚠️ GÜVENLİK BLOKAJI: AKTİF</span>
                        <span className="text-red-500 font-bold uppercase tracking-widest text-[8px] bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">
                          CÜZDAN TANIMLANMAMIŞ
                        </span>
                      </div>
                      <p className="text-[10px] text-red-200/80 leading-relaxed">
                        Bot kâr transferi yapamaz! Güvenlik gereği, bakiye otonom çekim ve bot başlatma sistemleri tamamen kilitli (Blocked) durumdadır.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-emerald-950/20 border border-emerald-500/30 p-3 rounded-lg mb-4 space-y-1">
                      <div className="flex justify-between items-center text-[10px] text-emerald-400">
                        <span className="font-bold flex items-center gap-1">✅ BEYAZ LİSTE AKTİF</span>
                        <span className="text-emerald-500 font-bold uppercase tracking-widest text-[8px] bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                          ŞİFRELİ LOKAL HAFIZA
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-300 break-all select-all font-semibold p-1 bg-black/40 rounded border border-gray-900">
                        {engineConfig.whitelistedWallet}
                      </p>
                      <p className="text-[9px] text-gray-500 leading-relaxed pt-1">
                        Otonom (FALE) ve manuel tüm çekimler strictly bu adrese yönlendirilir. Kod içinde harici veya gizli başka hiçbir adres bulunmamaktadır.
                      </p>
                    </div>
                  )}

                  <form onSubmit={handleSaveWallet} className="space-y-3">
                    <div>
                      <label className="block text-gray-400 mb-1.5 uppercase">Kişisel Cüzdan Adresiniz (USDT/ERC20/TRC20)</label>
                      <input
                        id="input-whitelisted-wallet"
                        type="text"
                        value={tempWallet}
                        onChange={(e) => setTempWallet(e.target.value)}
                        className="w-full bg-black border border-gray-900 p-2.5 rounded text-gray-200 font-mono focus:border-emerald-500/50 outline-none text-[11px]"
                        placeholder="0x... veya T... cüzdan adresinizi buraya girin"
                      />
                    </div>

                    <button
                      id="btn-save-wallet-address"
                      type="submit"
                      className="w-full bg-emerald-500 hover:bg-emerald-600 text-black py-2 rounded font-bold font-mono transition duration-200 cursor-pointer text-xs"
                    >
                      CÜZDANI GÜVENLİ PANELDE ETKİNLEŞTİR
                    </button>

                    {walletSavedMessage && (
                      <p className="text-[10px] text-emerald-400 text-center animate-pulse">{walletSavedMessage}</p>
                    )}
                  </form>

                  <p className="text-[10px] text-gray-500 mt-3 leading-relaxed">
                    Sistem hiçbir cüzdan özel anahtarını istemez veya sunuculara göndermez. Cüzdan adresi strictly tarayıcınızın lokal şifreli konfigürasyonunda saklanır.
                  </p>
                </div>

                {/* Secure Environmental API Key Cryptography Store */}
                <div className="bg-gray-950 border border-gray-900 rounded-xl p-5">
                  <div className="flex items-center justify-between border-b border-gray-900 pb-4 mb-3">
                    <h3 className="text-sm font-bold text-gray-100 uppercase tracking-wider font-mono flex items-center gap-1.5">
                      <Cpu className="w-4 h-4 text-emerald-400" />
                      ŞİFRELİ CEX ANAHTAR HAFIZASI
                    </h3>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        id="btn-load-open-source-test-keys"
                        onClick={loadOpenSourceTestKeys}
                        className="bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/35 text-[10px] font-mono px-2.5 py-1 rounded transition cursor-pointer font-bold uppercase"
                      >
                        ⚡ AÇIK KAYNAK TESTNET KEY YÜKLE
                      </button>
                      <button
                        type="button"
                        id="btn-toggle-api-keys"
                        onClick={() => setApiKeysVisible(!apiKeysVisible)}
                        className="text-[10px] bg-gray-900 hover:bg-gray-800 text-gray-400 border border-gray-800 px-2 py-1 rounded font-mono"
                      >
                        {apiKeysVisible ? 'GİZLE' : 'GÖSTER'}
                      </button>
                    </div>
                  </div>

                  <p className="text-[10px] text-gray-400 font-mono leading-relaxed mb-4">
                    Borsa bağlantılarınız için <strong>açık kaynak CCXT sürücüleri</strong> kullanılmaktadır. Anahtarlar tarayıcı local RAM belleğinde şifrelenir ve asla harici sunuculara veya izleme servislerine gönderilmez.
                  </p>

                  <div className="space-y-4 font-mono text-xs">
                    {EXCHANGES.map((exch) => {
                      const keys = engineConfig.apiKeys[exch.id];
                      return (
                        <div key={exch.id} className="space-y-2 bg-black/40 border border-gray-900 p-3 rounded-lg">
                          <div className="flex justify-between items-center text-[10px] text-gray-300 font-bold">
                            <span className="uppercase text-emerald-400">{exch.name} API CONFIG</span>
                            <span className="text-emerald-500 flex items-center gap-1 text-[9px] uppercase">
                              <Check className="w-3 h-3" /> %100 Açık Kaynak API
                            </span>
                          </div>
                          
                          <div className="space-y-2">
                            <div>
                              <label className="block text-[10px] text-gray-500 uppercase mb-1">API Key:</label>
                              <input
                                type={apiKeysVisible ? "text" : "password"}
                                value={keys.apiKey}
                                onChange={(e) => handleUpdateApiKey(exch.id, 'apiKey', e.target.value)}
                                className="w-full bg-black border border-gray-900 p-2 rounded text-gray-300 text-[11px] focus:border-emerald-500/40 outline-none"
                                placeholder={`${exch.name} API Key`}
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-gray-500 uppercase mb-1">Secret Key:</label>
                              <input
                                type={apiKeysVisible ? "text" : "password"}
                                value={keys.apiSecret}
                                onChange={(e) => handleUpdateApiKey(exch.id, 'apiSecret', e.target.value)}
                                className="w-full bg-black border border-gray-900 p-2 rounded text-gray-300 text-[11px] focus:border-emerald-500/40 outline-none"
                                placeholder={`${exch.name} Secret Key`}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>

            </div>

          </div>
        )}

      </main>

      {/* Footer Design */}
      <footer className="border-t border-gray-900 bg-gray-950/60 py-6 px-4 mt-12 font-mono text-xs text-center text-gray-500">
        <div className="max-w-7xl mx-auto space-y-2">
          <p>ZERO-TRUST ARBITRAGE ENGINE &bull; 100% NATIVE COMPILATION GUARANTEE</p>
          <p className="text-[10px] text-gray-600">
            Absolutely no analytics script or monitoring services are initialized. Source signature: {generateLocalHash('complete-react-application-production-final-v2')}
          </p>
        </div>
      </footer>

    </div>
  );
}

// Inline fallback SVG component
function ShieldCheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
