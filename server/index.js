import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import ccxt from 'ccxt';
import VolumeFarmingStrategy from './strategies/volumeFarming.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Binance exchange with read-only keys
const binance = new ccxt.binance({
  apiKey: process.env.BINANCE_API_KEY || '',
  secret: process.env.BINANCE_API_SECRET || '',
  enableRateLimit: true,
  rateLimit: 1200, // 1200ms between requests to respect rate limits
});

// Initialize Volume Farming Strategy
const volumeStrategy = new VolumeFarmingStrategy(binance, {
  symbol: 'BTC/USDT',
  orderSize: 0.01,
  dailyVolumeTarget: 10000, // $10k USD
  spreadBps: 5 // 5 basis points from mid-price
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running' });
});

// Get live market data from Binance
app.get('/api/market/prices', async (req, res) => {
  try {
    const symbols = req.query.symbols?.split(',') || ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'AVAX/USDT', 'LINK/USDT'];
    
    console.log(`[API] Fetching ${symbols.length} symbols from Binance...`);
    
    const tickers = await binance.fetch_tickers(symbols);
    
    // Extract relevant data
    const prices = {};
    for (const symbol of symbols) {
      const ticker = tickers[symbol];
      if (ticker) {
        prices[symbol] = {
          bid: ticker.bid,
          ask: ticker.ask,
          last: ticker.last,
          volume: ticker.quoteVolume,
          timestamp: ticker.timestamp
        };
      }
    }
    
    console.log(`[API] ✓ Fetched ${Object.keys(prices).length} prices`);
    res.json({ success: true, data: prices, timestamp: Date.now() });
  } catch (error) {
    console.error('[API] Error fetching prices:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get order book for a symbol
app.get('/api/orderbook/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const depth = req.query.limit || 20;
    
    console.log(`[API] Fetching orderbook for ${symbol} (depth: ${depth})`);
    
    const orderbook = await binance.fetch_order_book(symbol, depth);
    
    res.json({
      success: true,
      symbol,
      bids: orderbook.bids.slice(0, 5),
      asks: orderbook.asks.slice(0, 5),
      timestamp: orderbook.timestamp
    });
  } catch (error) {
    console.error('[API] Orderbook error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get account balance (READ-ONLY)
app.get('/api/balance', async (req, res) => {
  try {
    console.log('[API] Fetching account balance...');
    
    const balance = await binance.fetch_balance();
    
    // Only return relevant balances
    const filtered = {};
    ['USDT', 'BTC', 'ETH', 'SOL', 'AVAX', 'LINK'].forEach(coin => {
      if (balance[coin]) {
        filtered[coin] = {
          free: balance[coin].free,
          used: balance[coin].used,
          total: balance[coin].total
        };
      }
    });
    
    res.json({ success: true, data: filtered });
  } catch (error) {
    console.error('[API] Balance error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Paper trading mode: Simulate order without actually placing it
app.post('/api/orders/simulate', async (req, res) => {
  try {
    const { symbol, side, amount, price } = req.body;
    
    if (!symbol || !side || !amount) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    
    console.log(`[PAPER] Simulating ${side} order: ${amount} ${symbol} @ ${price}`);
    
    // Get current market price for comparison
    const ticker = await binance.fetch_ticker(symbol);
    
    const simulatedOrder = {
      id: `sim-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      symbol,
      side,
      amount,
      price: price || ticker.last,
      status: 'closed',
      cost: amount * (price || ticker.last),
      fee: (amount * (price || ticker.last)) * 0.001, // Assume 0.1% fee
      timestamp: Date.now(),
      trades: [
        {
          id: `trade-${Date.now()}`,
          price: price || ticker.last,
          amount,
          cost: amount * (price || ticker.last)
        }
      ]
    };
    
    console.log(`[PAPER] ✓ Simulated order created: ${simulatedOrder.id}`);
    res.json({ success: true, data: simulatedOrder, mode: 'PAPER_TRADING' });
  } catch (error) {
    console.error('[PAPER] Simulation error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// VOLUME FARMING ENDPOINTS

// Generate Maker-only orders
app.post('/api/volume/maker-orders', async (req, res) => {
  try {
    const orders = await volumeStrategy.generateMakerOrders();

    console.log(`[VolumeFarming] Generated ${orders.length} Maker orders`);

    res.json({
      success: true,
      strategy: 'MAKER_ONLY_VOLUME_FARMING',
      orders,
      expectedTotalRebate: orders.reduce((sum, o) => sum + o.expectedRebate, 0)
    });
  } catch (error) {
    console.error('[VolumeFarming] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Simulate order fill and record rebate
app.post('/api/volume/record-trade', (req, res) => {
  try {
    const { order } = req.body;

    if (!order) {
      return res.status(400).json({ success: false, error: 'Order data required' });
    }

    // Simulate order fill
    const filledOrder = volumeStrategy.simulateOrderFill(order);

    // Record metrics
    const metrics = volumeStrategy.recordTrade(filledOrder);

    console.log(`[VolumeFarming] Trade recorded - Rebate: $${metrics.totalRebateUSD.toFixed(4)}`);

    res.json({
      success: true,
      filledOrder,
      cumulativeMetrics: metrics
    });
  } catch (error) {
    console.error('[VolumeFarming] Record error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get daily volume farming metrics
app.get('/api/volume/metrics', (req, res) => {
  try {
    const daily = volumeStrategy.getDailyMetrics();
    const health = volumeStrategy.isHealthy();
    const remaining = volumeStrategy.getRemainingVolumeTarget();

    res.json({
      success: true,
      strategy: 'VOLUME_FARMING_REBATE',
      daily,
      health,
      remainingVolumeTarget: remaining,
      cumulativeStats: {
        totalVolume: volumeStrategy.stats.totalVolume,
        totalRebate: volumeStrategy.stats.totalRebate,
        totalOrders: volumeStrategy.stats.totalOrders,
        rebateRate: ((volumeStrategy.stats.totalRebate / volumeStrategy.stats.totalVolume) * 100).toFixed(4) + '%'
      }
    });
  } catch (error) {
    console.error('[VolumeFarming] Metrics error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get volume farming status
app.get('/api/volume/status', (req, res) => {
  try {
    const health = volumeStrategy.isHealthy();
    const daily = volumeStrategy.getDailyMetrics();

    res.json({
      success: true,
      strategy: 'MAKER_ONLY_VOLUME_FARMING',
      status: health.message,
      healthy: health.healthy,
      volumeProgress: health.volumeProgress,
      dailyVolume: daily.volumeToday,
      dailyTarget: daily.volumeTarget,
      dailyRebate: daily.rebateToday,
      ordersPlaced: daily.ordersToday,
      timestamp: Date.now()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health endpoint for monitoring
app.get('/api/system/status', (req, res) => {
  res.json({
    status: 'running',
    exchange: 'binance',
    apiKeyConfigured: !!process.env.BINANCE_API_KEY,
    readOnly: true,
    strategy: 'VOLUME_FARMING_REBATE',
    orderType: 'MAKER_ONLY',
    mode: 'PAPER_TRADING',
    timestamp: Date.now()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n✓ Volume Farming Bot Backend running on port ${PORT}`);
  console.log(`✓ Strategy: MAKER-ONLY REBATE FARMING`);
  console.log(`✓ Binance CCXT integration active`);
  console.log(`✓ Paper trading mode enabled\n`);
  console.log('Market Endpoints:');
  console.log(`  GET  /health`);
  console.log(`  GET  /api/market/prices`);
  console.log(`  GET  /api/orderbook/:symbol`);
  console.log(`  GET  /api/balance`);
  console.log(`  GET  /api/system/status\n`);
  console.log('Volume Farming Endpoints:');
  console.log(`  POST /api/volume/maker-orders       (Generate Maker orders)`);
  console.log(`  POST /api/volume/record-trade        (Record filled order + rebate)`);
  console.log(`  GET  /api/volume/metrics            (Daily volume farming stats)`);
  console.log(`  GET  /api/volume/status             (Strategy health status)\n`);
});
