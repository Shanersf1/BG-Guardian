# Windows Connection Issues - Workaround

## Recommended: Cookie Export Scraper (EU / when others fail)

Medtronic added reCAPTCHA to EU CareLink; the Nightscout-style username/password login returns 404. Use this instead:

1. **Open Edge normally** (no batch file). Go to carelink.minimed.eu and log in (solve CAPTCHA manually).
2. **Install** the "Cookie-Editor" extension from Chrome Web Store (works in Edge).
3. **On the CareLink dashboard** (after you see BG data): Cookie-Editor icon → Export → Export as JSON.
4. **Save** as `scripts/carelink-cookies.json`.
5. **Install Playwright** (required for cookie mode): `pip install playwright` then `playwright install`
6. **Run** `py scripts/carelink-scraper-cookies.py` (or `python` on Mac/Linux)
7. **Add `--post`** to send the reading to the app: `py scripts/carelink-scraper-cookies.py --post`

**Follower activation**: If you're a Care Partner, open the CareLink Connect app on your phone and log in at least once (see your daughter's data). This "activates" the real-time Follower stream. Without it, the API may return empty.

Note: The direct API often returns 401 even with fresh cookies (web auth differs from mobile). The script uses Playwright to load the page and fetch the dashboard API from the browser context—this uses the same session as viewing CareLink in Edge.

Re-export cookies when the session expires (every few days).

---

## If you prefer OAuth tokens

If you get **SSL/TLS errors** when running `carelink_carepartner_api_login.py` (Windows or WSL):
- `ConnectionResetError: [WinError 10054]`
- `SSL: UNEXPECTED_EOF_WHILE_READING`
- `OPENSSL_internal:invalid library`

Medtronic's login server uses TLS fingerprinting. **The script now uses `curl_cffi`** to mimic Chrome—run `pip install -r requirements.txt` to get the update, then try again.

## If curl_cffi doesn't help: Use WSL with Firefox

WSL + Firefox (for CAPTCHA) can work when curl_cffi fails.

### 1. Install WSL (if not already)

```powershell
wsl --install
```

Restart if prompted, then open **Ubuntu** from the Start menu.

### 2. Run the script in WSL

```bash
cd /mnt/c/Users/Shane/Downloads/bg-guardian-link/carelink-python-client
sudo apt update
sudo apt install -y python3 python3-pip python3-venv firefox
pip3 install -r requirements.txt
python3 carelink_carepartner_api_login.py
```

### 3. Copy logindata.json back to Windows

After successful login, the file is at:
```
/mnt/c/Users/Shane/Downloads/bg-guardian-link/carelink-python-client/logindata.json
```

It's already in your project folder, so you can use it directly in the BG Guardian Link app.

## Alternative: Use Another Machine

Run the script on a Mac or Linux machine, then copy `logindata.json` to your Windows PC.
