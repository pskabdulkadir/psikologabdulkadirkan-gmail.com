#!/bin/bash

# Rebate Farming Engine - Otomatik Kurulum Script
# Kullanım: ./setup.sh

echo "🚀 Rebate Farming Engine Kurulum Başlıyor..."
echo "================================================"

# Renklend İçin
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Node.js Kontrol
echo -e "${YELLOW}1️⃣  Node.js Kontrol Ediliyor...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js yüklü değil!${NC}"
    echo "https://nodejs.org/ adresinden LTS versiyonunu indir"
    exit 1
fi
echo -e "${GREEN}✅ Node.js kurulu: $(node --version)${NC}"

# 2. npm dependencies
echo -e "${YELLOW}2️⃣  NPM Paketleri Yükleniyor...${NC}"
npm install
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ npm install başarısız!${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Paketler yüklendi${NC}"

# 3. Build
echo -e "${YELLOW}3️⃣  Build Yapılıyor...${NC}"
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build başarısız!${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Build tamamlandı${NC}"

# 4. Docker Kontrol (Opsiyonel)
echo ""
echo -e "${YELLOW}4️⃣  Docker ile Başlatmak İster misiniz?${NC}"
read -p "Docker'ı kur ve başlat? (evet/hayır): " docker_choice

if [[ "$docker_choice" == "evet" || "$docker_choice" == "y" ]]; then
    if command -v docker &> /dev/null; then
        echo -e "${YELLOW}Docker ile başlatılıyor...${NC}"
        docker-compose up -d
        echo -e "${GREEN}✅ Docker'da çalışıyor!${NC}"
        echo -e "${GREEN}🌐 http://localhost:3000${NC}"
    else
        echo -e "${YELLOW}Docker yüklü değil. https://docker.com adresinden indir${NC}"
        echo -e "${YELLOW}Manuel başlatmak için: npm run start${NC}"
    fi
else
    echo -e "${YELLOW}Manuel başlatmak için:${NC}"
    echo "npm run start"
    echo ""
    echo "Development mode'da:"
    echo "npm run dev"
fi

echo ""
echo "================================================"
echo -e "${GREEN}✅ Kurulum Tamamlandı!${NC}"
echo -e "${GREEN}🌐 http://localhost:3000${NC}"
echo "================================================"
