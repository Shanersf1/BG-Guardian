# Deploy BG Guardian Link to Railway

This guide walks through deploying the backend (and frontend) to Railway so your APK can reach it from anywhere.

## Prerequisites

- Railway account (railway.app)
- Git repo (optional but recommended) or project folder

---

## Step 0: Set Build & Start Commands

In Railway, your app needs to build the frontend before starting. After creating your service:

1. Go to **Settings** → **Build**
2. **Build Command**: `npm install && npm run build`
3. **Start Command**: `node server/server.cjs`
4. **Root Directory**: (leave empty if your repo root is the project)

Railway will run the build command to create the `dist/` folder, then start the server (which serves both API and frontend).

---

## Step 1: Add a Volume (for persistent data)

Your app stores readings, settings, and config in JSON files. Without a volume, this data is lost on every deploy.

1. In the Railway dashboard, open your project
2. Click your service
3. Go to **Settings** → **Volumes**
4. Click **Add Volume**
5. Mount path: `/data`
6. Create the volume

---

## Step 2: Set Environment Variables

In **Settings** → **Variables**, add:

| Variable   | Value   | Notes                                      |
|-----------|---------|--------------------------------------------|
| `DATA_DIR` | `/data` | Uses the mounted volume for persistent storage |
| `PORT`    | (auto)  | Railway sets this automatically             |

---

## Step 3: Deploy

### Option A: Deploy from GitHub

1. Push your code to a GitHub repo
2. In Railway: **New Project** → **Deploy from GitHub repo**
3. Select your repo and branch
4. Railway will detect `railway.json` and use the build/start commands
5. After deploy, Railway will show a URL like `https://your-app.up.railway.app`

### Option B: Deploy with Railway CLI

```bash
# Install Railway CLI (if not installed)
npm i -g @railway/cli

# Login
railway login

# From your project root
railway link    # Create or link to a project
railway up      # Deploy
```

---

## Step 4: Get your Railway URL

After deployment:

1. Go to your service in Railway
2. **Settings** → **Networking** → **Generate Domain**
3. Copy the URL (e.g. `https://bg-guardian-link-production.up.railway.app`)

---

## Step 5: Configure CareLink / Dexcom

1. Open your Railway URL in a browser
2. Go to **Connect** and set up your CGM source (OAuth tokens, cookies, or Dexcom credentials)
3. Config is saved to the volume, so it will persist across deploys

---

## Step 6: Point the APK to Railway

When building the APK, set the API URL to your Railway backend:

Create `.env.production.local` (don't commit):

```
VITE_API_URL=https://your-app.up.railway.app/api
```

Then build and sync:

```bash
npm run cap:sync
```

When you open the APK on your phone, it will talk to your Railway backend.

---

## Notes

- **Dexcom users**: The Dexcom fetch uses a Python script. Railway's default Node image may not include Python. For Dexcom, you may need a custom Dockerfile or use Medtronic/CareLink only on Railway.
- **Push notifications**: Web push works from Railway; VAPID keys and push subscriptions are stored in the volume.
- **CGM fetch**: The backend runs on Railway and will fetch from CareLink every 5 minutes. Ensure your OAuth/cookie config is valid.
