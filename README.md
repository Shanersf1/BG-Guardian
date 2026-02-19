# BG Guardian Link

Local blood glucose monitoring app that fetches readings from **Medtronic CareLink** or **Dexcom Share** every 5 minutes. **Runs entirely on your machine—no Base44 or cloud services.**

## Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Run the app**
   ```bash
   npm run dev
   ```

3. **Open** http://localhost:5173 in your browser (use 5173, not 3001—the API runs on 3001)

4. **Connect your CGM**
   - Go to **Connect** in the nav
   - Choose **Medtronic CareLink** or **Dexcom Share**
   - Follow the setup for your chosen system

## CareLink Connect: "Follower" Activation (Important!)

If you are a **Care Partner** (following your daughter's data), Medtronic requires that you **open the CareLink Connect app on your phone** and log in at least once before the real-time API will work. This "activates" the Follower stream. Without it, the dashboard API may return empty data even with valid credentials.

1. Install the CareLink Connect app on your phone
2. Log in with your Care Partner credentials
3. Confirm you can see your daughter's BG data in the app
4. Only then will the `/connect/monitor/v2/dashboard` API (5-min real-time data) work

If you skip this step, you may only get delayed "Patient" data (2+ hours) or nothing at all.

## EU: Cookie Export (reCAPTCHA workaround)

The EU CareLink login uses reCAPTCHA, so automated login fails. Use **Cookie Export**:

1. Log in to [carelink.minimed.eu](https://carelink.minimed.eu) in **Edge** (normal browsing)
2. Install the **Cookie-Editor** extension
3. On the CareLink dashboard: Cookie-Editor → Export → Export as JSON
4. Save as `scripts/carelink-cookies.json`
5. In CareLink Setup: enable **Cookie mode**, set **Patient ID** (your daughter's CareLink username)

**Limitation:** Cookie export uses your *web* session. Medtronic may serve **report data (~2h delayed)** to web sessions and **real-time data (5-min)** only to OAuth/mobile app sessions. If you see stale readings, the cookie approach may be limited; OAuth tokens (from carelink-python-client) would be needed for real-time, but EU OAuth has the same reCAPTCHA hurdle.

## Dexcom Share

If you use a Dexcom G7, G6, G5, or G4 with the Share feature enabled:

1. Install Python and pydexcom: `pip install -r scripts/requirements-alerts.txt`
2. Go to **Connect** → select **Dexcom Share**
3. Enter your Dexcom Share username (or email/phone with +country code) and password
4. Enable "Outside United States" if applicable
5. Save and Test Connection

## Voice & Audio Alerts

The app plays notification beeps and voice warnings in your **browser** when alerts fire. Works on PC and mobile.

## Push Notifications (screen-off alerts)

Get alerts when your phone is **locked**:

1. Go to **Settings** → **Voice Alerts** → enable audio alerts
2. Go to **Mobile & screen-off alerts** → tap **Enable**
3. Allow notifications when prompted
4. On iOS: add the app to your home screen first (required for push)
5. Production use requires HTTPS (localhost works for testing)

## Getting CareLink Tokens

Use [carelink-python-client](https://github.com/ondrej1024/carelink-python-client) to obtain tokens. On Windows, run it in **WSL** (see `carelink-python-client/WINDOWS_WORKAROUND.md`).

1. Clone and install: `pip install -r requirements.txt`
2. Run: `python carelink_carepartner_api_login.py` (add `--us` for US accounts)
3. Complete login in the Firefox window
4. Copy values from `logindata.json` into CareLink Setup

## Features

- **Dashboard**: Current BG, trend arrow, pump battery, active insulin, sensor age
- **Medtronic or Dexcom**: Choose your CGM system (CareLink or Dexcom Share)
- **Auto-fetch**: Fetches from your CGM every 5 minutes (server-side)
- **Manual refresh**: Click Refresh to fetch immediately
- **Manual entry**: Add readings on the Add page
- **Settings**: Configure high/low thresholds, voice alerts (beeps + spoken warnings)
- **Data storage**: All data stored locally in `data/` (JSON files)

## Scripts

| Command | Description |
|--------|-------------|
| `npm run dev` | Start backend (port 3001) + frontend (port 5173) |
| `npm run server` | Backend only |
| `npm run client` | Frontend only |
| `npm run build` | Build for production |
| `npm start` | Run production build—serves app at http://localhost:3001 (run `npm run build` first) |

## Data Location

- Readings: `data/readings.json`
- CareLink tokens: `data/config.json`
- Alert settings: `data/settings.json`

**Note:** The `data/` folder is gitignored. Keep your config backed up securely.
