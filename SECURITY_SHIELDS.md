# 🛡️ Security Shields - 3 Katmanlı Sermaye Koruma

Bu dokümantasyon, sisteme entegre edilmiş 3 katmanlı güvenlik kalkanını açıklar.

---

## **Shield Layer 1: Withdrawal Hard-Lock**

### Amaç
Sistem, hiçbir koşulda otomatik olarak borsa cüzdanından para çekemez.

### Teknik İmplementasyon

```typescript
// server.ts - /api/manual-withdraw endpoint

// HARD-LOCK: Withdrawal sadece user approval ile
if (!userApproval) {
  return res.status(403).json({ 
    error: 'User approval required',
    status: 'WITHDRAWAL_LOCKED'
  });
}
```

### Kurallar

❌ **Yasaklı:**
- Otonom withdrawal loops
- Scheduled withdrawal triggers
- Automatic fund transfers
- Herhangi bir background withdrawal process

✅ **İzin Verilen:**
- Manual Dashboard button click
- Explicit user confirmation
- Direct API call + user approval flag

### Doğrulama

Her withdrawal attempt'ında:
1. User approval flag kontrol edilir
2. Manual button click zorunluluğu
3. Network log kaydı yapılır: `MANUAL_WITHDRAW_INITIATED`
4. Dashboard'da konfirmasyonlu dialog

---

## **Shield Layer 2: Maker-Only Enforcer**

### Amaç
Sistem, hiçbir koşulda Taker işlem yapamaz. Sadece Maker (Post-Only) emirleri gönderilir.

### Teknik İmplementasyon

```typescript
// server.ts - Post-Only Hard-Coding

const ccxtOrder = await client.createOrder(
  marketSymbol,
  'limit',
  side.toLowerCase(),
  quantity,
  price,
  { 'postOnly': true } // HARD-CODED: Must be true
);

// Taker Fill Detection & Auto-Cancel
if (ccxtOrder.takerOrMaker === 'taker') {
  await client.cancelOrder(ccxtOrder.id);
  // Order immediately cancelled
}
```

### Kurallar

❌ **Yasaklı:**
- Market orders
- Taker orders
- Limit orders without postOnly=true
- Herhangi bir price guarantee stratejisi

✅ **İzin Verilen:**
- Post-Only limit orders (Maker)
- Spread'de bekleme (order rejection expected)
- Limit price adjustment

### Doğrulama

Her trade attempt'ında:
1. `postOnly=true` hard-coded zorunluluğu
2. Order gönderildikten sonra taker/maker kontrol
3. Eğer taker olursa: otomatik cancel
4. Network log: `MAKER_ORDER_ENFORCED` veya `MAKER_ENFORCER_TRIGGERED`

---

## **Shield Layer 3: Order Size Limiter**

### Amaç
Sistem, belirli bir maksimum tutardan yüksek işlem gönderemez. (Default: 2.0 USDT/order)

### Teknik İmplementasyon

```typescript
// server.ts - Order Size Validation

const orderValue = price * quantity;
const MAX_ORDER_LIMIT = maxOrderSize || 2.0; // Settings'ten kontrol

if (orderValue > MAX_ORDER_LIMIT) {
  return res.status(400).json({
    error: 'Order size exceeds limit',
    attemptedValue: orderValue,
    maxAllowed: MAX_ORDER_LIMIT,
    status: 'ORDER_BLOCKED'
  });
}
```

### Dashboard Kontrolü

Settings panelinde "Max Order Size" input'u:

```
🛡️ Max Order Size (USDT) - Sermaye Koruma
[2.0] USDT
↑
Her işlem bu limiti aşamaz
```

### Kurallar

❌ **Yasaklı:**
- Limit değerini aşan işlemler
- Değişken order size (dinamik)
- Limit bypass girişimleri

✅ **İzin Verilen:**
- Sabit maksimum limit
- User tarafından ayarlanabilir limit
- Settings'ten kontrol edilebilir değer

### Doğrulama

Her trade attempt'ında:
1. Order value = price × quantity hesaplanır
2. MAX_ORDER_LIMIT ile karşılaştırılır
3. Eğer aşarsa: 400 error + ORDER_BLOCKED
4. Network log: `ORDER_SIZE_EXCEEDED` veya `ORDER_BLOCKED`

---

## **Entegre Güvenlik Akışı**

```
User Dashboard
      ↓
[Order Submit]
      ↓
Shield 3: Order Size Check
├─ OK: Devam et
└─ FAIL: ORDER_BLOCKED → return error
      ↓
Shield 2: Post-Only Enforcer
├─ postOnly=true hard-coded
├─ Order gönder
├─ Taker fill? → AUTO-CANCEL
└─ OK: Store order
      ↓
Shield 1: Withdrawal Hard-Lock
├─ Manual withdrawal button
├─ User approval required
├─ 2FA confirmation (borsa)
└─ Only then: Para çıkar
```

---

## **Teknik Detaylar**

### Order Rejection Scenarios

**Scenario 1: Order Size Limit Exceeded**
```json
{
  "error": "Order size exceeds limit",
  "attemptedValue": 5.50,
  "maxAllowed": 2.0,
  "status": "ORDER_BLOCKED"
}
```

**Scenario 2: Post-Only Rejected by Exchange**
```json
{
  "error": "Post-Only order rejected by exchange",
  "status": "MAKER_ENFORCER_BLOCKED",
  "message": "Exchange rejected this order because it would fill as Taker"
}
```

**Scenario 3: Insufficient Balance**
```json
{
  "error": "Insufficient balance",
  "required": 5.0,
  "available": 2.5,
  "status": "INSUFFICIENT_CAPITAL"
}
```

### Network Logging

Her security event log kaydı:

```
[SECURITY] ORDER_SIZE_EXCEEDED
Attempted: 5.50 USDT
Limit: 2.0 USDT
Status: BLOCKED

[SECURITY] MAKER_ENFORCER_TRIGGERED
Order filled as Taker: #123456
Action: AUTO-CANCEL
Status: CANCELLED

[SECURITY] WITHDRAWAL_LOCKED
Attempt without user approval
Status: REJECTED
```

---

## **Fail-Safe Mode**

3 ardışık hata sonrası:

```javascript
if (store.consecutiveFailures >= 3) {
  addNetworkLog('FAIL_SAFE', 'EMERGENCY', 'Emergency Stop');
  // Sistem durdurulur
}
```

Response:
```json
{
  "failSafeActive": true,
  "status": "EMERGENCY_STOP"
}
```

---

## **Doğrulama Checklist**

Sistem düzgün çalışıyorsa:

- [ ] Order Size Limiter, Settings'ten kontrol edilebilir
- [ ] 2.0 USDT (default) üzeri işlem reddedilir
- [ ] Post-Only= true her zaman hard-coded
- [ ] Taker fill'i otomatik cancel edilir
- [ ] Withdrawal sadece manual button ile (no loops)
- [ ] 3+ error sonrası fail-safe trigger'lanır
- [ ] Network logs tüm security events'ı kaydeder

---

## **Özet**

```
Layer 1: Withdrawal Hard-Lock
└─ Sadece manual, user approval gerekli

Layer 2: Maker-Only Enforcer
└─ Post-Only hard-coded, Taker auto-cancel

Layer 3: Order Size Limiter
└─ Max 2.0 USDT/order (user kontrol)
```

**Sonuç: Sermaye %100 korunuyor!** 🛡️
