/**
 * Fetch CareLink data using the cookie-export scraper (Python + Playwright).
 * Spawns the script and parses JSON output.
 */

const { spawn } = require('child_process');
const path = require('path');
const storage = require('./storage.cjs');

const SCRIPT_PATH = path.join(__dirname, '../scripts/carelink-scraper-cookies.py');

function fetchCareLinkCookie() {
    return new Promise((resolve, reject) => {
        const config = storage.getConfig();
        let cookiePath = config.carelink_cookie_file || 'scripts/carelink-cookies.json';
        if (!path.isAbsolute(cookiePath)) {
            cookiePath = path.join(__dirname, '..', cookiePath);
        }

        const args = [SCRIPT_PATH, cookiePath, '--json'];
        if (config.carelink_patient_id) {
            args.push(`--patient-id=${config.carelink_patient_id}`);
        }
        const pythonCmd = process.platform === 'win32' ? 'py' : 'python';
        const proc = spawn(pythonCmd, args, {
            cwd: path.join(__dirname, '..'),
            stdio: ['ignore', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (d) => { stdout += d.toString(); });
        proc.stderr.on('data', (d) => { stderr += d.toString(); });

        proc.on('close', (code) => {
            const line = stdout.trim().split('\n').pop();
            let data;
            try {
                data = line ? JSON.parse(line) : {};
            } catch {
                reject(new Error(stderr || stdout || 'Could not parse scraper output'));
                return;
            }

            if (!data.ok || data.glucose == null) {
                reject(new Error(data.error || 'No glucose data from CareLink'));
                return;
            }

            const ts = data.timestamp;
            const timestamp = (ts && typeof ts === 'string') ? ts : new Date().toISOString();
            const trend = data.trend || 'FLAT';
            const reading = {
                glucose_value: data.glucose,
                timestamp,
                trend
            };

            storage.addReading(reading);

            resolve({
                success: true,
                reading,
                glucose: data.glucose,
                trend,
                method: data.method || 'carelink-cookie-scraper'
            });
        });

        proc.on('error', (err) => {
            const hint = process.platform === 'win32' ? ' On Windows, ensure "py" works in Command Prompt.' : '';
            reject(new Error(`Could not run scraper: ${err.message}. Is Python installed?${hint}`));
        });
    });
}

module.exports = { fetchCareLinkCookie };
