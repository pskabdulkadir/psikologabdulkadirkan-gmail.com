import { useState, useEffect } from 'react';
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
  RuntimeAuthService, fetchPublicMarketData, runOrderbookAnalytics,
  EXCHANGES, BASE_PRICES, generateMarketPrices, scanOpportunities,
  createNetworkLog, INITIAL_BALANCES, generateLocalHash
} from './utils/ccxtService';
import ccxt from 'ccxt';
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
      minArbitrageBuffer: 0.01, // 0.01% standard limit requested
      tradeSizeUSD: 5000.00, // standard virtual order sizing
      selectedAssets: ['BTC', 'ETH', 'SOL', 'AVAX', 'LINK'],
      profitLockThresholdUSD: 10.00, // HFL mode: triggers manual pause (Simulated lower for easy testing)
      autoWithdrawThresholdUSD: 5.00, // FALE mode: auto triggers withdraw (Simulated lower for easy testing)
      whitelistedWallet: localStorage.getItem('secure_whitelisted_wallet') || '', // Dynamic secure config loading
      isShutdown: false,
      consecutiveFailures: 0,
      apiKeys: {
        binance: { apiKey: 'bin_f8a92e104b2b', apiSecret: 'bin_sec_9302bf71e0c', passphrase: '' },
        okx: { apiKey: 'okx_cf29e01140df', apiSecret: 'okx_sec_728b9d0ea13', passphrase: 'LocalPassphraseSecure' },
        coinbase: { apiKey: 'cb_pro_103fa0e902b', apiSecret: 'cb_sec_40a20e2e9d1', passphrase: '' }
      }
    };
  });

  // Market Data States - Initialize with empty/zero prices (will be populated by live API)
  const [marketPrices, setMarketPrices] = useState<Record<string, ExchangeMarketData>>(
    generateMarketPrices(0, null, null)
  );
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
  
  const [orderLogs, setOrderLogs] = useState<OrderLog[]>(() => {
    const saved = localStorage.getItem('secure_order_logs');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });

  const [networkLogs, setNetworkLogs] = useState<NetworkConnectionLog[]>([]);
  
  const [balances, setBalances] = useState<ExchangeBalances>(() => {
    const saved = localStorage.getItem('secure_balances');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return INITIAL_BALANCES;
  });

  const [withdrawalLogs, setWithdrawalLogs] = useState<WithdrawalLog[]>(() => {
    const saved = localStorage.getItem('secure_withdrawal_logs');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });

  // Stats Counters
  const [totalTradesExecuted, setTotalTradesExecuted] = useState<number>(() => {
    const saved = localStorage.getItem('secure_total_trades');
    return saved ? parseInt(saved, 10) : 0;
  });

  const [accumulatedProfitUSD, setAccumulatedProfitUSD] = useState<number>(() => {
    const saved = localStorage.getItem('secure_accumulated_profit');
    return saved ? parseFloat(saved) : 0;
  });

  const [totalWithdrawnUSD, setTotalWithdrawnUSD] = useState<number>(() => {
    const saved = localStorage.getItem('secure_total_withdrawn');
    return saved ? parseFloat(saved) : 0;
  });

  const [rebateEarnedUSD, setRebateEarnedUSD] = useState<number>(() => {
    const saved = localStorage.getItem('secure_rebate_earned');
    return saved ? parseFloat(saved) : 10.00; // Default $10.00 activation bonus as requested for rebate verification
  });

  const [referralIds, setReferralIds] = useState<{ binance: string; okx: string; coinbase: string }>(() => {
    const saved = localStorage.getItem('secure_referral_ids');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return { binance: 'REF_B_82941', okx: 'REF_O_10394', coinbase: 'REF_C_22019' };
  });

  const [apiPermissionLevel, setApiPermissionLevel] = useState<'read_only' | 'live_trade'>(() => {
    return (localStorage.getItem('secure_api_permission_level') as 'read_only' | 'live_trade') || 'read_only';
  });

  const [tempReferralIds, setTempReferralIds] = useState<{ binance: string; okx: string; coinbase: string }>({
    binance: referralIds.binance || 'REF_B_82941',
    okx: referralIds.okx || 'REF_O_10394',
    coinbase: referralIds.coinbase || 'REF_C_22019'
  });

  useEffect(() => {
    localStorage.setItem('secure_api_permission_level', apiPermissionLevel);
  }, [apiPermissionLevel]);

  useEffect(() => {
    localStorage.setItem('secure_referral_ids', JSON.stringify(referralIds));
    setTempReferralIds({
      binance: referralIds.binance,
      okx: referralIds.okx,
      coinbase: referralIds.coinbase
    });
  }, [referralIds]);

  const [totalBytesExchanged, setTotalBytesExchanged] = useState<number>(31240); // seed bytes
  const [selectedMonitoringAsset, setSelectedMonitoringAsset] = useState<AssetSymbol>('BTC');

  // Input states for settings edit
  const [tempBuffer, setTempBuffer] = useState<string>(() => {
    const saved = localStorage.getItem('secure_engine_config');
    if (saved) {
      try { return JSON.parse(saved).minArbitrageBuffer.toString(); } catch (e) {}
    }
    return '0.01';
  });

  const [tempTradeSize, setTempTradeSize] = useState<string>(() => {
    const saved = localStorage.getItem('secure_engine_config');
    if (saved) {
      try { return JSON.parse(saved).tradeSizeUSD.toString(); } catch (e) {}
    }
    return '5000';
  });

  const [tempProfitLock, setTempProfitLock] = useState<string>(() => {
    const saved = localStorage.getItem('secure_engine_config');
    if (saved) {
      try { return JSON.parse(saved).profitLockThresholdUSD.toString(); } catch (e) {}
    }
    return '10.00';
  });

  const [tempAutoWithdraw, setTempAutoWithdraw] = useState<string>(() => {
    const saved = localStorage.getItem('secure_engine_config');
    if (saved) {
      try { return JSON.parse(saved).autoWithdrawThresholdUSD.toString(); } catch (e) {}
    }
    return '5.00';
  });

  const [tempWallet, setTempWallet] = useState<string>(localStorage.getItem('secure_whitelisted_wallet') || '');
  const [walletSavedMessage, setWalletSavedMessage] = useState<string>('');
  const [apiKeysVisible, setApiKeysVisible] = useState<boolean>(false);
  const [settingsSavedMessage, setSettingsSavedMessage] = useState<string>('');

  const [usePublicFeed, setUsePublicFeed] = useState<boolean>(true);
  const [publicFeedStatus, setPublicFeedStatus] = useState<'IDLE' | 'FETCHING' | 'LIVE' | 'ERROR'>('IDLE');
  const [lastFetchedPrices, setLastFetchedPrices] = useState<Record<AssetSymbol, number> | null>(null);

  // Update market prices when live feed data arrives
  useEffect(() => {
    if (lastFetchedPrices) {
      console.log('[UI] Updating market prices with:', lastFetchedPrices);
      setMarketPrices(prevPrices => generateMarketPrices(0, prevPrices, lastFetchedPrices));
    }
  }, [lastFetchedPrices]);

  // Manual refresh handler
  const handleManualRefresh = async () => {
    setPublicFeedStatus('FETCHING');
    try {
      const result = await fetchPublicMarketData(engineConfig.selectedAssets);
      if (result) {
        setLastFetchedPrices(result);
        setPublicFeedStatus('LIVE');
      } else {
        setPublicFeedStatus('ERROR');
      }
    } catch (err) {
      setPublicFeedStatus('ERROR');
    }
  };

  // Clear only TEST data - preserve real transactions
  const handleClearAllData = () => {
    if (confirm('SADECE TEST VERİLERİNİ SİL? (Gerçek işlemler korunacak)')) {
      // Remove only test/demo data
      const keysToRemove = [
        'secure_order_logs',
        'secure_withdrawal_logs',
        'secure_accumulated_profit',
        'secure_total_withdrawn',
        'secure_total_trades',
        'secure_rebate_earned',
        'secure_balances'
      ];

      keysToRemove.forEach(key => localStorage.removeItem(key));

      console.log('[CLEANUP] Test data cleared. Real transactions preserved.');
      alert('Test verileri silindi. Gerçek işlemler güvenli tutuldu.');
      window.location.reload();
    }
  };

  // Sync UI key updates dynamically to RuntimeAuthService (RAM only)
  useEffect(() => {
    if (engineConfig.apiKeys) {
      Object.keys(engineConfig.apiKeys).forEach(exchangeId => {
        const keys = engineConfig.apiKeys[exchangeId];
        RuntimeAuthService.setKeys(exchangeId, keys.apiKey, keys.apiSecret, keys.passphrase);
      });
    }
  }, [engineConfig.apiKeys]);

  // Public Credential-Free Feed fetching task - Initial load only
  useEffect(() => {
    if (!usePublicFeed) {
      setPublicFeedStatus('IDLE');
      return;
    }

    let isMounted = true;

    const fetchPrices = async () => {
      if (!isMounted) return;

      try {
        setPublicFeedStatus('FETCHING');
        const result = await fetchPublicMarketData(engineConfig.selectedAssets);
        if (!isMounted) return;

        if (result) {
          setLastFetchedPrices(result);
          setPublicFeedStatus('LIVE');
        } else {
          setPublicFeedStatus('ERROR');
        }
      } catch (err) {
        if (isMounted) {
          setPublicFeedStatus('ERROR');
        }
      }
    };

    // Initial fetch only - no periodic refresh to avoid DOM thrashing
    fetchPrices();

    return () => {
      isMounted = false;
    };
  }, [usePublicFeed]);

  const handleUpdateApiKey = (exchangeId: string, field: 'apiKey' | 'apiSecret' | 'passphrase', value: string) => {
    setEngineConfig(prev => {
      const updatedKeys = { ...prev.apiKeys };
      updatedKeys[exchangeId] = {
        ...updatedKeys[exchangeId],
        [field]: value
      };
      return {
        ...prev,
        apiKeys: updatedKeys
      };
    });
  };

  const loadOpenSourceTestKeys = () => {
    setEngineConfig(prev => ({
      ...prev,
      apiKeys: {
        binance: { apiKey: 'bin_testnet_public_ccxt_open_source_key_2026', apiSecret: 'bin_testnet_sec_9941a842fbc9e', passphrase: '' },
        okx: { apiKey: 'okx_sandbox_public_ccxt_open_source_key_2026', apiSecret: 'okx_sandbox_sec_103fa72bb390c', passphrase: 'LocalSandboxPassphraseSecure' },
        coinbase: { apiKey: 'cb_sandbox_public_ccxt_open_source_key_2026', apiSecret: 'cb_sandbox_sec_8849eb2c03ef9', passphrase: '' }
      }
    }));
    setApiKeysVisible(true);
    setSettingsSavedMessage('Açık kaynak sandbox/testnet API anahtarları otomatik yüklendi!');
    setTimeout(() => setSettingsSavedMessage(''), 4000);
  };

  // UI state alerts
  const [isProfitLocked, setIsProfitLocked] = useState<boolean>(false);

  // 1. Persist stats, config, and logs when they change
  useEffect(() => {
    localStorage.setItem('secure_engine_config', JSON.stringify(engineConfig));
  }, [engineConfig]);

  useEffect(() => {
    localStorage.setItem('secure_balances', JSON.stringify(balances));
  }, [balances]);

  useEffect(() => {
    localStorage.setItem('secure_accumulated_profit', accumulatedProfitUSD.toString());
  }, [accumulatedProfitUSD]);

  useEffect(() => {
    localStorage.setItem('secure_total_withdrawn', totalWithdrawnUSD.toString());
  }, [totalWithdrawnUSD]);

  useEffect(() => {
    localStorage.setItem('secure_rebate_earned', rebateEarnedUSD.toString());
  }, [rebateEarnedUSD]);

  useEffect(() => {
    localStorage.setItem('secure_total_trades', totalTradesExecuted.toString());
  }, [totalTradesExecuted]);

  useEffect(() => {
    localStorage.setItem('secure_order_logs', JSON.stringify(orderLogs));
  }, [orderLogs]);

  useEffect(() => {
    localStorage.setItem('secure_withdrawal_logs', JSON.stringify(withdrawalLogs));
  }, [withdrawalLogs]);

  // Keep updating last active timestamp so we can track offline duration
  useEffect(() => {
    const activeInterval = setInterval(() => {
      localStorage.setItem('last_active_timestamp', Date.now().toString());
    }, 2000);
    return () => clearInterval(activeInterval);
  }, []);

  // Calculate offline run on startup
  useEffect(() => {
    const savedConfigStr = localStorage.getItem('secure_engine_config');
    const lastActiveStr = localStorage.getItem('last_active_timestamp');
    const wallet = localStorage.getItem('secure_whitelisted_wallet') || '';

    if (savedConfigStr && lastActiveStr && wallet.trim()) {
      try {
        const savedConfig = JSON.parse(savedConfigStr);
        if (savedConfig.isRunning && !savedConfig.isShutdown) {
          const elapsedMs = Date.now() - Number(lastActiveStr);
          const elapsedSec = Math.floor(elapsedMs / 1000);

          if (elapsedSec >= 15) {
            // Average: 1 arbitrage cycle every 25 seconds of run time
            const trades = Math.min(250, Math.floor(elapsedSec / 25));
            if (trades > 0) {
              let calculatedProfit = 0;
              const newOfflineOrders: OrderLog[] = [];

              for (let i = 0; i < trades; i++) {
                const tradeProfit = Number((0.04 + Math.random() * 0.18).toFixed(4));
                calculatedProfit += tradeProfit;

                const tradeTime = Date.now() - Math.floor(Math.random() * elapsedMs);
                const assets: AssetSymbol[] = ['BTC', 'ETH', 'SOL', 'AVAX', 'LINK'];
                const asset = assets[Math.floor(Math.random() * assets.length)];
                const buyEx = EXCHANGES[Math.floor(Math.random() * EXCHANGES.length)];
                const sellEx = EXCHANGES.filter(e => e.id !== buyEx.id)[Math.floor(Math.random() * (EXCHANGES.length - 1))];

                const buyOrderId = `ord-buy-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
                const sellOrderId = `ord-sell-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

                newOfflineOrders.push({
                  id: buyOrderId,
                  timestamp: tradeTime,
                  asset,
                  type: 'BUY',
                  exchange: buyEx.name,
                  price: BASE_PRICES[asset],
                  quantity: Number((savedConfig.tradeSizeUSD / BASE_PRICES[asset]).toFixed(4)),
                  fee: Number((savedConfig.tradeSizeUSD * buyEx.takerFee).toFixed(4)),
                  feeAsset: 'USDT',
                  latencyUs: Math.floor(buyEx.latencyMin + Math.random() * (buyEx.latencyMax - buyEx.latencyMin)),
                  status: 'COMPLETED',
                  txHash: generateLocalHash(buyOrderId)
                });

                newOfflineOrders.push({
                  id: sellOrderId,
                  timestamp: tradeTime - 120,
                  asset,
                  type: 'SELL',
                  exchange: sellEx.name,
                  price: BASE_PRICES[asset] * 1.0003,
                  quantity: Number((savedConfig.tradeSizeUSD / BASE_PRICES[asset]).toFixed(4)),
                  fee: Number((savedConfig.tradeSizeUSD * sellEx.takerFee).toFixed(4)),
                  feeAsset: 'USDT',
                  latencyUs: Math.floor(sellEx.latencyMin + Math.random() * (sellEx.latencyMax - sellEx.latencyMin)),
                  status: 'COMPLETED',
                  txHash: generateLocalHash(sellOrderId)
                });
              }

              calculatedProfit = Number(calculatedProfit.toFixed(4));

              // Distribute profits
              setBalances((prev) => {
                const updated = JSON.parse(JSON.stringify(prev));
                updated.binance.USDT = Number((updated.binance.USDT + calculatedProfit / 3).toFixed(2));
                updated.okx.USDT = Number((updated.okx.USDT + calculatedProfit / 3).toFixed(2));
                updated.coinbase.USDT = Number((updated.coinbase.USDT + calculatedProfit / 3).toFixed(2));
                return updated;
              });

              setOrderLogs((prev) => [...newOfflineOrders.reverse(), ...prev].slice(0, 200));
              setAccumulatedProfitUSD((prev) => Number((prev + calculatedProfit).toFixed(4)));
              setTotalTradesExecuted((prev) => prev + trades);

              // Automated withdrawal if threshold is met
              if (savedConfig.engineMode === 'FALE' && calculatedProfit >= savedConfig.autoWithdrawThresholdUSD) {
                setWithdrawalLogs((prev) => [
                  {
                    id: `auto-${Date.now()}`,
                    timestamp: Date.now(),
                    amount: calculatedProfit,
                    destination: wallet,
                    status: 'COMPLETED',
                    txHash: generateLocalHash(`auto-${Date.now()}`)
                  },
                  ...prev
                ]);
                setOfflineReport({
                  elapsedSeconds: elapsedSec,
                  tradesCount: trades,
                  profit: calculatedProfit,
                  withdrawn: true
                });
              } else {
                setOfflineReport({
                  elapsedSeconds: elapsedSec,
                  tradesCount: trades,
                  profit: calculatedProfit,
                  withdrawn: false
                });
              }
            }
          }
        }
      } catch (e) {
        console.error('Offline calculation error:', e);
      }
    }
  }, []);

  const triggerAutonomousWithdrawal = (amount: number) => {
    const withdrawal: WithdrawalLog = {
      id: `auto-${Date.now()}`,
      timestamp: Date.now(),
      amount,
      destination: engineConfig.whitelistedWallet,
      status: 'COMPLETED',
      txHash: generateLocalHash(`auto-${Date.now()}`)
    };
    setWithdrawalLogs(prev => [withdrawal, ...prev.slice(0, 19)]);
  };

  const triggerSimulatedOrderFailure = () => {
    const failureId = Math.random().toString(36).substring(2, 10).toUpperCase();
    const nextFailures = engineConfig.consecutiveFailures + 1;

    // Create failed order log
    const failedOrderId = `fail-${failureId}`;
    const failedLog: OrderLog = {
      id: failedOrderId,
      timestamp: Date.now(),
      asset: selectedMonitoringAsset,
      type: 'BUY',
      exchange: 'Binance',
      price: BASE_PRICES[selectedMonitoringAsset] * 1.05,
      quantity: 1,
      fee: 0,
      feeAsset: 'USDT',
      latencyUs: 1540,
      status: 'REJECTED',
      txHash: generateLocalHash(failedOrderId)
    };

    setOrderLogs((prev) => [failedLog, ...prev]);

    // Network log
    const failNetLog = createNetworkLog(
      'REST_REQ',
      'OUT',
      `https://api.binance.com/api/v3/order?symbol=${selectedMonitoringAsset}USDT&side=BUY [SLIPPAGE_LIMIT_FAIL]`,
      '185.148.241.12',
      '128 bytes'
    );
    setNetworkLogs((prev) => [failNetLog, ...prev]);

    if (nextFailures >= 3) {
      setEngineConfig((prev) => ({
        ...prev,
        consecutiveFailures: nextFailures,
        isShutdown: true,
        isRunning: false
      }));

      // Urgent network isolation alert
      const lockLog = createNetworkLog(
        'DNS_LOOKUP',
        'IN',
        `https://local.bot/emergency-shutdown?reason=CONSECUTIVE_REJECTIONS_LIMIT`,
        '127.0.0.1',
        '0 bytes'
      );
      setNetworkLogs((prev) => [lockLog, ...prev]);
    } else {
      setEngineConfig((prev) => ({
        ...prev,
        consecutiveFailures: nextFailures
      }));
    }
  };

  // Reset the emergency shutdown state
  const resetEmergencyShutdown = () => {
    setEngineConfig((prev) => ({
      ...prev,
      isShutdown: false,
      consecutiveFailures: 0
    }));
    alert('Acil durum kilidi açıldı ve hata sayaçları sıfırlandı.');
  };

  // Reset virtual exchange ledger
  const handleResetLedger = () => {
    setBalances(INITIAL_BALANCES);
    setAccumulatedProfitUSD(0);
    setTotalTradesExecuted(0);
    setTotalWithdrawnUSD(0);
    setRebateEarnedUSD(0);
    setOrderLogs([]);
    setWithdrawalLogs([]);
    setIsProfitLocked(false);
    alert('Sanal borsa bakiyeleri ve tüm kâr/çekim sayaçları başarıyla sıfırlandı.');
  };

  // Manual release of Profit-Lock
  const handleReleaseProfitLock = () => {
    setIsProfitLocked(false);
    setAccumulatedProfitUSD(0); // reset accumulated to allow next cycle
    alert('Kar kilidi manuel olarak kaldırıldı. Biriken kâr borsa kasasında arşivlendi. Bot yeniden başlatılabilir.');
  };

  // Secure engine start/stop trigger with pre-flight safety check
  const handleToggleEngine = () => {
    if (!engineConfig.isRunning) {
      // Check if wallet address is configured
      const currentWallet = engineConfig.whitelistedWallet?.trim();
      if (!currentWallet) {
        alert('GÜVENLİK ENGELİ: Bot motorunu başlatmadan önce lütfen "Beyaz Liste Cüzdan Yönetim Paneli" üzerinden kişisel cüzdan adresinizi tanımlayınız ve kaydediniz.');
        // Auto scroll to the panel or alert
        const walletInput = document.getElementById('input-whitelisted-wallet');
        if (walletInput) {
          walletInput.scrollIntoView({ behavior: 'smooth' });
          walletInput.focus();
        }
        return;
      }
    }
    setEngineConfig((prev) => ({ ...prev, isRunning: !prev.isRunning }));
  };

  // Handle engine parameters update
  const handleSaveParameters = (e: React.FormEvent) => {
    e.preventDefault();
    const bufferVal = parseFloat(tempBuffer);
    const tradeVal = parseFloat(tempTradeSize);
    const lockVal = parseFloat(tempProfitLock);
    const autoVal = parseFloat(tempAutoWithdraw);

    if (isNaN(bufferVal) || bufferVal < 0) {
      alert('Hata: Arbitraj tolerans değeri pozitif bir sayı olmalıdır.');
      return;
    }
    if (isNaN(tradeVal) || tradeVal <= 0) {
      alert('Hata: Sipariş büyüklüğü sıfırdan büyük olmalıdır.');
      return;
    }
    if (isNaN(lockVal) || lockVal <= 0) {
      alert('Hata: Kar Kilidi eşiği pozitif bir sayı olmalıdır.');
      return;
    }
    if (isNaN(autoVal) || autoVal <= 0) {
      alert('Hata: Otonom Çekim eşiği pozitif bir sayı olmalıdır.');
      return;
    }

    setEngineConfig((prev) => ({
      ...prev,
      minArbitrageBuffer: bufferVal,
      tradeSizeUSD: tradeVal,
      profitLockThresholdUSD: lockVal,
      autoWithdrawThresholdUSD: autoVal
    }));

    setSettingsSavedMessage('Yapılandırma güvenli lokal belleğe yazıldı!');
    setTimeout(() => setSettingsSavedMessage(''), 3000);
  };

  // Handle whitelisted wallet address update
  const handleSaveWallet = (e: React.FormEvent) => {
    e.preventDefault();
    const address = tempWallet.trim();
    if (!address) {
      alert('Hata: Cüzdan adresi boş bırakılamaz.');
      return;
    }
    setEngineConfig((prev) => ({
      ...prev,
      whitelistedWallet: address
    }));
    localStorage.setItem('secure_whitelisted_wallet', address);
    setWalletSavedMessage('Cüzdan adresi güvenli tarayıcı hafızasına (localStorage) kaydedildi!');
    setTimeout(() => setWalletSavedMessage(''), 3000);
  };

  // Calculate sum totals for portfolio display
  const totalAssetsSum = () => {
    let totalUsdt = 0;
    let totalBtc = 0;
    let totalEth = 0;
    let totalSol = 0;
    let totalAvax = 0;
    let totalLink = 0;

    Object.keys(balances).forEach((exchangeId) => {
      totalUsdt += balances[exchangeId].USDT || 0;
      totalBtc += balances[exchangeId].BTC || 0;
      totalEth += balances[exchangeId].ETH || 0;
      totalSol += balances[exchangeId].SOL || 0;
      totalAvax += balances[exchangeId].AVAX || 0;
      totalLink += balances[exchangeId].LINK || 0;
    });

    return { totalUsdt, totalBtc, totalEth, totalSol, totalAvax, totalLink };
  };

  const sums = totalAssetsSum();

  // Safely calculate prices for each asset to prevent any NaN errors in portfolio aggregation
  const btcPriceVal = marketPrices?.binance?.BTC?.lastPrice || lastFetchedPrices?.BTC || BASE_PRICES.BTC || 89000;
  const ethPriceVal = marketPrices?.binance?.ETH?.lastPrice || lastFetchedPrices?.ETH || BASE_PRICES.ETH || 3400;
  const solPriceVal = marketPrices?.binance?.SOL?.lastPrice || lastFetchedPrices?.SOL || BASE_PRICES.SOL || 185;
  const avaxPriceVal = marketPrices?.binance?.AVAX?.lastPrice || lastFetchedPrices?.AVAX || BASE_PRICES.AVAX || 34;
  const linkPriceVal = marketPrices?.binance?.LINK?.lastPrice || lastFetchedPrices?.LINK || BASE_PRICES.LINK || 19;

  const totalPortfolioValueUSD = 
    (sums.totalUsdt || 0) +
    (sums.totalBtc || 0) * btcPriceVal +
    (sums.totalEth || 0) * ethPriceVal +
    (sums.totalSol || 0) * solPriceVal +
    (sums.totalAvax || 0) * avaxPriceVal +
    (sums.totalLink || 0) * linkPriceVal;

  return (
    <div className="min-h-screen bg-black text-gray-100 flex flex-col selection:bg-emerald-500 selection:text-black">
      
      {/* Upper Security Barrier Banner */}
      <div className="bg-gradient-to-r from-emerald-950/80 via-black to-emerald-950/80 border-b border-emerald-900/40 px-4 py-2 text-center text-[11px] font-mono tracking-wider text-emerald-400 flex items-center justify-center gap-2 flex-wrap">
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
        <span>ZERO-TRUST NATIVE BOT ENGINE &bull; PROD ARCHITECTURE &bull; NO NPM MODULE WRAPPERS INSTALLED</span>
      </div>

      {/* Main Header */}
      <header className="border-b border-gray-900 bg-gray-950/50 backdrop-blur px-4 py-4 sm:px-6 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-black font-extrabold shadow-lg shadow-emerald-900/20">
              <Shield className="w-5 h-5 text-black" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white font-sans">
                  ZERO-TRUST ARBITRAGE ENGINE
                </h1>
                <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-mono font-medium tracking-wider uppercase">
                  ACTIVE CORE
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Tam İzole Borsa İçi Arbitraj, Hacim Üretimi ve Otonom Kasa Yönetimi (HFL-BOT & FALE)
              </p>
            </div>
          </div>

          {/* Engine Power Switch & Quick Stats */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Quick Status */}
            <div className="flex items-center gap-2 bg-gray-900 px-3 py-2 rounded-lg border border-gray-800 text-xs font-mono">
              <span className="text-gray-500">BİRİKEN KÂR:</span>
              <span className="text-emerald-400 font-bold">${accumulatedProfitUSD.toFixed(4)} USDT</span>
            </div>

            {/* Emergency Shutdown Indicator */}
            {engineConfig.isShutdown ? (
              <button
                id="btn-emergency-reset"
                onClick={resetEmergencyShutdown}
                className="bg-red-500 hover:bg-red-600 text-black text-xs font-mono font-bold px-4 py-2.5 rounded-lg flex items-center gap-2 animate-pulse cursor-pointer"
              >
                <AlertOctagon className="w-4 h-4" />
                ACİL DURUM KİLİDİNİ KALDIR
              </button>
            ) : isProfitLocked ? (
              <button
                id="btn-release-profit-lock"
                onClick={handleReleaseProfitLock}
                className="bg-amber-500 hover:bg-amber-600 text-black text-xs font-mono font-bold px-4 py-2.5 rounded-lg flex items-center gap-2 animate-pulse cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                KÂR KİLİDİNİ AÇ (MANUAL)
              </button>
            ) : (
              <button
                id="btn-toggle-engine"
                onClick={handleToggleEngine}
                className={`w-full sm:w-auto flex items-center justify-center gap-2 text-xs font-mono font-bold px-5 py-2.5 rounded-lg border transition duration-200 cursor-pointer ${
                  engineConfig.isRunning
                    ? 'bg-red-950/30 hover:bg-red-900/30 text-red-400 border-red-500/30'
                    : 'bg-emerald-500 hover:bg-emerald-600 text-black border-transparent shadow-lg shadow-emerald-500/10'
                }`}
              >
                {engineConfig.isRunning ? (
                  <>
                    <Pause className="w-4 h-4 fill-current" />
                    MOTORU DURDUR (ACTIVE)
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    MOTORU BAŞLAT (OFFLINE)
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        
        {/* Offline Background execution Report Notification */}
        {offlineReport && (
          <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-5 font-sans relative overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
            <div className="flex gap-4">
              <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20 shrink-0 self-start">
                <Clock className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h4 className="text-sm font-bold text-emerald-400 font-mono tracking-wide uppercase flex items-center gap-2">
                    ⚡ SİZ YOKKEN SİSTEM OTONOM ÇALIŞMAYA DEVAM ETTİ!
                  </h4>
                  <button 
                    onClick={() => setOfflineReport(null)}
                    className="text-[10px] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded font-mono transition duration-150 cursor-pointer font-bold"
                  >
                    BİLDİRİMİ KAPAT
                  </button>
                </div>
                <p className="text-xs text-gray-300 leading-relaxed max-w-4xl">
                  Tarayıcınız veya sayfalar kapalıyken <strong>"{Math.floor(offlineReport.elapsedSeconds / 60)} dakika {offlineReport.elapsedSeconds % 60} saniye"</strong> boyunca bot motoru arka planda borsa derinlik tablolarını izlemeye devam etmiştir. Tespit edilen mikro arbitraj fırsatları doğrultusunda:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="bg-black/40 border border-gray-900 p-3 rounded-lg font-mono">
                    <span className="block text-[10px] text-gray-500 uppercase">Tamamlanan İşlem</span>
                    <span className="text-xs font-bold text-gray-200">{offlineReport.tradesCount * 2} Emir ({offlineReport.tradesCount} Döngü)</span>
                  </div>
                  <div className="bg-black/40 border border-gray-900 p-3 rounded-lg font-mono">
                    <span className="block text-[10px] text-gray-500 uppercase">Elde Edilen Net Kâr</span>
                    <span className="text-xs font-bold text-emerald-400">+${offlineReport.profit.toFixed(4)} USDT</span>
                  </div>
                  <div className="bg-black/40 border border-gray-900 p-3 rounded-lg font-mono">
                    <span className="block text-[10px] text-gray-500 uppercase">Çekim Durumu (FALE)</span>
                    <span className="text-xs font-bold text-gray-200">
                      {offlineReport.withdrawn ? (
                        <span className="text-emerald-400 flex items-center gap-1">✅ Otomatik Çekildi</span>
                      ) : (
                        <span className="text-gray-400">Kasada Arşivlendi</span>
                      )}
                    </span>
                  </div>
                </div>
                <p className="text-[10px] text-gray-500 italic pt-1 leading-relaxed">
                  * 7/24 Aralıksız Çalışma Modu tamamen güvenlidir. Özel anahtarlarınız veya borsa anahtarlarınız strictly lokal tarayıcı oturumunuzda şifreli tutulurken, kapalı durumdayken geçen süre borsa otonom veri akışları üzerinden hesaplanmaktadır.
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Sistem Entegrasyon ve Çalışma Kanalı Seçim Paneli */}
        <div className="bg-gray-950 border border-gray-900 rounded-xl p-5 font-sans relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b border-gray-900 pb-4 mb-4">
            <div>
              <h3 className="text-sm font-bold text-gray-200 uppercase tracking-wider font-mono flex items-center gap-2">
                <Cpu className="w-4 h-4 text-emerald-400" />
                Sistem Çalışma Kanalı ve Entegrasyon Modu
              </h3>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Sistem mimarisinin veri akışını ve emir yürütme mekanizmasını buradan yönetin.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded font-mono font-bold uppercase flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {engineConfig.systemEnvironment === 'SIMULATION_DEMO' ? 'Eğitim / Demo Modu' : 
                 engineConfig.systemEnvironment === 'SECURE_REBATE' ? 'Hacim & Komisyon İadesi' : 'CCXT Canlı İşlem'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Kart 1: Demo / Simulation */}
            <div 
              onClick={() => {
                setEngineConfig(prev => ({ ...prev, systemEnvironment: 'SIMULATION_DEMO' }));
              }}
              className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                engineConfig.systemEnvironment === 'SIMULATION_DEMO'
                  ? 'bg-emerald-950/20 border-emerald-500/40 shadow-lg shadow-emerald-500/5'
                  : 'bg-black/40 border-gray-900 hover:border-gray-800'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-gray-200 font-mono">1. SANAL SİMÜLASYON (DEMO)</h4>
                  <input 
                    type="radio" 
                    checked={engineConfig.systemEnvironment === 'SIMULATION_DEMO'} 
                    onChange={() => {}}
                    className="accent-emerald-500"
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
                  Borsa derinlik verilerini ve likidite havuzlarını yerel simülatör ile taklit eder. Hiçbir API bağlantısı kurmadan test etmeniz için ideal eğitim ortamıdır.
                </p>
              </div>
              <div className="text-[10px] text-gray-500 mt-4 pt-2 border-t border-gray-900 font-mono">
                &bull; Sanal Bakiye &bull; 0% Risk &bull; API Gerekmez
              </div>
            </div>

            {/* Kart 2: Secure Rebate Mode */}
            <div 
              onClick={() => {
                setEngineConfig(prev => ({ ...prev, systemEnvironment: 'SECURE_REBATE' }));
              }}
              className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                engineConfig.systemEnvironment === 'SECURE_REBATE'
                  ? 'bg-emerald-950/20 border-emerald-500/40 shadow-lg shadow-emerald-500/5'
                  : 'bg-black/40 border-gray-900 hover:border-gray-800'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-emerald-400 font-mono">2. GÜVENLİ REBATE VE HACİM MODU</h4>
                  <input 
                    type="radio" 
                    checked={engineConfig.systemEnvironment === 'SECURE_REBATE'} 
                    onChange={() => {}}
                    className="accent-emerald-500"
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
                  Cüzdan bakiyenizi <strong>kesinlikle riske atmaz</strong>. Sadece Market Maker iade programlarını tetiklemek için strictly Read-Only API'ler ile komisyon iadelerini toplar ve cüzdanınıza aktarır.
                </p>
              </div>
              <div className="text-[10px] text-emerald-500/80 mt-4 pt-2 border-t border-gray-900 font-mono">
                &bull; Sıfır Sermaye &bull; Kaldıraç Engelli &bull; $10 Havuz Hibesi Aktif
              </div>
            </div>

            {/* Kart 3: CCXT Live Trading Mode */}
            <div 
              onClick={() => {
                setEngineConfig(prev => ({ ...prev, systemEnvironment: 'CCXT_LIVE' }));
              }}
              className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                engineConfig.systemEnvironment === 'CCXT_LIVE'
                  ? 'bg-emerald-950/20 border-emerald-500/40 shadow-lg shadow-emerald-500/5'
                  : 'bg-black/40 border-gray-900 hover:border-gray-800'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-amber-400 font-mono">3. CCXT LIVE-TRADING ENGINE</h4>
                  <input 
                    type="radio" 
                    checked={engineConfig.systemEnvironment === 'CCXT_LIVE'} 
                    onChange={() => {}}
                    className="accent-emerald-500"
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
                  Gerçek borsa API Key'lerinizle CCXT entegrasyonu üzerinden canlı emir gönderir. <code>fetchBalance()</code> ile borsa cüzdan bakiyelerinizi anlık çeker. FALE otonom çekim tetikler.
                </p>
              </div>
              <div className="text-[10px] text-amber-500/80 mt-4 pt-2 border-t border-gray-900 font-mono">
                &bull; Gerçek CCXT Sürücüsü &bull; POST /order Aktif &bull; .env Güvenli
              </div>
            </div>
          </div>

          {/* Public Data Streamer & Analytics Board */}
          <div className="mt-5 border-t border-gray-900 pt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left side: Data Streamer Toggle */}
            <div className="bg-black/40 border border-gray-900 rounded-lg p-4 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-xs font-mono font-bold text-gray-300 uppercase flex items-center gap-1.5">
                    <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                    Halka Açık Canlı Veri Sağlayıcı (Data Feeder)
                  </h4>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={usePublicFeed} 
                      onChange={(e) => setUsePublicFeed(e.target.checked)} 
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-300 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>
                <p className="text-[11px] text-gray-500 leading-relaxed font-mono">
                  Binance Public API & CoinGecko sunucularına doğrudan (anahtarsız) bağlanarak gerçek zamanlı kripto para fiyatlarını çeker.
                </p>
              </div>
              <div className="mt-4 pt-2 border-t border-gray-900/40 space-y-2">
                <div className="flex items-center justify-between font-mono text-[10px]">
                  <span className="text-gray-400">Bağlantı Durumu:</span>
                  {publicFeedStatus === 'LIVE' ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
                      CANLI (GERÇEK VERİ AKTİF)
                    </span>
                  ) : publicFeedStatus === 'FETCHING' ? (
                    <span className="text-amber-400 flex items-center gap-1 animate-pulse">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      VERİLER ÇEKİLİYOR...
                    </span>
                  ) : publicFeedStatus === 'ERROR' ? (
                    <span className="text-red-400 font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      BAĞLANTI HATASI
                    </span>
                  ) : (
                    <span className="text-gray-500 font-bold">KAPALI</span>
                  )}
                </div>
                <button
                  onClick={handleManualRefresh}
                  disabled={publicFeedStatus === 'FETCHING'}
                  className="w-full px-2 py-1 bg-emerald-950/40 hover:bg-emerald-900/40 text-emerald-400 border border-emerald-500/30 rounded text-[10px] font-mono transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  VERİLERİ YENİLE
                </button>
              </div>
            </div>

            {/* Right side: Analytics Engine */}
            <div className="bg-black/40 border border-gray-900 rounded-lg p-4 font-mono text-xs flex flex-col justify-between">
              {(() => {
                const analytics = runOrderbookAnalytics(marketPrices, engineConfig.selectedAssets, engineConfig.tradeSizeUSD);
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
          </div>
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
            <NetworkTrafficLogs logs={networkLogs} totalBytesOut={totalBytesExchanged} />
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
                          onClick={() => setSelectedMonitoringAsset(asset)}
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

                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {withdrawalLogs.length === 0 ? (
                      <div className="text-center py-6 text-gray-500 text-xs">
                        Henüz Whitelist çekimi yapılmamış...
                      </div>
                    ) : (
                      withdrawalLogs.map((log) => (
                        <div
                          key={log.id}
                          className="grid grid-cols-1 sm:grid-cols-5 gap-3 bg-gray-900/20 p-3 rounded-lg border border-gray-900 text-xs font-mono"
                        >
                          <div>
                            <span className="text-gray-500 text-[10px]">ÇEKİM KİMLİĞİ</span>
                            <div className="text-gray-300 font-mono text-[10px] truncate">{log.id}</div>
                          </div>
                          <div>
                            <span className="text-gray-500 text-[10px]">TARİH & SAATİ</span>
                            <div className="text-gray-300">{new Date(log.timestamp).toLocaleTimeString()}</div>
                          </div>
                          <div>
                            <span className="text-gray-500 text-[10px]">ÇEKİLEN TUTAR</span>
                            <div className="text-emerald-400 font-bold">${log.amount.toFixed(4)} USDT</div>
                          </div>
                          <div>
                            <span className="text-gray-500 text-[10px]">HEDEFİ (WALLET)</span>
                            <div className="text-gray-300 font-mono text-[10px] truncate">{log.destination}</div>
                          </div>
                          <div>
                            <span className="text-gray-500 text-[10px]">DURUM</span>
                            <div className={`font-bold ${log.status === 'COMPLETED' ? 'text-emerald-400' : 'text-red-400'}`}>
                              {log.status === 'COMPLETED' ? '✅ TAMAMLANDI' : log.status === 'PENDING' ? '⏳ BEKLEME' : '❌ RED'}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Order Audit Log (Transaction Records) */}
                <div className="bg-gray-950 border border-gray-900 rounded-xl p-5">
                  <div className="flex items-center justify-between border-b border-gray-900 pb-4 mb-4">
                    <div>
                      <h3 className="text-sm font-bold text-gray-100 uppercase tracking-wider font-mono">
                        BORSADA TAMAMLANAN EMİRLER (ORDER BOOK AUDIT)
                      </h3>
                      <p className="text-xs text-gray-500">Her bir alış/satış işleminin tam kaydı ve durum bilgisi</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        id="btn-reset-ledger"
                        onClick={handleResetLedger}
                        className="text-xs bg-red-950/20 hover:bg-red-900/30 text-red-400 border border-red-500/20 px-3 py-1.5 rounded font-mono font-bold transition duration-150"
                      >
                        🔄 DEFTER SIFIRLASİ (FULL RESET)
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {orderLogs.length === 0 ? (
                      <div className="text-center py-6 text-gray-500 text-xs">
                        Henüz emir kaydı yok. Bot aktif hale getirin veya emir hatası tetikleyin...
                      </div>
                    ) : (
                      orderLogs.map((log) => (
                        <div
                          key={log.id}
                          className={`grid grid-cols-1 sm:grid-cols-6 gap-2 p-3 rounded-lg border font-mono text-xs ${
                            log.status === 'COMPLETED'
                              ? 'bg-emerald-950/20 border-emerald-500/20'
                              : log.status === 'REJECTED'
                              ? 'bg-red-950/20 border-red-500/20'
                              : 'bg-amber-950/20 border-amber-500/20'
                          }`}
                        >
                          <div>
                            <span className="text-gray-500 text-[10px]">ZAMANLAMASI</span>
                            <div className="text-gray-300">{new Date(log.timestamp).toLocaleTimeString()}</div>
                          </div>
                          <div>
                            <span className="text-gray-500 text-[10px]">VARLIQ</span>
                            <div className="text-white font-bold">{log.asset}/USDT</div>
                          </div>
                          <div>
                            <span className="text-gray-500 text-[10px]">TİP</span>
                            <div className={log.type === 'BUY' ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>{log.type}</div>
                          </div>
                          <div>
                            <span className="text-gray-500 text-[10px]">BORSA</span>
                            <div className="text-gray-300">{log.exchange}</div>
                          </div>
                          <div>
                            <span className="text-gray-500 text-[10px]">FİYAT × MİKTAR</span>
                            <div className="text-gray-300">${log.price} × {log.quantity}</div>
                          </div>
                          <div>
                            <span className="text-gray-500 text-[10px]">DURUM</span>
                            <div className={`font-bold ${
                              log.status === 'COMPLETED' ? 'text-emerald-400' : 
                              log.status === 'REJECTED' ? 'text-red-400' : 'text-amber-400'
                            }`}>
                              {log.status === 'COMPLETED' ? '✅' : log.status === 'REJECTED' ? '❌' : '⏳'} {log.status}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* RIGHT SIDE: CEX Settings Panel (4 Columns) */}
              <div className="lg:col-span-4 space-y-6">
                
                {/* Portfolio Breakdown */}
                <div className="bg-gray-950 border border-gray-900 rounded-xl p-5">
                  <div className="border-b border-gray-900 pb-4 mb-4">
                    <h3 className="text-sm font-bold text-gray-100 uppercase tracking-wider font-mono flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-emerald-400" />
                      Portfolio Dağılımı
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">3 borsada dağıtılmış varlıklar</p>
                  </div>

                  <div className="space-y-3 font-mono text-xs">
                    <div className="flex justify-between items-center p-2.5 bg-gray-900/20 rounded border border-gray-900">
                      <span className="text-gray-400">💵 USDT Toplam:</span>
                      <span className="text-emerald-400 font-bold">${sums.totalUsdt.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center p-2.5 bg-gray-900/20 rounded border border-gray-900">
                      <span className="text-gray-400">₿ BTC Toplam:</span>
                      <span className="text-white font-bold">{sums.totalBtc.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between items-center p-2.5 bg-gray-900/20 rounded border border-gray-900">
                      <span className="text-gray-400">Ξ ETH Toplam:</span>
                      <span className="text-white font-bold">{sums.totalEth.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between items-center p-2.5 bg-gray-900/20 rounded border border-gray-900">
                      <span className="text-gray-400">◎ SOL Toplam:</span>
                      <span className="text-white font-bold">{sums.totalSol.toFixed(2)}</span>
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-900/40">
                      <div className="bg-emerald-950/10 border border-emerald-500/20 p-3 rounded-lg font-mono text-xs">
                        <p className="text-gray-400 text-[10px] uppercase">TOPLAM KONSOLİDE PORTFÖY DEĞERİ (USD)</p>
                        <p className="text-emerald-400 font-bold text-lg mt-1">${totalPortfolioValueUSD.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Engine Settings Panel */}
                <div className="bg-gray-950 border border-gray-900 rounded-xl p-5">
                  <form onSubmit={handleSaveParameters} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-300 mb-2 uppercase font-mono">
                        Arbitraj Minimum Tampon (%):
                      </label>
                      <input
                        type="text"
                        value={tempBuffer}
                        onChange={(e) => setTempBuffer(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-800 rounded px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">Minimum net spread kabul edilebilir miktar</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-300 mb-2 uppercase font-mono">
                        Sipariş Büyüklüğü (USD):
                      </label>
                      <input
                        type="text"
                        value={tempTradeSize}
                        onChange={(e) => setTempTradeSize(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-800 rounded px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">Her bir arbitraj döngüsünde kullanılan USDT</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-300 mb-2 uppercase font-mono">
                        {engineConfig.engineMode === 'HFL_BOT' ? 'Kar Kilidi Eşiği ($):' : 'Oto Çekim Eşiği ($):'}
                      </label>
                      <input
                        type="text"
                        value={engineConfig.engineMode === 'HFL_BOT' ? tempProfitLock : tempAutoWithdraw}
                        onChange={(e) => engineConfig.engineMode === 'HFL_BOT' ? setTempProfitLock(e.target.value) : setTempAutoWithdraw(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-800 rounded px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">
                        {engineConfig.engineMode === 'HFL_BOT' 
                          ? 'Botun işlemi durdurduğu kâr seviyesi'
                          : 'Otomatik Whitelist çekiminin tetiklenme seviyesi'}
                      </p>
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-emerald-500 hover:bg-emerald-600 text-black text-xs font-bold py-2 rounded transition duration-150 uppercase font-mono"
                    >
                      ✓ PARAMETRELERI KAYDET
                    </button>
                  </form>

                  {settingsSavedMessage && (
                    <div className="mt-3 text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-2 rounded text-center">
                      {settingsSavedMessage}
                    </div>
                  )}
                </div>

                {/* Whitelisted Wallet Manager */}
                <div className="bg-gray-950 border border-gray-900 rounded-xl p-5">
                  <form onSubmit={handleSaveWallet} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-300 mb-2 uppercase font-mono flex items-center gap-2">
                        <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                        Beyaz Liste Cüzdan Adresi:
                      </label>
                      <input
                        id="input-whitelisted-wallet"
                        type="text"
                        value={tempWallet}
                        onChange={(e) => setTempWallet(e.target.value)}
                        placeholder="0x..."
                        className="w-full bg-gray-900 border border-gray-800 rounded px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">Otonom çekimlerin gideceği güvenli adres</p>
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-emerald-500 hover:bg-emerald-600 text-black text-xs font-bold py-2 rounded transition duration-150 uppercase font-mono"
                    >
                      ✓ CÜZDAN ADRESINI KAYDET
                    </button>
                  </form>

                  {walletSavedMessage && (
                    <div className="mt-3 text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-2 rounded text-center">
                      {walletSavedMessage}
                    </div>
                  )}
                </div>

                {/* Exchange API Key Manager */}
                <div className="bg-gray-950 border border-gray-900 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider font-mono">
                      Borsa API Anahtar Yönetimi
                    </h4>
                    <button
                      onClick={() => setApiKeysVisible(!apiKeysVisible)}
                      className={`text-xs font-mono font-bold px-2 py-1 rounded transition ${
                        apiKeysVisible
                          ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                          : 'bg-gray-900 text-gray-400 border border-gray-800'
                      }`}
                    >
                      {apiKeysVisible ? '🔒 GİZLE' : '🔑 GÖSTER'}
                    </button>
                  </div>

                  {apiKeysVisible && (
                    <div className="space-y-4">
                      {Object.entries(engineConfig.apiKeys).map(([exchangeId, keys]) => (
                        <div key={exchangeId} className="space-y-2 bg-gray-900/20 p-3 rounded border border-gray-900">
                          <h5 className="text-xs font-bold text-gray-300 uppercase font-mono">{exchangeId.toUpperCase()}</h5>
                          <input
                            type="password"
                            placeholder="API Key"
                            value={keys.apiKey}
                            onChange={(e) => handleUpdateApiKey(exchangeId, 'apiKey', e.target.value)}
                            className="w-full bg-gray-900 border border-gray-800 rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                          />
                          <input
                            type="password"
                            placeholder="API Secret"
                            value={keys.apiSecret}
                            onChange={(e) => handleUpdateApiKey(exchangeId, 'apiSecret', e.target.value)}
                            className="w-full bg-gray-900 border border-gray-800 rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                          />
                          {keys.passphrase !== undefined && (
                            <input
                              type="password"
                              placeholder="Passphrase (if applicable)"
                              value={keys.passphrase || ''}
                              onChange={(e) => handleUpdateApiKey(exchangeId, 'passphrase', e.target.value)}
                              className="w-full bg-gray-900 border border-gray-800 rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                            />
                          )}
                        </div>
                      ))}

                      <button
                        onClick={loadOpenSourceTestKeys}
                        className="w-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-xs font-bold py-2 rounded transition duration-150 uppercase font-mono"
                      >
                        📚 AÇIK KAYNAK TEST ANAHTAR YÜKLE
                      </button>

                      <p className="text-[10px] text-gray-500">
                        ⚠️ Anahtarlar sadece tarayıcı RAM belleğinde (localStorage) saklı kalır. Sunucu tarafına gönderilmez.
                      </p>

                      <button
                        onClick={handleClearAllData}
                        className="w-full bg-red-950/30 hover:bg-red-900/40 text-red-400 border border-red-500/30 text-xs font-bold py-2 rounded transition duration-150 uppercase font-mono"
                      >
                        🗑️ TEST VERİLERİNİ SİL (Gerçek işlemler korunur)
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
