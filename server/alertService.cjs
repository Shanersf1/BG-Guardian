const { spawn } = require('child_process');
const path = require('path');
const storage = require('./storage.cjs');

const MGDL_TO_MMOL = 1 / 18.0182;
let lastAlertAtMap = {};
const SCRIPT_DIR = path.join(__dirname, '..', 'scripts');
const ALERT_SCRIPT = path.join(SCRIPT_DIR, 'alert_audio.py');

function toMmol(mgdl) {
    if (mgdl == null || isNaN(mgdl)) return null;
    return Math.round(mgdl * MGDL_TO_MMOL * 10) / 10;
}

/**
 * Check if the latest reading triggers any alerts.
 * If audio alerts enabled, play beeps + TTS via Python.
 */
function checkAlerts(reading) {
    const settings = storage.getSettings();
    if (!settings) return;

    const audioEnabled = settings.audio_alerts_enabled === true;
    const userName = (settings.user_name || 'User').trim() || 'User';
    const unit = settings.bg_unit || 'mmol';
    const displayVal = unit === 'mmol' ? toMmol(reading.glucose_value) : reading.glucose_value;

    let alertType = null;

    const low = settings.low_threshold ?? (unit === 'mmol' ? 3.9 : 70);
    const high = settings.high_threshold ?? (unit === 'mmol' ? 10 : 180);

    if (settings.low_alert_enabled !== false && displayVal < low) {
        alertType = 'low';
    } else if (settings.high_alert_enabled !== false && displayVal > high) {
        alertType = 'high';
    }

    // Rapid rise/fall: compare with reading from ~15 min ago
    if (!alertType && (settings.rapid_rise_enabled || settings.rapid_fall_enabled)) {
        const readings = storage.getReadings(20);
        const now = new Date(reading.timestamp).getTime();
        const fifteenMinAgo = now - 15 * 60 * 1000;
        const oldReading = readings.find((r) => new Date(r.timestamp).getTime() <= fifteenMinAgo);
        if (oldReading) {
            const oldVal = unit === 'mmol' ? toMmol(oldReading.glucose_value) : oldReading.glucose_value;
            const diff = displayVal - oldVal;
            const riseThresh = settings.rapid_rise_threshold ?? 1.7;
            const fallThresh = settings.rapid_fall_threshold ?? 1.7;
            if (settings.rapid_rise_enabled !== false && diff >= riseThresh) {
                alertType = 'rapid_rise';
            } else if (settings.rapid_fall_enabled !== false && diff <= -fallThresh) {
                alertType = 'rapid_fall';
            }
        }
    }

    if (!alertType) return;

    // Cooldown to avoid spamming (5 min per alert type)
    const COOLDOWN_MS = 5 * 60 * 1000;
    if (!lastAlertAtMap) lastAlertAtMap = {};
    const now = Date.now();
    if ((lastAlertAtMap[alertType] || 0) + COOLDOWN_MS > now) return;
    lastAlertAtMap[alertType] = now;

    // Send push notification (works when screen is locked)
    if (audioEnabled) {
        try {
            const { sendPushToAll } = require('./pushService.cjs');
            const titles = { low: 'Low BG', high: 'High BG', rapid_rise: 'Rapid Rise', rapid_fall: 'Rapid Fall', stale: 'Stale Data' };
            sendPushToAll({
                title: titles[alertType] || 'BG Alert',
                body: alertType === 'low' || alertType === 'high'
                    ? `Hey ${userName}, your blood sugar is ${alertType}. Current reading: ${displayVal}. Please check your glucose.`
                    : `Hey ${userName}, glucose alert. Please check your glucose.`,
                tag: `bg-${alertType}`,
            }).catch((err) => console.error('[Push] Send failed:', err.message));
        } catch (e) {
            console.error('[Push] Error:', e.message);
        }
    }

    // Server-side Python audio (optional, set PLAY_SERVER_ALERTS=1)
    if (!audioEnabled || process.env.PLAY_SERVER_ALERTS !== '1') return;

    const pyCmd = process.platform === 'win32' ? 'py' : 'python3';
    try {
        const proc = spawn(pyCmd, [
            ALERT_SCRIPT,
            '--name', userName,
            '--type', alertType,
            '--value', String(displayVal),
        ], {
            cwd: path.join(__dirname, '..'),
            detached: true,
            stdio: 'ignore',
        });
        proc.unref();
    } catch (err) {
        console.error('[Alert] Failed to play audio:', err.message);
    }
}

let lastStaleAlertAt = 0;
const STALE_ALERT_COOLDOWN_MS = 30 * 60 * 1000; // Don't re-alert for 30 min

/**
 * Check for stale data alert (no reading in 20+ minutes).
 * Call periodically from scheduler, not on each fetch.
 */
function checkStaleAlert() {
    const settings = storage.getSettings();
    if (!settings || settings.stale_data_enabled === false) return;

    const readings = storage.getReadings(1);
    const latest = readings[0];
    if (!latest) return;

    const ageMs = Date.now() - new Date(latest.timestamp).getTime();
    if (ageMs < 20 * 60 * 1000) return;

    if (Date.now() - lastStaleAlertAt < STALE_ALERT_COOLDOWN_MS) return;
    lastStaleAlertAt = Date.now();

    const audioEnabled = settings.audio_alerts_enabled === true;
    const userName = (settings.user_name || 'User').trim() || 'User';
    if (!audioEnabled) return;

    // Send push for stale alert
    try {
        const { sendPushToAll } = require('./pushService.cjs');
        sendPushToAll({
            title: 'Stale Data',
            body: `Hey ${userName}, no new glucose reading. Please check your sensor.`,
            tag: 'bg-stale',
        }).catch((err) => console.error('[Push] Stale send failed:', err.message));
    } catch (e) {
        console.error('[Push] Error:', e.message);
    }

    if (process.env.PLAY_SERVER_ALERTS !== '1') return;

    const pyCmd = process.platform === 'win32' ? 'py' : 'python3';
    try {
        const proc = spawn(pyCmd, [
            ALERT_SCRIPT,
            '--name', userName,
            '--type', 'stale',
        ], {
            cwd: path.join(__dirname, '..'),
            detached: true,
            stdio: 'ignore',
        });
        proc.unref();
    } catch (err) {
        console.error('[Alert] Failed to play stale alert:', err.message);
    }
}

module.exports = { checkAlerts, checkStaleAlert };
