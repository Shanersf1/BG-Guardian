#!/usr/bin/env python3
"""
CareLink scraper - connects to YOUR already-open Edge browser.

WORKFLOW:
1. Run: start-edge-for-carelink.bat   (launches Edge with debugging)
2. In Edge: Menu (...) > New InPrivate window
3. In InPrivate window: go to carelink.minimed.eu and log in (CAPTCHA usually works)
4. Run: python carelink-scraper-test.py   (connects to your browser, scrapes BG)
"""

import asyncio
import re
import socket
import sys

try:
    from playwright.async_api import async_playwright
except ImportError:
    print("Install playwright: pip install playwright")
    sys.exit(1)

CARELINK_URL = "https://carelink.minimed.eu"
CDP_URL = "http://127.0.0.1:9222"
CDP_PORT = 9222


def check_edge_listening() -> bool:
    """Return True if something is listening on the CDP port."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(1)
            s.connect(("127.0.0.1", CDP_PORT))
            return True
    except (socket.error, OSError):
        return False


async def main():
    print("CareLink Scraper - Connect Mode")
    print("=" * 40)
    print()

    if not check_edge_listening():
        print("Edge with debugging is NOT running on port 9222.")
        print()
        print("Run this FIRST (in a separate terminal or File Explorer):")
        print("  .\\scripts\\start-edge-for-carelink.bat")
        print()
        print("Then: log in to CareLink in the Edge window that opens.")
        print("Then: run this script again.")
        sys.exit(1)

    print("Edge detected. Log in to CareLink if needed.")
    print()

    try:
        input("Press Enter when you're logged into CareLink...")
    except EOFError:
        pass

    async with async_playwright() as p:
        try:
            browser = await p.chromium.connect_over_cdp(CDP_URL, timeout=5000)
        except Exception as e:
            print(f"Could not connect to Edge: {e}")
            print()
            print("Make sure you ran start-edge-for-carelink.bat first.")
            print("Close any existing Edge windows, then run the batch file.")
            return

        # Find the CareLink tab
        page = None
        for ctx in browser.contexts:
            for tab in ctx.pages:
                if "carelink" in tab.url.lower() or "minimed" in tab.url.lower():
                    page = tab
                    break
            if page:
                break

        if not page:
            # Use first available page or create new
            for ctx in browser.contexts:
                if ctx.pages:
                    page = ctx.pages[0]
                    break
            if not page:
                print("No tabs found. Open CareLink in Edge and run again.")
                return

        if "carelink" not in page.url.lower():
            print(f"Current tab: {page.url}")
            print("Navigating to CareLink...")
            await page.goto(CARELINK_URL, wait_until="domcontentloaded", timeout=15000)
            print("If you need to log in, do it now. Press Enter when ready...")
            try:
                input()
            except EOFError:
                pass

        try:
            content = await page.content()
            text = await page.evaluate("() => document.body.innerText")
        except Exception as e:
            print(f"Could not read page: {e}")
            return

        # Find BG values
        bg_pattern = re.compile(r"\b(\d{2,3})\s*(?:mg/dL|mg/dl)?\b")
        numbers = bg_pattern.findall(text)
        candidates = [n for n in numbers if 40 <= int(n) <= 400]

        selectors_to_try = [
            '[class*="glucose"]', '[class*="bg"]', '[id*="glucose"]', '[id*="sg"]',
            '[data-testid*="glucose"]', '[aria-label*="glucose"]',
            '.current-value', '.reading-value', '[class*="reading"]'
        ]
        found_readings = []
        for sel in selectors_to_try:
            try:
                el = await page.query_selector(sel)
                if el:
                    val = await el.inner_text()
                    if val and val.strip().replace(".", "").isdigit():
                        found_readings.append((sel, val.strip()))
            except Exception:
                pass

        print()
        print("Results:")
        print("-" * 40)
        if candidates:
            print(f"Possible BG values: {candidates[:10]}")
        if found_readings:
            print(f"From elements: {found_readings[:5]}")
        if not candidates and not found_readings:
            print("No BG value found. Saving page to carelink-page.html")
            with open("carelink-page.html", "w", encoding="utf-8") as f:
                f.write(content)

        # Don't close browser - user owns it
        await browser.close()  # Just disconnects, doesn't kill Edge


if __name__ == "__main__":
    asyncio.run(main())
