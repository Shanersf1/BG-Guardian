const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const storage = require('./storage.cjs');

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const SCRIPT_DIR = path.join(__dirname, '..', 'scripts');
const DEXCOM_SCRIPT = path.join(SCRIPT_DIR, 'dexcom_fetch.py');

/**
 * Fetch glucose from Dexcom Share API via pydexcom (Python).
 * Returns normalized reading in same format as CareLink.
 */
async function fetchDexcom() {
    if (!fs.existsSync(DEXCOM_SCRIPT)) {
        throw new Error('Dexcom fetch script not found. Install Python and run: pip install -r scripts/requirements-alerts.txt');
    }

    const config = storage.getConfig();
    if (!config.dexcom_username || !config.dexcom_password) {
        throw new Error('Dexcom credentials not configured. Set up Dexcom in Connect settings.');
    }

    const pyCmd = process.platform === 'win32' ? 'py' : 'python3';
    return new Promise((resolve, reject) => {
        const env = { ...process.env, DEXCOM_CONFIG: CONFIG_FILE };
        const proc = spawn(pyCmd, [DEXCOM_SCRIPT], {
            env,
            cwd: path.join(__dirname, '..'),
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (d) => { stdout += d.toString(); });
        proc.stderr.on('data', (d) => { stderr += d.toString(); });

        proc.on('close', (code) => {
            if (code !== 0) {
                try {
                    const errObj = JSON.parse(stderr || stdout);
                    return reject(new Error(errObj.error || stderr || 'Dexcom fetch failed'));
                } catch {
                    return reject(new Error(stderr || stdout || 'Dexcom fetch failed'));
                }
            }

            try {
                const data = JSON.parse(stdout);
                const reading = {
                    glucose_value: data.glucose_value,
                    timestamp: data.timestamp,
                    trend: data.trend || 'FLAT',
                };
                storage.addReading(reading);
                resolve({
                    success: true,
                    reading,
                    glucose: data.glucose_value,
                    trend: reading.trend,
                    method: 'dexcom-share',
                });
            } catch (e) {
                reject(new Error('Failed to parse Dexcom response'));
            }
        });

        proc.on('error', (err) => {
            if (err.code === 'ENOENT') {
                reject(new Error('Python not found. Install Python and run: pip install pydexcom'));
            } else {
                reject(err);
            }
        });
    });
}

module.exports = { fetchDexcom };
