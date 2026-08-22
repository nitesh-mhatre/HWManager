#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;6m'
NC='\033[0m'

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════╗"
echo "║  🏎️  Hot Wheels Recorder - Local APK Build   ║"
echo "╚══════════════════════════════════════════════╝"
echo -e "${NC}"

# ─── Check Android SDK ───────────────────────────────────────
echo -e "${YELLOW}[1/4] Checking Android SDK...${NC}"

if [ -z "${ANDROID_HOME:-}" ] && [ -z "${ANDROID_SDK_ROOT:-}" ]; then
  # Try common locations
  if [ -d "$HOME/Android/Sdk" ]; then
    export ANDROID_HOME="$HOME/Android/Sdk"
  elif [ -d "$HOME/Library/Android/sdk" ]; then
    export ANDROID_HOME="$HOME/Library/Android/sdk"
  else
    echo -e "${RED}❌ Android SDK not found.${NC}"
    echo -e "   Set ANDROID_HOME or install Android SDK:"
    echo -e "   https://developer.android.com/studio#command-tools"
    exit 1
  fi
fi

echo -e "${GREEN}✅ Android SDK at ${ANDROID_HOME:-$ANDROID_SDK_ROOT}${NC}"

# ─── Check Java ──────────────────────────────────────────────
echo -e "${YELLOW}[2/4] Checking Java...${NC}"

if ! command -v java &>/dev/null; then
  echo -e "${RED}❌ Java JDK not found. Install JDK 17+.${NC}"
  exit 1
fi

JAVA_VER=$(java -version 2>&1 | head -1)
echo -e "${GREEN}✅ ${JAVA_VER}${NC}"

# ─── Install dependencies ────────────────────────────────────
echo -e "${YELLOW}[3/4] Installing dependencies...${NC}"

if [ ! -d "node_modules" ]; then
  npm install --legacy-peer-deps
fi
echo -e "${GREEN}✅ Dependencies ready${NC}"

# ─── Build APK locally ──────────────────────────────────────
echo -e "${YELLOW}[4/4] Building APK locally (this may take 10-20 min)...${NC}"
echo ""

npx eas build --platform android --profile preview --local

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗"
echo -e "║       🎉 Local APK Build Complete!           ║"
echo -e "╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Find your APK file in the output above."
echo -e "Transfer it to your Android device and install."
