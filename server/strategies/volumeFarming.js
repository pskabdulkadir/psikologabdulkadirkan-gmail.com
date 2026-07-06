/**
 * Volume Farming Strategy
 * 
 * Strategy: Accumulate trading volume through Maker-only orders
 * Goal: Maximize rebate earnings, not spread profit
 * Risk: Volume targets (not stop-loss)
 */

class VolumeFarmingStrategy {
  constructor(exchange, config = {}) {
    this.exchange = exchange;
    this.config = {
      symbol: config.symbol || 'BTC/USDT',
      orderSize: config.orderSize || 0.01,
      updateIntervalMs: config.updateIntervalMs || 5000,
      dailyVolumeTarget: config.dailyVolumeTarget || 10000, // $10k USD target
      spreadBps: config.spreadBps || 5, // 5 basis points from mid-price
      ...config
    };

    this.stats = {
      totalVolume: 0,
      totalOrders: 0,
      totalRebate: 0,
      currentBalance: 0,
      activeMakerOrders: [],
      orderHistory: [],
      lastUpdate: null
    };
  }

  /**
   * Calculate Maker order prices around mid-price
   * Spreads orders slightly above/below market to act as liquidity provider
   */
  calculateMakerPrices(ticker) {
    const midPrice = (ticker.bid + ticker.ask) / 2;
    const spreadAmount = midPrice * (this.config.spreadBps / 10000);

    return {
      buyPrice: midPrice - spreadAmount,    // Bid side
      sellPrice: midPrice + spreadAmount,   // Ask side
      midPrice
    };
  }

  /**
   * Calculate expected rebate for an order
   * Binance Maker rebate: -0.02% (they pay you)
   */
  calculateExpectedRebate(volume) {
    const rebateRate = -0.0002; // -0.02% (negative = they pay us)
    return Math.abs(volume * rebateRate);
  }

  /**
   * Generate simulated Maker orders (paper trading)
   */
  async generateMakerOrders(balance) {
    try {
      const ticker = await this.exchange.fetch_ticker(this.config.symbol);
      const prices = this.calculateMakerPrices(ticker);

      // Generate buy and sell orders
      const buyOrder = {
        id: `maker-buy-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        symbol: this.config.symbol,
        side: 'buy',
        type: 'limit',
        amount: this.config.orderSize,
        price: prices.buyPrice,
        cost: this.config.orderSize * prices.buyPrice,
        timestamp: Date.now(),
        status: 'open',
        orderType: 'MAKER',
        expectedRebate: this.calculateExpectedRebate(this.config.orderSize * prices.buyPrice)
      };

      const sellOrder = {
        id: `maker-sell-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        symbol: this.config.symbol,
        side: 'sell',
        type: 'limit',
        amount: this.config.orderSize,
        price: prices.sellPrice,
        cost: this.config.orderSize * prices.sellPrice,
        timestamp: Date.now(),
        status: 'open',
        orderType: 'MAKER',
        expectedRebate: this.calculateExpectedRebate(this.config.orderSize * prices.sellPrice)
      };

      return [buyOrder, sellOrder];
    } catch (error) {
      console.error('[VolumeFarming] Error generating Maker orders:', error.message);
      return [];
    }
  }

  /**
   * Simulate order fill (paper trading)
   */
  simulateOrderFill(order) {
    const filledOrder = {
      ...order,
      status: 'closed',
      filledAmount: order.amount,
      actualPrice: order.price,
      fee: order.cost * 0.001, // Assume 0.1% taker fee
      rebate: order.expectedRebate,
      filledAt: Date.now()
    };

    return filledOrder;
  }

  /**
   * Track volume and rebate metrics
   */
  recordTrade(order) {
    const volume = order.cost;
    const rebate = order.rebate || 0;

    this.stats.totalVolume += volume;
    this.stats.totalRebate += rebate;
    this.stats.totalOrders += 1;
    this.stats.orderHistory.push({
      id: order.id,
      side: order.side,
      amount: order.amount,
      price: order.price,
      volume,
      rebate,
      timestamp: order.filledAt || Date.now()
    });

    return {
      totalVolumeUSD: this.stats.totalVolume,
      totalRebateUSD: this.stats.totalRebate,
      rebatePercentage: ((this.stats.totalRebate / this.stats.totalVolume) * 100).toFixed(4),
      ordersPlaced: this.stats.totalOrders
    };
  }

  /**
   * Get daily metrics
   */
  getDailyMetrics() {
    const now = Date.now();
    const dayAgo = now - (24 * 60 * 60 * 1000);
    
    const dayOrders = this.stats.orderHistory.filter(o => o.timestamp > dayAgo);
    const dayVolume = dayOrders.reduce((sum, o) => sum + o.volume, 0);
    const dayRebate = dayOrders.reduce((sum, o) => sum + o.rebate, 0);

    return {
      volumeToday: dayVolume,
      volumeTarget: this.config.dailyVolumeTarget,
      volumeProgress: ((dayVolume / this.config.dailyVolumeTarget) * 100).toFixed(2),
      rebateToday: dayRebate,
      ordersToday: dayOrders.length,
      averageOrderSize: dayOrders.length ? (dayVolume / dayOrders.length).toFixed(2) : 0
    };
  }

  /**
   * Calculate volume needed to reach daily target
   */
  getRemainingVolumeTarget() {
    const dailyMetrics = this.getDailyMetrics();
    const remaining = Math.max(0, this.config.dailyVolumeTarget - dailyMetrics.volumeToday);
    return remaining;
  }

  /**
   * Risk management: Check if volume targets are healthy
   */
  isHealthy() {
    const dailyMetrics = this.getDailyMetrics();
    const progress = parseFloat(dailyMetrics.volumeProgress);

    return {
      healthy: progress >= 0, // Always true in volume farming
      volumeProgress: progress,
      message: progress < 20 
        ? 'Volume farming below expectations' 
        : progress >= 100 
        ? 'Daily target reached! 🎯' 
        : 'Volume farming on track'
    };
  }
}

export default VolumeFarmingStrategy;
