export type AssetSymbol = 'BTC' | 'ETH' | 'SOL' | 'AVAX' | 'LINK';

export type EngineMode = 'HFL_BOT' | 'FALE';

export interface ExchangeConfig {
  id: string;
  name: string;
  icon: string;
  latencyMin: number; // in microseconds (μs)
  latencyMax: number; // in microseconds (μs)
  makerFee: number; // e.g., 0.001 (0.1%)
  takerFee: number; // e.g., 0.001 (0.1%)
  ipAddress: string;
}

export interface MarketPrice {
  bid: number;
  ask: number;
  lastPrice: number;
  volume24h: number;
}

export interface ExchangeMarketData {
  [asset: string]: MarketPrice;
}

export interface ArbitrageOpportunity {
  id: string;
  timestamp: number;
  asset: AssetSymbol;
  buyExchange: string;
  sellExchange: string;
  buyPrice: number;
  sellPrice: number;
  grossSpreadPercent: number; // gross difference
  totalCommissionsPercent: number; // total maker + taker fees
  netSpreadPercent: number; // gross - commissions
  isExecutable: boolean; // netSpreadPercent > 0.01%
  entropyValue: number; // simulated thermodynamic microstate entropy
}

export interface OrderLog {
  id: string;
  timestamp: number;
  asset: AssetSymbol;
  type: 'BUY' | 'SELL';
  exchange: string;
  price: number;
  quantity: number;
  fee: number;
  feeAsset: string;
  latencyUs: number; // Order execution speed in microseconds
  status: 'COMPLETED' | 'PENDING' | 'REJECTED';
  txHash: string; // Since it's a CEX, internal order execution receipt (SHA-256 local hash)
}

export interface NetworkConnectionLog {
  id: string;
  timestamp: string; // e.g. "14:32:01.045"
  type: 'REST_REQ' | 'WS_FRAME' | 'DNS_LOOKUP' | 'WITHDRAWAL_API';
  direction: 'OUT' | 'IN';
  endpoint: string;
  ipAddress: string;
  payloadSize: string;
  status: 'SECURE_ISOLATED' | 'BLOCKED';
  digest: string; // SHA-256 fingerprint proving clean content
}

export interface AssetBalance {
  [assetSymbol: string]: number;
}

export interface ExchangeBalances {
  [exchangeId: string]: AssetBalance;
}

export interface WithdrawalLog {
  id: string;
  timestamp: number;
  amount: number;
  destination: string;
  status: 'COMPLETED' | 'REJECTED' | 'LOCKED';
  txHash: string;
}

export interface EngineConfig {
  isRunning: boolean;
  engineMode: EngineMode;
  minArbitrageBuffer: number; // The threshold margin above commission (default 0.01%)
  tradeSizeUSD: number; // Amount per trade in virtual USD
  selectedAssets: AssetSymbol[];
  profitLockThresholdUSD: number; // HFL mode: triggers manual pause
  autoWithdrawThresholdUSD: number; // FALE mode: auto triggers withdraw
  whitelistedWallet: string; // Hardcoded static wallet address
  isShutdown: boolean; // Emergency shutdown trigger
  consecutiveFailures: number; // Track continuous order issues
  apiKeys: {
    [exchangeId: string]: {
      apiKey: string;
      apiSecret: string;
      passphrase?: string;
    };
  };
}
