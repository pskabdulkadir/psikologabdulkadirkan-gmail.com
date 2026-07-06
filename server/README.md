# Arbitrage Bot Backend

Production backend for Zero-Trust Arbitrage Engine with CCXT + Binance integration.

## Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your READ-ONLY Binance API keys
```

⚠️ **IMPORTANT:** Only use **READ-ONLY** API keys (no withdrawal permissions)

### 3. Run Development Server
```bash
npm run dev
```

Server will start on `http://localhost:3000`

## API Endpoints

### Health Check
```
GET /health
```

### Market Data
```
GET /api/market/prices?symbols=BTC/USDT,ETH/USDT,SOL/USDT
```

### Order Book
```
GET /api/orderbook/BTC/USDT?limit=20
```

### Account Balance (READ-ONLY)
```
GET /api/balance
```

### Paper Trading - Simulate Order
```
POST /api/orders/simulate
Body: {
  "symbol": "BTC/USDT",
  "side": "buy",
  "amount": 0.1,
  "price": 45000
}
```

### System Status
```
GET /api/system/status
```

## Features

- ✅ CCXT integration with Binance
- ✅ Read-only API keys only (safe)
- ✅ Paper trading mode (no real orders)
- ✅ Rate limiting (1200ms per request)
- ✅ Error handling & logging

## Next Steps

- [ ] Add Redis caching
- [ ] Implement WebSocket for real-time updates
- [ ] Add JWT authentication
- [ ] Create order queue system
- [ ] Deploy to DigitalOcean

## Security

- API keys stored in `.env` (never committed)
- Read-only access only
- Rate limits enabled
- CORS configured
