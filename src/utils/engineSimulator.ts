import { AssetSymbol, ExchangeConfig, ExchangeMarketData, ArbitrageOpportunity, OrderLog, NetworkConnectionLog, ExchangeBalances } from '../types';

// Supported CEX exchanges configuration
export const EXCHANGES: ExchangeConfig[] = [
  {
    id: 'binance',
    name: 'Binance',
    icon: 'B',
    latencyMin: 320, // microseconds
    latencyMax: 710,
    makerFee: 0.00075, // 0.075% (BNB discount rate standard)
    takerFee: 0.00075,
    ipAddress: '185.148.241.12'
  },
  {
    id: 'okx',
    name: 'OKX',
    icon: 'O',
    latencyMin: 450,
    latencyMax: 890,
    makerFee: 0.0008, // 0.08%
    takerFee: 0.0008,
    ipAddress: '192.229.211.55'
  },
  {
    id: 'coinbase',
    name: 'Coinbase Pro',
    icon: 'C',
    latencyMin: 210,
    latencyMax: 540,
    makerFee: 0.0010, // 0.10%
    takerFee: 0.0010,
    ipAddress: '104.18.23.40'
  }
];

// Base prices for assets in USD
export const BASE_PRICES: Record<AssetSymbol, number> = {
  BTC: 89450.00,
  ETH: 3420.50,
  SOL: 185.40,
  AVAX: 34.15,
  LINK: 19.85
};

// Simple pseudo SHA-256 visual checksum generator to mimic local binary verification without libraries
export function generateLocalHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  const hex = Math.abs(hash).toString(16).padEnd(8, '0');
  return `0x${hex.substring(0, 8)}cf83692a${hex.substring(4, 8)}d8ae35a146e5b0ec8f4fe4a`;
}

// Generate organic market prices with independent Brownian fluctuation per exchange
export function generateMarketPrices(
  timeSeconds: number,
  prevData: Record<string, ExchangeMarketData> | null
): Record<string, ExchangeMarketData> {
  const data: Record<string, ExchangeMarketData> = {};

  EXCHANGES.forEach((exchange) => {
    data[exchange.id] = {};

    (Object.keys(BASE_PRICES) as AssetSymbol[]).forEach((asset) => {
      const base = BASE_PRICES[asset];
      
      // Use different frequencies and amplitudes per exchange to create organic deviations
      const seed = exchange.id === 'binance' ? 1.0 : exchange.id === 'okx' ? 1.4 : 1.9;
      
      // Brownian micro-motion using native math (sine waves combined with random walk)
      const drift = Math.sin(timeSeconds * 0.15 * seed) * 0.0012; // slow wave
      const microDrift = Math.cos(timeSeconds * 1.8 * seed) * 0.0007; // fast wave
      
      // Individual random noise
      const randomNoise = (Math.random() - 0.5) * 0.0004;
      
      // Cumulative multiplier
      let deviation = 1 + drift + microDrift + randomNoise;
      
      // Maintain some continuity if previous data exists
      if (prevData && prevData[exchange.id] && prevData[exchange.id][asset]) {
        const prevPrice = prevData[exchange.id][asset].lastPrice;
        const targetPrice = base * deviation;
        // Dampen the change to create smooth, non-flickering visual flow
        const updatedPrice = prevPrice + (targetPrice - prevPrice) * 0.15;
        deviation = updatedPrice / base;
      }

      const lastPrice = base * deviation;
      
      // Calculate realistic bid/ask spreads (0.015% to 0.035%)
      const spreadMultiplier = 0.00025 + (Math.random() * 0.0001);
      const bid = lastPrice * (1 - spreadMultiplier);
      const ask = lastPrice * (1 + spreadMultiplier);
      
      // Volume simulation
      const volume24h = base * (50000 + seed * 20000 + Math.sin(timeSeconds * 0.01) * 10000);

      data[exchange.id][asset] = {
        bid: Number(bid.toFixed(4)),
        ask: Number(ask.toFixed(4)),
        lastPrice: Number(lastPrice.toFixed(4)),
        volume24h: Math.round(volume24h)
      };
    });
  });

  return data;
}

// Scans exchanges for active Arbitrage/Entropy opportunities
export function scanOpportunities(
  marketData: Record<string, ExchangeMarketData>,
  minBuffer: number // e.g. 0.01%
): ArbitrageOpportunity[] {
  const opportunities: ArbitrageOpportunity[] = [];
  const assets = Object.keys(BASE_PRICES) as AssetSymbol[];

  assets.forEach((asset) => {
    // Check all combinations of buying on exchange A and selling on exchange B
    for (let i = 0; i < EXCHANGES.length; i++) {
      for (let j = 0; j < EXCHANGES.length; j++) {
        if (i === j) continue;

        const buyEx = EXCHANGES[i];
        const sellEx = EXCHANGES[j];

        const buyPrice = marketData[buyEx.id]?.[asset]?.ask; // buying from the ask (seller's price)
        const sellPrice = marketData[sellEx.id]?.[asset]?.bid; // selling to the bid (buyer's price)

        if (!buyPrice || !sellPrice) continue;

        // Spread calculations
        const grossSpreadPercent = ((sellPrice - buyPrice) / buyPrice) * 100;
        const totalCommissionsPercent = (buyEx.takerFee + sellEx.takerFee) * 100;
        const netSpreadPercent = grossSpreadPercent - totalCommissionsPercent;

        // An arbitrage is executable if the netSpread exceeds 0.01% as per rules
        const isExecutable = netSpreadPercent >= minBuffer;

        // Simulated entropy (microstate thermodynamic variance parameter)
        const entropyValue = Number((grossSpreadPercent * 1.618 - Math.log(buyEx.latencyMin + sellEx.latencyMin) * 0.05).toFixed(4));

        if (grossSpreadPercent > 0.001) { // Only log positive gross anomalies
          opportunities.push({
            id: `opp-${asset}-${buyEx.id}-${sellEx.id}-${Date.now().toString().slice(-4)}`,
            timestamp: Date.now(),
            asset,
            buyExchange: buyEx.name,
            sellExchange: sellEx.name,
            buyPrice,
            sellPrice,
            grossSpreadPercent: Number(grossSpreadPercent.toFixed(4)),
            totalCommissionsPercent: Number(totalCommissionsPercent.toFixed(4)),
            netSpreadPercent: Number(netSpreadPercent.toFixed(4)),
            isExecutable,
            entropyValue
          });
        }
      }
    }
  });

  // Sort by highest net spread opportunity
  return opportunities.sort((a, b) => b.netSpreadPercent - a.netSpreadPercent);
}

// Generate an isolated network log
export function createNetworkLog(
  type: 'REST_REQ' | 'WS_FRAME' | 'DNS_LOOKUP',
  direction: 'OUT' | 'IN',
  endpoint: string,
  ipAddress: string,
  payloadSize: string
): NetworkConnectionLog {
  const now = new Date();
  const timeStr = `${now.toTimeString().split(' ')[0]}.${String(now.getMilliseconds()).padStart(3, '0')}`;
  const inputToHash = `${timeStr}-${endpoint}-${payloadSize}`;
  
  return {
    id: `net-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: timeStr,
    type,
    direction,
    endpoint,
    ipAddress,
    payloadSize,
    status: 'SECURE_ISOLATED',
    digest: generateLocalHash(inputToHash).substring(0, 32)
  };
}

// Initialize clean starting mock balances
export const INITIAL_BALANCES: ExchangeBalances = {
  binance: {
    USDT: 50000.00,
    BTC: 0.25,
    ETH: 3.5,
    SOL: 45.0,
    AVAX: 120.0,
    LINK: 250.0
  },
  okx: {
    USDT: 50000.00,
    BTC: 0.25,
    ETH: 3.5,
    SOL: 45.0,
    AVAX: 120.0,
    LINK: 250.0
  },
  coinbase: {
    USDT: 50000.00,
    BTC: 0.25,
    ETH: 3.5,
    SOL: 45.0,
    AVAX: 120.0,
    LINK: 250.0
  }
};
