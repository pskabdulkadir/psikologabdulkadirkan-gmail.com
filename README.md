# 🤖 Open Source Maker-Only Rebate Farming Engine

**Açık Kaynak - Self-Hosted - Tamamen Yasal**

Kendi borsa hesabınızda Post-Only (Maker) emirleri göndererek rebate kazanın. Tüm veriler gerçek, tüm rebate'ler sizin hesabınıza gider.

---

## 📋 Özellikler

✅ **Self-Hosted**: Kendi sunucunuzda çalışır
✅ **Open Source**: Kaynak kod tamamen açık (MIT Lisans)
✅ **API-Controlled**: Sadece kendi API key'lerinizi kullanır
✅ **Real Data Only**: Tüm veriler canlı borsa'dan gelir
✅ **Post-Only Orders**: Sadece Maker emirleri (spread risk yok)
✅ **Manual Withdrawal**: Tüm çekimler kullanıcı onaylı
✅ **Transparent Ledger**: Tüm işlemler doğrulanmış (tradeId)

---

## 🚀 Kurulum

### Gereklilikler

- Node.js 18+
- npm/yarn
- Binance/OKX/Coinbase hesabı (API key ile)

### 1. Yazılımı İndir

```bash
git clone https://github.com/pskabdulkadir/rebate-farming-engine.git
cd rebate-farming-engine
npm install
```

### 2. Ortam Değişkenlerini Ayarla

```bash
cp .env.example .env
```

`.env` dosyasını düzenle:
```
PORT=3000
NODE_ENV=production
```

### 3. Başlat

```bash
# Development mode
npm run dev

# Production mode
npm run build
npm run start
```

Açık: `http://localhost:3000`

---

## 🔐 API Key Yapılandırması

### Binance

1. Binance Account → API Management
2. Create API Key (IP Whitelist: localhost)
3. **Enable Spot Trading Only** ✅
4. **Disable Withdrawal** ❌
5. Key ve Secret kopyala
6. Dashboard'a gir

### OKX

1. OKX Account → API
2. Create Key
3. API Key + Secret + Passphrase kopyala
4. Dashboard'a gir

### Coinbase

1. Coinbase → Advanced → API
2. Create Key
3. IP Whitelist: localhost
4. Dashboard'a gir

---

## 💻 Nasıl Kullanılır

### 1. Dashboard'a Gir
```
http://localhost:3000
```

### 2. API Keys Konfigüre Et
- Settings → API Config
- Binance/OKX/Coinbase seç
- Key ve Secret gir
- "SAVE" butonuna bas

### 3. Cüzdan Adresi Ekle (Optional)
- Settings → Wallet Management
- TRC20/USDT cüzdan adresini gir
- Rebate'i çekmek için kullan

### 4. İşlem Başlat
- Rebase Farming Lab → "Start Engine"
- Post-Only emirler otomatik gönderilecek
- Real Ledger'da işlemleri takip et

### 5. Rebate'i Çek (Manuel)
- Settings → Manual Withdrawal
- Tutar ve adres gir
- "Confirm Withdrawal" butonuna bas
- Borsa API aracılığıyla çekme başlar

---

## 📊 Dashboard Panelleri

### Monitoring
- Canlı fiyatlar
- İşlem hacmi
- Biriken rebate
- Network logs

### Ledger
- Gerçek borsa işlemleri (tradeId)
- Emir detayları
- Fee ve rebate tutarları

### Settings
- API Key yönetimi
- Cüzdan adresi
- Referral kodları
- Manual withdrawal

---

## 🔒 Güvenlik

- **API Keys**: Tarayıcı RAM belleğinde şifreli (localStorage)
- **Private Keys**: Asla istenmez
- **Withdrawal**: Hard-locked (manuel onay gerekli)
- **Fail-Safe**: 3 hata sonra otomatik durdur

---

## 📝 Lisans

MIT License - Freely use, modify, and distribute

---

## ⚖️ Yasal Uyarı

✅ Bu yazılım tamamen yasal kullanım için tasarlanmıştır:
- Sadece kendi API key'lerinizi kullanır
- Sadece kendi hesabınızdaki işlemleri gösterir
- Sadece kendi rebate'inizi hesaplar
- Hiçbir üçüncü parti para transferi yapılmaz

---

## 🆘 Destek

- Issues: GitHub Issues kısmında açın
- Sorular: Discussions'da yazın
- Security: security@example.com

---

## 🎯 Roadmap

- [ ] Advanced scheduling (belirli saatlerde işlem)
- [ ] Multi-account support
- [ ] Custom trading pairs
- [ ] Grafana dashboard integration
- [ ] CLI version

---

**Kendi Borsa Hesabınızda, Kendi Rebate'inizi Kazanın!** 🚀
