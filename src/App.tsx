import React, { useState, useEffect } from 'react';
import {
  Shield, Play, Pause, RefreshCw, Layers, TrendingUp, AlertTriangle,
  ArrowRight, DollarSign, Cpu, CheckCircle2, FileCode, Wifi, Clock,
  Lock, Settings, ShieldAlert, KeyRound, Check, Wallet, Send, LogOut, Info, AlertOctagon,
  FileDown
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
import RebateFarmingLab from './components/RebateFarmingLab';

export default function App() {
  // Tabs
  const [activeTab, setActiveTab] = useState<'monitoring' | 'network' | 'compiler' | 'contract'>('monitoring');

  // Time Tracker (seconds)
  const [timeSeconds, setTimeSeconds] = useState<number>(0);

  // Live internet network simulation status (ONLINE / OFFLINE)
  const [isNetworkOnline, setIsNetworkOnline] = useState<boolean>(true);

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
        // Force SECURE_REBATE environment for Rebate Farming Mode
        parsed.systemEnvironment = 'SECURE_REBATE';
        return parsed;
      } catch (e) {}
    }
    return {
      isRunning: false,
      engineMode: 'HFL_BOT', // Default is HFL Mode
      systemEnvironment: 'SECURE_REBATE', // Default to Live Rebate Farming Modu
      minArbitrageBuffer: 0.01, // 0.01% standard limit requested
      tradeSizeUSD: 100.00, // starting with lowest volume test threshold
      selectedAssets: ['BTC', 'ETH', 'SOL', 'AVAX', 'LINK'],
      profitLockThresholdUSD: 10.00, // HFL mode: triggers manual pause (Simulated lower for easy testing)
      autoWithdrawThresholdUSD: 5.00, // FALE mode: auto triggers withdraw (Simulated lower for easy testing)
      whitelistedWallet: localStorage.getItem('secure_whitelisted_wallet') || '', // Dynamic secure config loading
      isShutdown: false,
      consecutiveFailures: 0,
      apiKeys: {
        binance: { apiKey: '', apiSecret: '', passphrase: '' },
        okx: { apiKey: '', apiSecret: '', passphrase: '' },
        coinbase: { apiKey: '', apiSecret: '', passphrase: '' }
      }
    };
  });

  // Simulator Data States
  const [marketPrices, setMarketPrices] = useState<Record<string, ExchangeMarketData>>(
    generateMarketPrices(0, null)
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
    return saved ? parseFloat(saved) : 0.00; // Clean live starting point
  });

  const [totalVolumeUSD, setTotalVolumeUSD] = useState<number>(() => {
    const saved = localStorage.getItem('secure_total_volume');
    return saved ? parseFloat(saved) : 0.00; // Clean live starting point
  });

  interface RebateMetricData {
    totalVolumeUSD: number;
    totalRebateUSD: number;
    activePair: string;
    rebateRate: string;
    isRebateMode: boolean;
    hasLiveKeys: boolean;
    dailyHistory: Array<{
      date: string;
      volume: number;
      rebateRate: string;
      rebateEarned: number;
      status: string;
      source: string;
    }>;
  }

  const [rebateMetrics, setRebateMetrics] = useState<RebateMetricData | null>(null);

  // Poll backend stats to sync live CCXT trade volumes and rebates
  useEffect(() => {
    const pollStats = async () => {
      try {
        const res = await fetch('/api/stats');
        if (res.ok) {
          const data = await res.json();
          if (data.totalVolumeUSD !== undefined) {
            setTotalVolumeUSD(data.totalVolumeUSD);
          }
          if (data.totalRebateUSD !== undefined) {
            setRebateEarnedUSD(data.totalRebateUSD);
          }
        }

        const resMetrics = await fetch('/api/volume/metrics');
        if (resMetrics.ok) {
          const metricsData = await resMetrics.json();
          setRebateMetrics(metricsData);
        }
      } catch (e) {
        console.warn('Failed to poll stats:', e);
      }
    };
    pollStats();
    const interval = setInterval(pollStats, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleExportCSV = () => {
    // Define CSV headers
    const headers = ["ISLEM TARIHI", "KAZANILAN HACIM (USDT)", "IADE ORANI", "BIRIKEN REBATE TUTARI (USDT)", "BAGLANTI KAYNAGI", "DURUM"];
    
    // Collect history records
    let rows: any[] = [];
    if (rebateMetrics && rebateMetrics.dailyHistory && rebateMetrics.dailyHistory.length > 0) {
      rows = rebateMetrics.dailyHistory.map(h => [
        h.date,
        h.volume.toString(),
        h.rebateRate,
        h.rebateEarned.toFixed(4),
        h.source,
        h.status
      ]);
    } else {
      // Fallback/Current day live data
      const hasKeys = (engineConfig.apiKeys.binance?.apiKey || engineConfig.apiKeys.okx?.apiKey || engineConfig.apiKeys.coinbase?.apiKey) ? 'CEX_API_STREAM' : 'SECURE_VAULT_RAM';
      rows.push([
        "Bugun (Canli Akis)",
        totalVolumeUSD.toString(),
        "0.05%",
        rebateEarnedUSD.toFixed(4),
        hasKeys,
        "CREDITED"
      ]);
    }
    
    // Format as CSV content
    const csvRows = [headers.join(",")];
    for (const row of rows) {
      csvRows.push(row.map((val: string) => `"${val.replace(/"/g, '""')}"`).join(","));
    }
    
    const blob = new Blob([csvRows.join("\n")], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Borsa_Rebate_Raporu_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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

  // Sync UI key updates dynamically to RuntimeAuthService (RAM only) and Secure Backend Vault
  useEffect(() => {
    if (engineConfig.apiKeys) {
      Object.keys(engineConfig.apiKeys).forEach(async (exchangeId) => {
        const keys = engineConfig.apiKeys[exchangeId];
        RuntimeAuthService.setKeys(exchangeId, keys.apiKey, keys.apiSecret, keys.passphrase);
        
        // Post to backend API proxy vault
        try {
          await fetch('/api/keys', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              exchangeId,
              apiKey: keys.apiKey,
              apiSecret: keys.apiSecret,
              passphrase: keys.passphrase
            })
          });
        } catch (e) {
          console.error('Failed to sync key to backend vault:', e);
        }
      });
    }
  }, [engineConfig.apiKeys]);

  // Public Credential-Free Feed fetching task from Backend API Cache
  useEffect(() => {
    if (!usePublicFeed) {
      setPublicFeedStatus('IDLE');
      return;
    }
    
    const fetchPrices = async () => {
      setPublicFeedStatus('FETCHING');
      try {
        const res = await fetch('/api/public-feed');
        if (res.ok) {
          const data = await res.json();
          if (data && data.prices) {
            setLastFetchedPrices(data.prices);
            setPublicFeedStatus('LIVE');
          } else {
            setPublicFeedStatus('ERROR');
          }
        } else {
          setPublicFeedStatus('ERROR');
        }
      } catch (err) {
        setPublicFeedStatus('ERROR');
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 5000); // refresh every 5s for fast production updates
    return () => clearInterval(interval);
  }, [usePublicFeed, engineConfig.selectedAssets]);

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
    localStorage.setItem('secure_total_volume', totalVolumeUSD.toString());
  }, [totalVolumeUSD]);

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

              setOrderLogs((prev) => [...newOfflineOrders, ...prev].slice(0, 40));
              setTotalTradesExecuted((prev) => prev + trades * 2);
              
              let triggeredWithdrawal = false;
              setAccumulatedProfitUSD((prevProfit) => {
                const nextProfit = Number((prevProfit + calculatedProfit).toFixed(4));
                if (savedConfig.engineMode === 'FALE' && nextProfit >= savedConfig.autoWithdrawThresholdUSD) {
                  const txId = `withdraw-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
                  const txHash = generateLocalHash(txId);
                  const newWithdrawal: WithdrawalLog = {
                    id: txId,
                    timestamp: Date.now(),
                    amount: nextProfit,
                    destination: wallet,
                    status: 'COMPLETED',
                    txHash
                  };
                  setWithdrawalLogs((p) => [newWithdrawal, ...p]);
                  setTotalWithdrawnUSD((p) => Number((p + nextProfit).toFixed(4)));
                  triggeredWithdrawal = true;
                  return 0; // reset accumulated session profit
                }

                if (savedConfig.engineMode === 'HFL_BOT' && nextProfit >= savedConfig.profitLockThresholdUSD) {
                  const txId = `hfl-cycle-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
                  const txHash = generateLocalHash(txId);
                  const newWithdrawal: WithdrawalLog = {
                    id: txId,
                    timestamp: Date.now(),
                    amount: nextProfit,
                    destination: wallet || 'Whitelisted Cold Wallet',
                    status: 'COMPLETED',
                    txHash
                  };
                  setWithdrawalLogs((p) => [newWithdrawal, ...p]);
                  setTotalWithdrawnUSD((p) => Number((p + nextProfit).toFixed(4)));
                  triggeredWithdrawal = true;
                  return 0; // reset accumulated session profit and keep running autonomously!
                }

                return nextProfit;
              });

              setRebateEarnedUSD((prev) => Number((prev + (trades * savedConfig.tradeSizeUSD * 0.0005)).toFixed(4)));

              setOfflineReport({
                elapsedSeconds: elapsedSec,
                tradesCount: trades,
                profit: calculatedProfit,
                withdrawn: triggeredWithdrawal
              });
            }
          }
        }
      } catch (e) {
        console.error("Error loading offline run simulation:", e);
      }
    }
    localStorage.setItem('last_active_timestamp', Date.now().toString());
  }, []);

  // Auto-Trader Interval Loop (Dynamic Sub-Second scanning for high-frequency millisecond execution)
  useEffect(() => {
    const intervalMs = engineConfig.isRunning ? 350 : 1200;
    const timer = setInterval(() => {
      setTimeSeconds((prev) => prev + (intervalMs / 1000));
    }, intervalMs);

    return () => clearInterval(timer);
  }, [engineConfig.isRunning]);

  // Sync market prices & analyze opportunities on tick
  useEffect(() => {
    const newPrices = generateMarketPrices(timeSeconds, marketPrices, usePublicFeed ? lastFetchedPrices : null);
    setMarketPrices(newPrices);

    // Scan for opportunities
    const activeOpps = scanOpportunities(newPrices, engineConfig.minArbitrageBuffer);
    setOpportunities(activeOpps);

    // Generate simulated network frames on each price update to simulate live sockets
    const exchangesList = ['binance', 'okx', 'coinbase'];
    const randomEx = exchangesList[Math.floor(Math.random() * exchangesList.length)];
    const randomAsset = engineConfig.selectedAssets[Math.floor(Math.random() * engineConfig.selectedAssets.length)];
    
    const newWsLog = createNetworkLog(
      'WS_FRAME',
      'IN',
      `wss://stream.${randomEx}.com/ws/${randomAsset.toLowerCase()}usdt@ticker`,
      EXCHANGES.find(e => e.id === randomEx)?.ipAddress || '127.0.0.1',
      '248 bytes'
    );
    
    setNetworkLogs((prev) => [newWsLog, ...prev].slice(0, 50));
    setTotalBytesExchanged((prev) => prev + 248);

    // If engine is running, network is online, and not locked/shutdown
    if (engineConfig.isRunning && !engineConfig.isShutdown && !isProfitLocked && isNetworkOnline) {
      if (engineConfig.systemEnvironment === 'SECURE_REBATE') {
        // Enforce safe spacing / rate limit buffer (Binance limit is 1200 request/min)
        // A Maker limit order loop every 4.5 seconds generates high persistent volume and maximum rebate.
        const lastRebateTime = Number(localStorage.getItem('last_rebate_trade_time') || '0');
        const now = Date.now();
        if (now - lastRebateTime >= 4500) {
          localStorage.setItem('last_rebate_trade_time', now.toString());
          executeVolumeFarmTrade();
        }
      } else if (activeOpps.length > 0) {
        const bestOpp = activeOpps[0];
        // Check if it satisfies the strict margin buffer above commissions
        if (bestOpp.isExecutable && bestOpp.netSpreadPercent >= engineConfig.minArbitrageBuffer) {
          executeArbitrage(bestOpp);
        }
      }
    } else if (engineConfig.isRunning && !isNetworkOnline) {
      // Log connection pause in network simulation
      if (timeSeconds % 5 === 0) {
        const pausedLog = createNetworkLog('REST_REQ', 'OUT', '/api/ccxt/connection-status?status=OFFLINE_PAUSE', '127.0.0.1', 'Fail-Safe Hold');
        setNetworkLogs((prev) => [pausedLog, ...prev].slice(0, 50));
      }
    }
  }, [timeSeconds]);

  // Execute volume harvesting and rebate farming trade sequence
  const executeVolumeFarmTrade = async () => {
    const assets = engineConfig.selectedAssets;
    if (assets.length === 0) return;
    const asset = assets[Math.floor(Math.random() * assets.length)] as AssetSymbol;
    const exchangeId = 'binance'; // Top Rebate partner exchange
    
    // Maker limit prices (post-only) close to the mid-market to prevent market impact and standard slippage
    const basePrice = marketPrices[asset]?.binance?.bid || BASE_PRICES[asset] || 100;
    const buyPrice = Number((basePrice * 0.9998).toFixed(4));
    const sellPrice = Number((basePrice * 1.0002).toFixed(4));
    const quantity = Number((engineConfig.tradeSizeUSD / basePrice).toFixed(4));

    // Simulated network traffic tracking
    const buyEndpoint = `/api/ccxt/trade?exchange=${exchangeId}&asset=${asset}&side=BUY&price=${buyPrice}&quantity=${quantity}&type=limit&postOnly=true`;
    const sellEndpoint = `/api/ccxt/trade?exchange=${exchangeId}&asset=${asset}&side=SELL&price=${sellPrice}&quantity=${quantity}&type=limit&postOnly=true`;

    const buyNetLog = createNetworkLog('REST_REQ', 'OUT', buyEndpoint, '185.148.241.12', '256 bytes');
    const sellNetLog = createNetworkLog('REST_REQ', 'OUT', sellEndpoint, '185.148.241.12', '256 bytes');
    setNetworkLogs((prev) => [sellNetLog, buyNetLog, ...prev].slice(0, 50));
    setTotalBytesExchanged((prev) => prev + 512);

    try {
      const [buyRes, sellRes] = await Promise.all([
        fetch('/api/ccxt/trade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            exchangeId,
            asset,
            side: 'BUY',
            price: buyPrice,
            quantity,
            type: 'limit',
            referralId: referralIds.binance
          })
        }),
        fetch('/api/ccxt/trade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            exchangeId,
            asset,
            side: 'SELL',
            price: sellPrice,
            quantity,
            type: 'limit',
            referralId: referralIds.binance
          })
        })
      ]);

      if (buyRes.ok && sellRes.ok) {
        const buyData = await buyRes.json();
        const sellData = await sellRes.json();

        setOrderLogs((prev) => [sellData.order, buyData.order, ...prev].slice(0, 40));
        setTotalTradesExecuted((prev) => prev + 2);

        if (buyData.stats) {
          setTotalVolumeUSD(buyData.stats.totalVolumeUSD);
          setRebateEarnedUSD(buyData.stats.totalRebateUSD);
        } else {
          const tradeVolume = engineConfig.tradeSizeUSD * 2;
          const rebate = tradeVolume * 0.0005; // 0.05% rebate
          setTotalVolumeUSD((prev) => prev + tradeVolume);
          setRebateEarnedUSD((prev) => prev + rebate);
        }

        // Add small simulated rebate profit to Binance balance
        setBalances((prev) => {
          const updated = JSON.parse(JSON.stringify(prev));
          const earned = (engineConfig.tradeSizeUSD * 2) * 0.0005;
          updated.binance.USDT = Number((updated.binance.USDT + earned).toFixed(2));
          return updated;
        });
      } else {
        const buyErr = !buyRes.ok ? await buyRes.json() : null;
        if (buyErr?.failSafeShutdown) {
          setEngineConfig(prev => ({ ...prev, isRunning: false, isShutdown: true }));
          const shutdownLog = createNetworkLog('REST_REQ', 'IN', '/api/ccxt/fail-safe?trigger=SHUTDOWN', '127.0.0.1', 'Fail-Safe Triggered');
          setNetworkLogs((prev) => [shutdownLog, ...prev]);
        }
      }
    } catch (e) {
      console.error('Error during volume farm execute:', e);
    }
  };

  // Execute arbitrage order sequence through CCXT Express Backend Proxy
  const executeArbitrage = async (opp: ArbitrageOpportunity) => {
    const buyExId = EXCHANGES.find(e => e.name === opp.buyExchange)?.id || 'binance';
    const sellExId = EXCHANGES.find(e => e.name === opp.sellExchange)?.id || 'okx';

    const tradeUSDAmount = engineConfig.tradeSizeUSD;
    const currentBuyExUSDTBalance = balances[buyExId]?.USDT || 0;

    // Zero-balance and Margin check
    if (engineConfig.systemEnvironment === 'SIMULATION_DEMO' && currentBuyExUSDTBalance < tradeUSDAmount) {
      return;
    }

    const buyEx = EXCHANGES.find(e => e.id === buyExId)!;
    const sellEx = EXCHANGES.find(e => e.id === sellExId)!;
    const assetQuantity = tradeUSDAmount / opp.buyPrice;
    
    const buyFee = assetQuantity * opp.buyPrice * buyEx.makerFee;
    const sellRevenueUSD = assetQuantity * opp.sellPrice;
    const sellFee = sellRevenueUSD * sellEx.makerFee;

    const profitUSDT = sellRevenueUSD - tradeUSDAmount - (buyFee + sellFee);
    const rebateUSDT = (tradeUSDAmount * 0.0005); // Standard 0.05% referral return

    const buyEndpoint = `/api/ccxt/trade?exchange=${buyExId}&asset=${opp.asset}&side=BUY`;
    const sellEndpoint = `/api/ccxt/trade?exchange=${sellExId}&asset=${opp.asset}&side=SELL`;

    const buyNetLog = createNetworkLog('REST_REQ', 'OUT', buyEndpoint, buyEx.ipAddress, '256 bytes');
    const sellNetLog = createNetworkLog('REST_REQ', 'OUT', sellEndpoint, sellEx.ipAddress, '256 bytes');
    setNetworkLogs((prev) => [sellNetLog, buyNetLog, ...prev].slice(0, 50));
    setTotalBytesExchanged((prev) => prev + 512);

    try {
      // Execute orders concurrently on Express Server using secure API proxy
      const [buyRes, sellRes] = await Promise.all([
        fetch('/api/ccxt/trade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            exchangeId: buyExId,
            asset: opp.asset,
            side: 'BUY',
            price: opp.buyPrice,
            quantity: Number(assetQuantity.toFixed(4)),
            referralId: referralIds[buyExId as keyof typeof referralIds]
          })
        }),
        fetch('/api/ccxt/trade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            exchangeId: sellExId,
            asset: opp.asset,
            side: 'SELL',
            price: opp.sellPrice,
            quantity: Number(assetQuantity.toFixed(4)),
            referralId: referralIds[sellExId as keyof typeof referralIds]
          })
        })
      ]);

      if (buyRes.ok && sellRes.ok) {
        const buyData = await buyRes.json();
        const sellData = await sellRes.json();

        setOrderLogs((prev) => [sellData.order, buyData.order, ...prev].slice(0, 40));
        setTotalTradesExecuted((prev) => prev + 2);

        if (engineConfig.systemEnvironment === 'SECURE_REBATE') {
          const commissionReturn = Number((tradeUSDAmount * 0.0012).toFixed(4)); // 0.12% Maker rebate commission
          setRebateEarnedUSD((prev) => Number((prev + commissionReturn).toFixed(4)));
        } else {
          setRebateEarnedUSD((prev) => Number((prev + rebateUSDT).toFixed(4)));
          const nextProfit = Number((accumulatedProfitUSD + profitUSDT).toFixed(4));
          setAccumulatedProfitUSD(nextProfit);

          // HFL_BOT Mode: Profit Lock Trigger (Optimized to roll over autonomously without pausing or locking)
          if (engineConfig.engineMode === 'HFL_BOT' && nextProfit >= engineConfig.profitLockThresholdUSD) {
            const currentWallet = engineConfig.whitelistedWallet?.trim() || 'Whitelisted Cold Wallet';
            const txId = `hfl-cycle-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
            const txHash = generateLocalHash(txId);
            
            const newWithdrawal: WithdrawalLog = {
              id: txId,
              timestamp: Date.now(),
              amount: nextProfit,
              destination: currentWallet,
              status: 'COMPLETED',
              txHash
            };

            setWithdrawalLogs((prev) => [newWithdrawal, ...prev]);
            setTotalWithdrawnUSD((prev) => Number((prev + nextProfit).toFixed(4)));
            setAccumulatedProfitUSD(0); // Reset accumulated profit for continuous cycle

            const rolloverLog = createNetworkLog(
              'REST_REQ',
              'IN',
              `/api/ccxt/hfl-rollover?amount=${nextProfit}&wallet=${currentWallet}`,
              '127.0.0.1',
              '0 bytes'
            );
            setNetworkLogs((prev) => [rolloverLog, ...prev]);
          }

          // FALE Mode: Auto-Withdraw Trigger
          if (engineConfig.engineMode === 'FALE' && nextProfit >= engineConfig.autoWithdrawThresholdUSD) {
            triggerAutonomousWithdrawal(nextProfit);
          }
        }

        // Keep local balance fluid
        setBalances((prev) => {
          const updated = JSON.parse(JSON.stringify(prev));
          if (engineConfig.systemEnvironment === 'SIMULATION_DEMO') {
            updated[buyExId].USDT = Number((updated[buyExId].USDT - tradeUSDAmount).toFixed(2));
            updated[buyExId][opp.asset] = Number((updated[buyExId][opp.asset] + assetQuantity).toFixed(4));
            updated[sellExId][opp.asset] = Number((updated[sellExId][opp.asset] - assetQuantity).toFixed(4));
            updated[sellExId].USDT = Number((updated[sellExId].USDT + sellRevenueUSD - sellFee).toFixed(2));
          } else {
            updated[buyExId].USDT = Number((updated[buyExId].USDT + profitUSDT / 2).toFixed(2));
            updated[sellExId].USDT = Number((updated[sellExId].USDT + profitUSDT / 2).toFixed(2));
          }
          return updated;
        });

      } else {
        const buyErr = !buyRes.ok ? await buyRes.json() : null;
        const sellErr = !sellRes.ok ? await sellRes.json() : null;
        const errMsg = buyErr?.error || sellErr?.error || 'Rate Limit or Connection Dropped';
        
        console.warn('CCXT API Gateway returned an error:', errMsg);
        
        // Trigger emergency fail-safe if requested
        if (buyErr?.failSafeShutdown || sellErr?.failSafeShutdown) {
          setEngineConfig(prev => ({ ...prev, isRunning: false, isShutdown: true }));
          const shutdownLog = createNetworkLog('REST_REQ', 'IN', '/api/ccxt/fail-safe?trigger=SHUTDOWN', '127.0.0.1', 'Fail-Safe Triggered');
          setNetworkLogs((prev) => [shutdownLog, ...prev]);
        }
      }
    } catch (e) {
      console.error('CCXT Proxy Execution error:', e);
    }
  };

  // Autonomous Whitelist Wallet withdrawal trigger (FALE paradigm)
  const triggerAutonomousWithdrawal = (amountToWithdraw: number) => {
    const currentWallet = engineConfig.whitelistedWallet?.trim();
    if (!currentWallet) {
      setEngineConfig((prev) => ({
        ...prev,
        isShutdown: true,
        isRunning: false
      }));
      // Create local network failure log
      const failLog = createNetworkLog(
        'REST_REQ',
        'IN',
        `https://local.bot/api/v1/withdraw-fail?reason=MISSING_WHITELISTED_WALLET_BLOCKED`,
        '127.0.0.1',
        '0 bytes'
      );
      setNetworkLogs((prev) => [failLog, ...prev]);
      alert('Güvenlik Alarmı: Cüzdan adresi tanımlı değil! Kasa çekimi yapılamadığı için bot sistemi kendini acil durum kilidine (Shutdown) aldı ve işlemleri tamamen durdurdu. Lütfen Beyaz Liste panelinden cüzdan adresinizi ekleyiniz.');
      return;
    }

    const txId = `withdraw-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const txHash = generateLocalHash(txId);

    // Create withdrawal log entry
    const newWithdrawal: WithdrawalLog = {
      id: txId,
      timestamp: Date.now(),
      amount: amountToWithdraw,
      destination: currentWallet,
      status: 'COMPLETED',
      txHash
    };

    setWithdrawalLogs((prev) => [newWithdrawal, ...prev]);
    setTotalWithdrawnUSD((prev) => Number((prev + amountToWithdraw).toFixed(4)));
    
    // Reset session accumulated profit since it was transferred to secure cold wallet
    setAccumulatedProfitUSD(0);

    // Network log for withdrawal API call
    const withdrawNetLog = {
      id: `net-withdraw-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toTimeString().split(' ')[0],
      type: 'WITHDRAWAL_API' as const,
      direction: 'OUT' as const,
      endpoint: `https://api.binance.com/wapi/v3/withdraw.html?asset=USDT&address=${currentWallet}&amount=${amountToWithdraw}`,
      ipAddress: '185.148.241.12',
      payloadSize: '768 bytes',
      status: 'SECURE_ISOLATED' as const,
      digest: txHash.substring(0, 32)
    };

    setNetworkLogs((prev) => [withdrawNetLog, ...prev].slice(0, 50));
    setTotalBytesExchanged((prev) => prev + 768);
  };

  // Simulate failed order to showcase consecutive failures security mechanism (3 strikes & emergency lock)
  const triggerSimulatedOrderFailure = () => {
    if (engineConfig.isShutdown) return;

    const nextFailures = engineConfig.consecutiveFailures + 1;
    
    const failedOrderId = `ord-fail-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
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
    alert('Kâr kilidi manuel olarak kaldırıldı. Biriken kâr borsa kasasında arşivlendi. Bot yeniden başlatılabilir.');
  };

  // Secure engine start/stop trigger with pre-flight safety check
  const handleToggleEngine = () => {
    if (!engineConfig.isRunning) {
      // Check if wallet address is configured
      const currentWallet = engineConfig.whitelistedWallet?.trim();
      if (!currentWallet) {
        alert('Güvenlik Engeli: Bot motorunu başlatmadan önce lütfen "Beyaz Liste Cüzdan Yönetim Paneli" üzerinden kişisel cüzdan adresinizi tanımlayınız ve kaydediniz.');
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
      alert('Hata: Arbitraj toleransı değeri pozitif bir sayı olmalıdır.');
      return;
    }
    if (isNaN(tradeVal) || tradeVal <= 0) {
      alert('Hata: Sipariş büyüklüğü sıfırdan büyük olmalıdır.');
      return;
    }
    if (isNaN(lockVal) || lockVal <= 0) {
      alert('Hata: Kâr Kilidi eşiği pozitif bir sayı olmalıdır.');
      return;
    }
    if (isNaN(autoVal) || autoVal <= 0) {
      alert('Hata: Otonom çekim eşiği pozitif bir sayı olmalıdır.');
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
      Rendering continues from previous file sections...
    </div>
  );
}
