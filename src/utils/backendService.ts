// Backend API Service for Volume Farming Bot

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

interface MakerOrder {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  amount: number;
  price: number;
  cost: number;
  expectedRebate: number;
}

interface VolumeMetrics {
  volumeToday: number;
  volumeTarget: number;
  volumeProgress: string;
  rebateToday: number;
  ordersToday: number;
  averageOrderSize: string;
}

interface VolumeFarmingStatus {
  strategy: string;
  status: string;
  healthy: boolean;
  volumeProgress: number;
  dailyVolume: number;
  dailyTarget: number;
  dailyRebate: number;
  ordersPlaced: number;
}

class BackendService {
  /**
   * Generate Maker-only orders
   */
  async generateMakerOrders(): Promise<MakerOrder[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/volume/maker-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log('[BackendService] Generated Maker orders:', data);
      return data.orders || [];
    } catch (error) {
      console.error('[BackendService] Generate orders error:', error);
      return [];
    }
  }

  /**
   * Record a filled trade and rebate
   */
  async recordTrade(order: MakerOrder) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/volume/record-trade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log('[BackendService] Trade recorded:', data);
      return data.cumulativeMetrics;
    } catch (error) {
      console.error('[BackendService] Record trade error:', error);
      return null;
    }
  }

  /**
   * Get volume farming daily metrics
   */
  async getVolumeMetrics(): Promise<{
    daily: VolumeMetrics;
    cumulativeStats: any;
  } | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/volume/metrics`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log('[BackendService] Volume metrics:', data);
      return {
        daily: data.daily,
        cumulativeStats: data.cumulativeStats
      };
    } catch (error) {
      console.error('[BackendService] Metrics error:', error);
      return null;
    }
  }

  /**
   * Get volume farming strategy status
   */
  async getVolumeFarmingStatus(): Promise<VolumeFarmingStatus | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/volume/status`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log('[BackendService] Volume farming status:', data);
      return data;
    } catch (error) {
      console.error('[BackendService] Status error:', error);
      return null;
    }
  }

  /**
   * Get market prices from backend
   */
  async getMarketPrices(symbols: string[] = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'AVAX/USDT', 'LINK/USDT']) {
    try {
      const symbolParam = symbols.join(',');
      const response = await fetch(`${API_BASE_URL}/api/market/prices?symbols=${symbolParam}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('[BackendService] Market prices error:', error);
      return null;
    }
  }

  /**
   * Get order book
   */
  async getOrderBook(symbol: string, limit: number = 20) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/orderbook/${symbol}?limit=${limit}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[BackendService] Orderbook error:', error);
      return null;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      return response.ok;
    } catch (error) {
      console.warn('[BackendService] Health check failed - backend offline');
      return false;
    }
  }
}

export const backendService = new BackendService();
