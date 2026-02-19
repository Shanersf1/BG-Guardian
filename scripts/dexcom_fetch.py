#!/usr/bin/env python3
"""
Fetch glucose readings from Dexcom Share API using pydexcom.
Reads config from JSON file (path in DEXCOM_CONFIG env or stdin).
Outputs reading as JSON to stdout, or error to stderr and exits non-zero.
"""
import json
import os
import sys
from datetime import datetime

# Map Dexcom trend strings to our internal format (same as CareLink)
TREND_MAP = {
    'Flat': 'FLAT',
    'NotComputable': 'FLAT',
    'DoubleUp': 'UP_DOUBLE',
    'SingleUp': 'UP',
    'FortyFiveUp': 'UP',
    'FortyFiveDown': 'DOWN',
    'SingleDown': 'DOWN',
    'DoubleDown': 'DOWN_DOUBLE',
}


def main():
    config_path = os.environ.get('DEXCOM_CONFIG')
    if not config_path or not os.path.exists(config_path):
        print(json.dumps({'error': 'DEXCOM_CONFIG path not set or file not found'}), file=sys.stderr)
        sys.exit(1)

    with open(config_path, 'r', encoding='utf-8') as f:
        config = json.load(f)

    username = config.get('dexcom_username', '').strip()
    password = config.get('dexcom_password', '')
    region = 'ous' if config.get('dexcom_ous', True) else 'us'

    if not username or not password:
        print(json.dumps({'error': 'Dexcom username and password required'}), file=sys.stderr)
        sys.exit(1)

    try:
        from pydexcom import Dexcom
    except ImportError:
        print(json.dumps({'error': 'pydexcom not installed. Run: pip install pydexcom'}), file=sys.stderr)
        sys.exit(1)

    try:
        dexcom = Dexcom(username=username, password=password, region=region)
        reading = dexcom.get_current_glucose_reading()
        if reading is None:
            # Try latest within 24h
            reading = dexcom.get_latest_glucose_reading()
        if reading is None:
            print(json.dumps({'error': 'No glucose reading available from Dexcom'}), file=sys.stderr)
            sys.exit(1)

        # Normalize to our format (glucose_value in mg/dL, trend, timestamp ISO)
        dt = reading.datetime
        if hasattr(dt, 'isoformat'):
            ts = dt.isoformat()
        else:
            ts = datetime.now().isoformat()

        trend_dir = getattr(reading, 'trend_direction', 'Flat') or 'Flat'
        trend = TREND_MAP.get(trend_dir, 'FLAT')

        out = {
            'glucose_value': int(reading.value),
            'timestamp': ts,
            'trend': trend,
        }
        print(json.dumps(out))
    except Exception as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
