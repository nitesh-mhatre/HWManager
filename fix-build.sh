#!/usr/bin/env bash
set -e

echo "🚀 Starting build fix process..."

# 1. Install required build properties package
echo "📦 Installing expo-build-properties..."
npx expo install expo-build-properties

# 2. Update app.json with compatible Kotlin version
echo "⚙️ Updating app.json..."
cat << 'EOF' > app.json
{
  "expo": {
    "name": "HW Manager",
    "slug": "hotwheels-recorder",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "dark",
    "newArchEnabled": true,
    "scheme": "hotwheels-recorder",
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.bites.hwmanager",
      "infoPlist": {
        "NSCameraUsageDescription": "Hot Wheels Recorder needs camera access to scan your Hot Wheels cars.",
        "NSPhotoLibraryUsageDescription": "Hot Wheels Recorder needs photo access to import car images."
      }
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#1a1a2e"
      },
      "package": "com.bites.hwmanager",
      "permissions": [
        "android.permission.CAMERA",
        "android.permission.RECORD_AUDIO"
      ]
    },
    "web": {
      "bundler": "metro",
      "favicon": "./assets/favicon.png"
    },
    "plugins": [
      "expo-router",
      "expo-font",
      "expo-asset",
      "expo-status-bar",
      [
        "expo-build-properties",
        {
          "android": {
            "kotlinVersion": "2.3.0"
          }
        }
      ],
      [
        "react-native-google-mobile-ads",
        {
          "androidAppId": "ca-app-pub-2889632845666311~7452613987",
          "iosAppId": "ca-app-pub-3940256099942544~1458671072"
        }
      ],
      [
        "expo-camera",
        {
          "cameraPermission": "Allow Hot Wheels Recorder to scan your cars with the camera."
        }
      ],
      [
        "expo-image-picker",
        {
          "photosPermission": "Allow Hot Wheels Recorder to access photos for car images."
        }
      ]
    ],
    "extra": {
      "router": {},
      "eas": {
        "projectId": "c338b808-ac0c-422f-b5e5-1bb5636bbf70"
      }
    },
    "owner": "mr.bites"
  }
}
EOF

# 3. Clean up custom plugin script if it exists
rm -f with-play-services-version.js

# 4. Clean local native build artifacts
echo "🧹 Cleaning native Android/iOS folders..."
rm -rf android ios

# 5. Run EAS Build
echo "🏗️ Triggering EAS Android build with cleared cache..."
eas build --platform android --profile production --clear-cache
