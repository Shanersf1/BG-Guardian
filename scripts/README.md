# CareLink Scraper Test

Test scraping CareLink web data **before** modifying the app.

## Setup

```bash
cd C:\Users\Shane\Downloads\bg-guardian-link\scripts
pip install playwright
playwright install chromium
```

## Run

```bash
python carelink-scraper-test.py
```

1. Browser opens → log in with your Care Partner credentials
2. Solve CAPTCHA if shown
3. Go to the page where you see the current BG
4. Switch to the terminal and press **Enter**
5. Script searches the page for BG-like values and prints what it finds

## If you're in UK/EU

Edit the script and change:

```python
CARELINK_URL = "https://carelink.minimed.eu"
```

(or try `https://clcloud.minimed.eu` if the other doesn't work)

## Next steps

- If it finds the BG: we can integrate this into the app
- If not: it saves `carelink-page.html` so you can inspect the page structure and we can adjust the selectors
