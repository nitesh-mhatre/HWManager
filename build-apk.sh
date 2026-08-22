#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

# ─── Colors ───────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════╗"
echo "║     🏎️  Hot Wheels Recorder - APK Builder    ║"
echo "╚══════════════════════════════════════════════╝"
echo -e "${NC}"

# ─── Check dependencies ──────────────────────────────────────
echo -e "${YELLOW}[1/5] Checking dependencies...${NC}"

if ! command -v node &>/dev/null; then
  echo -e "${RED}❌ Node.js not found. Install from https://nodejs.org${NC}"
  exit 1
fi

if ! command -v npx &>/dev/null; then
  echo -e "${RED}❌ npx not found.${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Node $(node -v) found${NC}"

# ─── Install node_modules if needed ──────────────────────────
echo -e "${YELLOW}[2/5] Installing dependencies...${NC}"
if [ ! -d "node_modules" ]; then
  npm install --legacy-peer-deps
  echo -e "${GREEN}✅ Dependencies installed${NC}"
else
  echo -e "${GREEN}✅ Dependencies already installed${NC}"
fi

# ─── Install EAS CLI if needed ───────────────────────────────
echo -e "${YELLOW}[3/5] Checking EAS CLI...${NC}"
if ! npx eas --version &>/dev/null 2>&1; then
  echo -e "${YELLOW}Installing EAS CLI globally...${NC}"
  npm install -g eas-cli
fi
echo -e "${GREEN}✅ EAS CLI ready${NC}"

# ─── Check EAS login ─────────────────────────────────────────
echo -e "${YELLOW}[4/5] Checking EAS login...${NC}"
if ! npx eas whoami &>/dev/null 2>&1; then
  echo -e "${CYAN}Please log in to your Expo account:${NC}"
  npx eas login
fi
echo -e "${GREEN}✅ Logged in as $(npx eas whoami)${NC}"

# ─── Build APK ───────────────────────────────────────────────
echo -e "${YELLOW}[5/5] Building APK...${NC}"
echo ""
echo -e "${CYAN}This will build an APK in the cloud via EAS Build.${NC}"
echo -e "${CYAN}You'll get a download link when it's done.${NC}"
echo ""

# Build with preview profile (outputs APK)
npx eas build --platform android --profile preview --non-interactive

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗"
echo -e "║          🎉 APK Build Complete!              ║"
echo -e "╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Download your APK from the link above."
echo -e "Install it on your Android device to test."
