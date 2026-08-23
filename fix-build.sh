#!/usr/bin/env bash
set -e

echo "🚀 Starting build fix process..."

# 1. Install required build properties package
echo "📦 Installing expo-build-properties..."
npx expo install expo-build-properties

# 2. Update app.json with compatible Kotlin version
echo "⚙️ Updating app.json..."
# app.json is managed by the project — do not overwrite it here.
# The fixes are already in the committed app.json.

# 3. Clean up custom plugin script if it exists
rm -f with-play-services-version.js

# 4. Clean local native build artifacts
echo "🧹 Cleaning native Android/iOS folders..."
rm -rf android ios

# 5. Run EAS Build
echo "🏗️ Triggering EAS Android build with cleared cache..."
eas build --platform android --profile preview --clear-cache
