# ⚡ Hızlı Başlangıç (Quick Start)

**5 dakika içinde localhost'ta çalıştırın!**

---

## 1️⃣ Gerekli Yazılımları Kur

### **Node.js** (Manual kurulum varsa bu adımı atla)
```
https://nodejs.org/
→ LTS versiyonunu indir
→ Kur
```

### **Docker** (Opsiyonel ama tavsiye edilen)
```
https://www.docker.com/products/docker-desktop
→ İndir
→ Kur
```

**Kontrol Et:**
```bash
node --version    # v18 veya üstü olmalı
docker --version  # (varsa göster)
```

---

## 2️⃣ Repo'yu İndir

Terminali aç ve şu komutu yaz:

```bash
git clone https://github.com/pskabdulkadir/psikologabdulkadirkan-gmail.com.git
cd rebate-farming-engine
```

---

## 3️⃣ Başlat (2 Seçenek)

### **Seçenek A: Docker ile (En Kolay)** ⭐

```bash
docker-compose up -d
```

Bitti! Otomatik olarak:
- ✅ Dependencies yüklenir
- ✅ Build yapılır
- ✅ Server başlar
- ✅ http://localhost:3000 açılır

**Kontrol Et:**
```bash
docker ps
# "rebate-farming-engine" yazarsa aktif demektir
```

**Durdur:**
```bash
docker-compose down
```

---

### **Seçenek B: Manuel Node.js ile**

```bash
npm install
npm run build
npm run start
```

Veya development mode'da:
```bash
npm run dev
# http://localhost:3000
```

---

## 4️⃣ Dashboard'a Gir

Browser'ı aç ve git:
```
http://localhost:3000
```

Hoş geldiniz! 🎉

---

## 5️⃣ API Key'leri Yapılandır

1. Dashboard'da **Settings** sekmesine git
2. **API Config** bölümüne git
3. Binance/OKX/Coinbase seç
4. Kendi API key'lerini gir
5. **SAVE** butonuna bas

---

## 🆘 Sorunlar?

### Docker kullanırken hata?
```bash
docker-compose logs
# Hatayı göreceksin
```

### Port 3000 zaten kullanılmış?
```bash
# docker-compose.yml'de değiştir:
ports:
  - "3001:3000"  # 3001 olarak aç
```

### npm install uzun sürüyor?
```bash
# npm cache temizle
npm cache clean --force
npm install
```

---

## 📚 Sonra Ne?

1. **Settings** → Cüzdan adresi ekle
2. **Rebate Farming Lab** → Engine başlat
3. **Ledger** → İşlemleri takip et
4. **Manual Withdraw** → Rebate'i çek

---

## 🔐 Güvenlik Hatırlatması

✅ API Key'leriniz: Tarayıcıda şifreli (localhost'ta güvenli)
✅ Private Key: Asla girlmez
✅ Tüm işlemler: Local sunucuda çalışır (dışarı çıkmaz)

---

**Hazırsan başla!** 🚀
