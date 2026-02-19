# Building the Android APK with Capacitor

Capacitor is set up. To produce an APK:

## 1. Install Android Studio

Download from https://developer.android.com/studio

Android Studio includes:
- Java (JDK)
- Android SDK
- Gradle

## 2. Configure the API URL (for native app)

The APK runs on your phone and needs to reach your backend. When building for your home network:

Create a `.env.production.local` file (don't commit it) with:

```
VITE_API_URL=http://YOUR_PC_IP:3001/api
```

Replace `YOUR_PC_IP` with your PC's local IP (e.g. `192.168.4.248`). Find it with `ipconfig` (look for IPv4).

- **Same WiFi**: Phone and PC on same network → use PC's IP
- **Cloud tunnel**: If you host the backend online, use that URL instead (e.g. `https://your-server.com/api`)

## 3. Build the APK

```bash
# Build web app and sync to Android
npm run cap:sync

# Open Android Studio (build APK from there)
npm run cap:android
```

In Android Studio:
- **Build → Build Bundle(s) / APK(s) → Build APK(s)**
- APK will be at: `android/app/build/outputs/apk/debug/app-debug.apk`

Or from command line (if Java is in PATH):

```bash
cd android
.\gradlew.bat assembleDebug
```

APK path: `android\app\build\outputs\apk\debug\app-debug.apk`

## 4. Install on your phone

- Copy `app-debug.apk` to your phone (USB, email, cloud)
- On the phone: enable "Install from unknown sources" (Settings → Security)
- Open the APK file and install

## 5. Run your backend

The app needs the backend running. Start it with:

```bash
npm run server
```

Keep the server running on your PC. The phone will connect to it using the URL in `VITE_API_URL`.

## Notes

- **Debug APK**: Un signed, for testing. For Play Store you'd need a release build + signing
- **CORS**: Your Express server already has `cors()` enabled, so the phone can reach it
- **Firewall**: Ensure Windows Firewall allows incoming connections on port 3001 from your local network
