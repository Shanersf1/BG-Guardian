#!/usr/bin/env python3
"""
CareLink scraper - uses exported cookies (no browser debugging).

Medtronic blocks login when Edge has remote debugging. This approach avoids that:
you log in in NORMAL Edge, export cookies, then this script uses them.

WORKFLOW:
1. Open Edge normally (no batch file). Go to carelink.minimed.eu and log in.
2. Install "Cookie-Editor" extension (Chrome Web Store, works in Edge)
3. On the CareLink dashboard: Cookie-Editor icon > Export > Export as JSON
4. Save to: scripts/carelink-cookies.json  (or path you pass)
5. Run: python carelink-scraper-cookies.py
6. Add --post to send the reading to the app: python carelink-scraper-cookies.py --post
7. Add --headless for no browser window
8. Add --json to output result as JSON (for app integration; implies --headless)

Tries the real-time monitor/v2/dashboard API first, falls back to page scraping.
"""

import json
import os
import re
import sys
import urllib.request
from typing import Optional

# Playwright imported lazily - only needed for page-scrape fallback; API path uses none
CARELINK_URL = "https://carelink.minimed.eu"
CARELINK_US = "https://carelink.minimed.com"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_COOKIE_FILE = os.path.join(SCRIPT_DIR, "carelink-cookies.json")
DASHBOARD_API_PATH = "/connect/monitor/v2/dashboard"


def load_cookies(path: str) -> list:
    """Load cookies from Cookie-Editor JSON export. Convert to Playwright format."""
    with open(path, "r", encoding="utf-8") as f:
        raw = json.load(f)

    if not isinstance(raw, list):
        raw = [raw]

    out = []
    for c in raw:
        name = c.get("name") or c.get("cookieName")
        value = c.get("value") or c.get("cookieValue")
        domain = c.get("domain", "")
        path = c.get("path", "/")
        if not name or not value or not domain:
            continue
        pw = {"name": name, "value": str(value), "domain": domain, "path": path}
        if c.get("secure"):
            pw["secure"] = True
        if c.get("httpOnly"):
            pw["httpOnly"] = True
        if c.get("expirationDate"):
            pw["expires"] = c["expirationDate"]
        if c.get("sameSite"):
            ss = str(c["sameSite"]).lower()
            if ss in ("none", "no_restriction", "no restriction", "unspecified"):
                pw["sameSite"] = "None"
            elif ss == "strict":
                pw["sameSite"] = "Strict"
            else:
                pw["sameSite"] = "Lax"
        out.append(pw)

    return out


def load_cookies_for_requests(path: str):
    """Load cookies and return (cookie_header, auth_token, region)."""
    with open(path, "r", encoding="utf-8") as f:
        raw = json.load(f)
    if not isinstance(raw, list):
        raw = [raw]
    auth_token = None
    cookie_parts = []
    region = "eu"  # default EU
    for c in raw:
        name = c.get("name") or c.get("cookieName")
        value = c.get("value") or c.get("cookieValue")
        domain = c.get("domain", "")
        if not name or not value or not domain:
            continue
        if "minimed.com" in domain and "minimed.eu" not in domain:
            region = "us"
        if name == "auth_tmp_token":
            auth_token = str(value)
        cookie_parts.append(f"{name}={value}")
    return "; ".join(cookie_parts), auth_token, region


def fetch_dashboard_api(cookie_path: str, json_output: bool) -> Optional[dict]:
    """Try to fetch real-time BG from monitor v2 dashboard API. Returns result dict or None."""
    try:
        cookie_header, auth_token, region = load_cookies_for_requests(cookie_path)
    except Exception as e:
        if json_output:
            print(json.dumps({"ok": False, "error": str(e)}))
        return None
    # Try carelink first, then clcloud (EU web app may use clcloud for API)
    bases = [CARELINK_URL, "https://clcloud.minimed.eu"] if region != "us" else [CARELINK_US, "https://clcloud.minimed.com"]
    headers = {
        "Accept": "application/json",
        "User-Agent": "CareLinkConnect/1.2.0 (iPhone; iOS 15.0; Scale/3.00)",
        "Cookie": cookie_header,
        "Role": "carepartner",  # Required for Follower stream (not delayed Patient reports)
    }
    if auth_token:
        headers["Authorization"] = f"Bearer {auth_token}"
    last_error = None
    for base in bases:
        url = base + DASHBOARD_API_PATH
        req = urllib.request.Request(url, headers=headers, method="GET")
        try:
            with urllib.request.urlopen(req, timeout=15) as r:
                data = json.loads(r.read().decode())
            break
        except urllib.error.HTTPError as e:
            last_error = f"API {e.code}"
            if e.code in (401, 403):
                # Direct HTTP fails: EU API may reject non-browser requests.
                # Fall through to Playwright (real browser with same-origin fetch).
                continue
            continue
        except Exception as e:
            last_error = str(e)
            continue
    else:
        return None
    TREND_MAP = {"NONE": "FLAT", "UP": "UP", "DOWN": "DOWN", "UP_UP": "UP_DOUBLE", "DOWN_DOWN": "DOWN_DOUBLE", "FLAT": "FLAT"}
    last_sg = data.get("lastSG") or {}
    sg = last_sg.get("sg")
    if sg is not None:
        dt = last_sg.get("datetime", "")
        trend = TREND_MAP.get(last_sg.get("trendArrow", ""), "FLAT")
        return {"ok": True, "glucose": float(sg), "timestamp": dt, "trend": trend, "method": "api"}
    return None


def _get_opt(argv: list, opt: str) -> Optional[str]:
    """Get value for --opt=value from argv."""
    for a in argv:
        if a.startswith(opt + "="):
            return a.split("=", 1)[1]
    return None


async def main():
    argv = [a for a in sys.argv[1:] if a.startswith("--")]
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    cookie_path = args[0] if args else DEFAULT_COOKIE_FILE
    headless = "--headless" in argv or "--json" in argv
    json_output = "--json" in argv
    do_post = "--post" in argv
    patient_id = _get_opt(argv, "--patient-id")

    if not os.path.exists(cookie_path):
        if json_output:
            print(json.dumps({"ok": False, "error": f"Cookie file not found: {cookie_path}"}))
        else:
            print("Cookie file not found:", cookie_path)
            print("\nSteps:\n  1. Log in to CareLink in NORMAL Edge (no batch file)")
            print("  2. Install 'Cookie-Editor' extension from Chrome Web Store")
            print("  3. On CareLink dashboard: Cookie-Editor > Export > JSON")
            print("  4. Save as:", cookie_path, "\n  5. Run this script again")
        sys.exit(1)

    try:
        cookies = load_cookies(cookie_path)
    except Exception as e:
        if json_output:
            print(json.dumps({"ok": False, "error": str(e)}))
        else:
            print("Error reading cookies:", e)
        sys.exit(1)

    if not cookies:
        if json_output:
            print(json.dumps({"ok": False, "error": "No valid cookies. Re-export from Cookie-Editor."}))
        else:
            print("No valid cookies found in file. Re-export from Cookie-Editor.")
        sys.exit(1)

    if not json_output:
        print("CareLink Scraper (cookie mode)")
        print("=" * 40)
        print(f"Using {len(cookies)} cookies from {cookie_path}")
        print()

    # 1) Try direct HTTP API first (no browser)
    api_result = fetch_dashboard_api(cookie_path, json_output)
    if api_result and api_result.get("glucose") is not None:
        bg_value = str(int(api_result["glucose"]))
        timestamp = api_result.get("timestamp") or ""
        trend = api_result.get("trend", "FLAT")
        if do_post:
            try:
                import datetime as dtmod
                api_url = "http://localhost:3001/api/readings"
                payload = {
                    "glucose_value": float(bg_value),
                    "trend": trend,
                    "timestamp": timestamp or dtmod.datetime.utcnow().isoformat() + "Z"
                }
                req = urllib.request.Request(
                    api_url,
                    data=json.dumps(payload).encode(),
                    method="POST",
                    headers={"Content-Type": "application/json"}
                )
                with urllib.request.urlopen(req, timeout=5) as r:
                    pass
                if not json_output:
                    print(f"Posted BG {bg_value} mg/dL (from API) to app")
            except Exception as e:
                if not json_output:
                    print(f"Could not post to app: {e}")
        if json_output:
            out = {"ok": True, "glucose": float(bg_value), "trend": trend, "method": "api"}
            if timestamp:
                out["timestamp"] = timestamp
            print(json.dumps(out))
        else:
            print(f"Real-time API: BG {bg_value} mg/dL")
        return

    # 2) Fall back to Playwright page scraping (older/cached data)
    if not json_output:
        print("API unavailable, falling back to page scrape...")
        print()

    try:
        from playwright.async_api import async_playwright
    except ImportError:
        err = "API returned no data. Re-export cookies from CareLink, or install playwright for fallback: pip install playwright"
        if json_output:
            print(json.dumps({"ok": False, "error": err}))
        else:
            print(err)
        sys.exit(1)

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            channel="msedge",
            headless=headless,
            args=["--disable-blink-features=AutomationControlled"],
        )
        context = await browser.new_context(
            viewport={"width": 1280, "height": 800},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
        )
        await context.add_cookies(cookies)
        page = await context.new_page()

        # Intercept API: add CareLink Connect mobile headers - server returns report data for Web UA
        async def add_mobile_headers(route):
            headers = dict(route.request.headers)
            headers["User-Agent"] = "CareLinkConnect/1.2.0 (iPhone; iOS 15.0; Scale/3.00)"
            headers["Role"] = "carepartner"
            headers["Accept"] = "application/json"
            await route.continue_(headers=headers)

        await page.route("**/monitor/v2/dashboard*", add_mobile_headers)
        await page.route("**/v13/display/message*", add_mobile_headers)

        await page.goto(CARELINK_URL, wait_until="networkidle", timeout=20000)
        await page.wait_for_timeout(3000)  # Wait for Angular/dynamic content to render

        # Try in-page fetch: v13 display/message first (real-time Care Partner), then monitor v2 dashboard
        try:
            api_data = await page.evaluate("""async (patientId) => {
                // 1) v13 display/message on clcloud - real-time (xDrip uses this)
                if (patientId) {
                    try {
                        const r = await fetch('https://clcloud.minimed.eu/connect/carepartner/v13/display/message', {
                            method: 'POST',
                            credentials: 'include',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ role: 'carepartner', patientId, appVersion: '3.6.0' })
                        });
                        if (r.ok) {
                            const d = await r.json();
                            const data = d.patientData || d;
                            if (data && data.lastSG && data.lastSG.sg != null) return { ...data, _method: 'api-v13' };
                        }
                    } catch (e) {}
                }
                // 2) monitor v2 dashboard with Role: carepartner (real-time Follower stream)
                const urls = ['/connect/monitor/v2/dashboard', '/app/connect/monitor/v2/dashboard'];
                const headers = { 'Role': 'carepartner', 'Accept': 'application/json' };
                for (const url of urls) {
                    try {
                        const r = await fetch(url, { credentials: 'include', headers });
                        if (r.ok) {
                            const d = await r.json();
                            if (d && d.lastSG && d.lastSG.sg != null) return { ...d, _method: 'api-monitor-v2' };
                        }
                    } catch (e) {}
                }
                return null;
            }""", patient_id or "")
            if api_data and api_data.get("lastSG", {}).get("sg") is not None:
                last_sg = api_data["lastSG"]
                sg = float(last_sg["sg"])
                dt = last_sg.get("datetime", "")
                trend_map = {"NONE": "FLAT", "UP": "UP", "DOWN": "DOWN", "UP_UP": "UP_DOUBLE", "DOWN_DOWN": "DOWN_DOUBLE", "FLAT": "FLAT"}
                trend = trend_map.get(last_sg.get("trendArrow", ""), "FLAT")
                if not json_output:
                    print("Got real-time data from dashboard API (in-page fetch)")
                if do_post:
                    try:
                        import datetime as dtmod
                        api_url = "http://localhost:3001/api/readings"
                        payload = {"glucose_value": sg, "trend": trend, "timestamp": dt or dtmod.datetime.utcnow().isoformat() + "Z"}
                        req = urllib.request.Request(api_url, data=json.dumps(payload).encode(), method="POST", headers={"Content-Type": "application/json"})
                        with urllib.request.urlopen(req, timeout=5):
                            pass
                    except Exception:
                        pass
                if json_output:
                    out = {"ok": True, "glucose": sg, "trend": trend, "method": api_data.get("_method", "api-page"), "timestamp": dt or ""}
                    # Warn if reading appears old (report data is ~2h delayed)
                    if dt:
                        try:
                            from datetime import datetime, timezone
                            ts = datetime.fromisoformat(dt.replace("Z", "+00:00"))
                            age_min = (datetime.now(timezone.utc) - ts).total_seconds() / 60
                            if age_min > 60:
                                out["note"] = f"Reading is {int(age_min)}min old - may be report data (2h delay)"
                        except Exception:
                            pass
                    print(json.dumps(out))
                else:
                    print(f"BG: {int(sg)} mg/dL")
                await browser.close()
                return
        except Exception:
            pass

        # Check if we got redirected to login
        if "login" in page.url.lower() or "signin" in page.url.lower():
            if json_output:
                print(json.dumps({"ok": False, "error": "Session expired. Re-export cookies."}))
            else:
                print("Session expired or invalid. Re-export cookies after logging in again.")
            await browser.close()
            sys.exit(1)

        try:
            text = await page.evaluate("() => document.body.innerText")
            content = await page.content()
        except Exception as e:
            if json_output:
                print(json.dumps({"ok": False, "error": str(e)}))
            else:
                print("Could not read page:", e)
            await browser.close()
            sys.exit(1)

        # Find BG values - EU uses mmol/L (e.g. 5.2, 6.8, 6), US uses mg/dL (e.g. 94, 120)
        mgdl_pattern = re.compile(r"\b(\d{2,3})\s*(?:mg/dL|mg/dl)?\b")
        mmol_pattern = re.compile(r"\b(\d{1,2}(?:[.,]\d)?)\s*(?:mmol|mmol/L)?\b", re.I)
        mgdl_candidates = [n for n in mgdl_pattern.findall(text) if 40 <= int(n) <= 400]
        mmol_candidates = []
        for m in mmol_pattern.findall(text):
            m = m.replace(",", ".")
            try:
                v = float(m)
                if 2.0 <= v <= 30.0:
                    mmol_candidates.append(m)
            except ValueError:
                pass

        selectors_to_try = [
            '[class*="glucose"]', '[class*="bg"]', '[class*="sg"]', '[id*="glucose"]', '[id*="sg"]',
            '[data-testid*="glucose"]', '[aria-label*="glucose"]', '[class*="reading"]',
            '.current-value', '.reading-value', '[class*="current"]', '[class*="value"]',
            'span[class*="number"]', 'div[class*="number"]'
        ]
        found_readings = []
        for sel in selectors_to_try:
            try:
                elements = await page.query_selector_all(sel)
                for el in elements:
                    val = await el.inner_text()
                    if val:
                        v = val.strip().replace(",", ".")
                        if re.match(r"^\d{1,2}[.,]?\d*$", v):
                            try:
                                f = float(v)
                                if 2.0 <= f <= 30.0:
                                    found_readings.append((sel, v))
                                elif 40 <= f <= 400:
                                    found_readings.append((sel, str(int(f))))
                            except ValueError:
                                pass
            except Exception:
                pass

        bg_value = None
        is_mmol = False
        if found_readings:
            bg_value = found_readings[0][1]
            try:
                f = float(bg_value.replace(",", "."))
                is_mmol = 2.0 <= f <= 30.0
            except ValueError:
                pass
        elif mmol_candidates:
            bg_value = mmol_candidates[-1]
            is_mmol = True
        elif mgdl_candidates:
            bg_value = mgdl_candidates[-1]

        # Convert mmol to mg/dL for storage (app expects mg/dL)
        if bg_value and is_mmol:
            try:
                bg_value = str(round(float(bg_value.replace(",", ".")) * 18.0182))
            except (ValueError, TypeError):
                pass

        if not json_output:
            print("Results:")
            print("-" * 40)
            if mgdl_candidates or mmol_candidates:
                print("mg/dL candidates:", mgdl_candidates[:5], "| mmol candidates:", mmol_candidates[:5])
            if found_readings:
                print("From elements:", found_readings[:5])
            if not mgdl_candidates and not mmol_candidates and not found_readings:
                print("No BG value found. Saving page to carelink-page.html")
                with open(os.path.join(SCRIPT_DIR, "carelink-page.html"), "w", encoding="utf-8") as f:
                    f.write(content)

        if bg_value and do_post:
            try:
                import urllib.request
                api_url = "http://localhost:3001/api/readings"
                data = json.dumps({
                    "glucose_value": float(bg_value),
                    "trend": "FLAT",
                    "timestamp": __import__("datetime").datetime.utcnow().isoformat() + "Z"
                }).encode()
                req = urllib.request.Request(api_url, data=data, method="POST",
                    headers={"Content-Type": "application/json"})
                with urllib.request.urlopen(req, timeout=5) as r:
                    print(f"Posted BG {bg_value} to app")
            except Exception as e:
                print(f"Could not post to app (is it running?): {e}")

        if json_output:
            try:
                glucose = float(bg_value) if bg_value else None
            except (ValueError, TypeError):
                glucose = None
            result = {"ok": True, "glucose": glucose}
            if not bg_value:
                result["ok"] = False
                result["error"] = "No BG value found"
            print(json.dumps(result))
        else:
            print()
            input("Press Enter to close browser...")
        await browser.close()


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
