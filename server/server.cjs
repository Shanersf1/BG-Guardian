const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const storage = require('./storage.cjs');
const { fetchCGM } = require('./fetch.cjs');
const { checkStaleAlert } = require('./alertService.cjs');

const MGDL_TO_MMOL = 1 / 18.0182;

function toMmol(mgdl) {
    if (mgdl == null || isNaN(mgdl)) return null;
    return Math.round(mgdl * MGDL_TO_MMOL * 10) / 10;
}

/** Returns { alert, alert_type, alert_message } for the latest reading. Uses mmol for threshold comparison when unit is mmol. */
function getAlertForLatestReading(readings, settings) {
    const none = { alert: false, alert_type: null, alert_message: null };
    if (!readings?.length || !settings) return none;

    const latest = readings[0];
    const unit = settings.bg_unit || 'mmol';
    const displayVal = unit === 'mmol' ? toMmol(latest.glucose_value) : Number(latest.glucose_value);
    if (displayVal == null || isNaN(displayVal)) return none;

    const userName = (settings.user_name || 'User').trim() || 'User';
    const valueStr = String(displayVal);
    const low = settings.low_threshold ?? (unit === 'mmol' ? 3.9 : 70);
    const high = settings.high_threshold ?? (unit === 'mmol' ? 10 : 180);

    let alertType = null;

    if (settings.low_alert_enabled !== false && displayVal < low) {
        alertType = 'low';
    } else if (settings.high_alert_enabled !== false && displayVal > high) {
        alertType = 'high';
    }

    if (!alertType && (settings.rapid_rise_enabled || settings.rapid_fall_enabled)) {
        const now = new Date(latest.timestamp).getTime();
        const fifteenMinAgo = now - 15 * 60 * 1000;
        const oldReading = readings.find((r) => new Date(r.timestamp).getTime() <= fifteenMinAgo);
        if (oldReading) {
            const oldVal = unit === 'mmol' ? toMmol(oldReading.glucose_value) : Number(oldReading.glucose_value);
            if (oldVal != null && !isNaN(oldVal)) {
                const diff = displayVal - oldVal;
                const riseThresh = settings.rapid_rise_threshold ?? 1.7;
                const fallThresh = settings.rapid_fall_threshold ?? 1.7;
                if (settings.rapid_rise_enabled !== false && diff >= riseThresh) alertType = 'rapid_rise';
                else if (settings.rapid_fall_enabled !== false && diff <= -fallThresh) alertType = 'rapid_fall';
            }
        }
    }

    if (!alertType) return none;

    const messages = {
        low: `Hey ${userName}, your blood sugar is low. Current reading is ${valueStr}. Please check your glucose.`,
        high: `Hey ${userName}, your blood sugar is high. Current reading is ${valueStr}. Please check your glucose.`,
        rapid_rise: `Hey ${userName}, your blood sugar is rising quickly. Please check your glucose.`,
        rapid_fall: `Hey ${userName}, your blood sugar is falling quickly. Please check your glucose.`,
    };

    return {
        alert: true,
        alert_type: alertType,
        alert_message: messages[alertType] || `Hey ${userName}, glucose alert. Please check your glucose.`,
    };
}

let pushService = null;
try {
    pushService = require('./pushService.cjs');
} catch (e) {
    console.warn('[Server] Push service unavailable:', e.message);
}

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// API: Readings - adds alert, alert_type, alert_message to latest reading when threshold crossed (for native app TTS)
app.get('/api/readings', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const readings = storage.getReadings(limit);
    const settings = storage.getSettings();
    const { alert, alert_type, alert_message } = getAlertForLatestReading(readings, settings);

    const alertVolume = Math.max(0, Math.min(1, Number(settings?.alert_volume) || 1));

    const enriched = readings.map((r, i) => {
        if (i === 0) {
            return {
                ...r,
                alert,
                alert_type: alert ? alert_type : undefined,
                alert_message: alert ? alert_message : undefined,
                alert_volume: alert ? alertVolume : undefined
            };
        }
        return { ...r, alert: false };
    });

    res.json(enriched);
});

app.post('/api/readings', (req, res) => {
    try {
        const { glucose_value, trend, active_insulin, pump_battery, sensor_duration } = req.body;
        const reading = storage.addReading({
            glucose_value: parseFloat(glucose_value),
            trend: trend || 'FLAT',
            active_insulin: active_insulin != null ? parseFloat(active_insulin) : undefined,
            pump_battery: pump_battery != null ? parseFloat(pump_battery) : undefined,
            sensor_duration: sensor_duration != null ? parseFloat(sensor_duration) : undefined,
            timestamp: new Date().toISOString()
        });
        const { checkAlerts } = require('./alertService.cjs');
        checkAlerts(reading);
        res.json(reading);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// API: Settings
app.get('/api/settings', (req, res) => {
    const settings = storage.getSettings();
    res.json(settings || {
        bg_unit: 'mmol',
        high_threshold: 10,
        low_threshold: 3.9,
        rapid_rise_threshold: 1.7,
        rapid_fall_threshold: 1.7,
        high_alert_enabled: true,
        low_alert_enabled: true,
        rapid_rise_enabled: true,
        rapid_fall_enabled: true,
        stale_data_enabled: true,
        alert_email: '',
        user_name: '',
        audio_alerts_enabled: false,
        alert_volume: 1
    });
});

app.post('/api/settings', (req, res) => {
    try {
        storage.saveSettings(req.body);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// API: Config (CareLink + Dexcom + CGM source)
app.get('/api/config', (req, res) => {
    const config = storage.getConfig();
    const cgmSource = config.cgm_source || 'medtronic';
    const oauthConfigured = !!(config.access_token && config.refresh_token);
    const nightscoutConfigured = !!(config.carelink_username && config.carelink_password);
    let cookiePath = config.carelink_cookie_file || 'scripts/carelink-cookies.json';
    if (!path.isAbsolute(cookiePath)) cookiePath = path.join(__dirname, '..', cookiePath);
    const cookieConfigured = !!(config.carelink_cookie_enabled && fs.existsSync(cookiePath));
    const dexcomConfigured = !!(config.dexcom_username && config.dexcom_password);
    const anyConfigured = (cgmSource === 'medtronic' && (oauthConfigured || nightscoutConfigured || cookieConfigured))
        || (cgmSource === 'dexcom' && dexcomConfigured);
    res.json({
        cgm_source: cgmSource,
        configured: anyConfigured,
        dexcomConfigured,
        dexcom_username: config.dexcom_username || '',
        dexcom_password: config.dexcom_password || '',
        dexcom_ous: config.dexcom_ous !== false,
        hasClientCredentials: !!(config.client_id && config.client_secret),
        oauthConfigured,
        nightscoutConfigured,
        cookieConfigured,
        carelink_cookie_enabled: !!config.carelink_cookie_enabled,
        carelink_cookie_file: config.carelink_cookie_file || 'scripts/carelink-cookies.json',
        carelink_nightscout_connect_mode: !!config.carelink_nightscout_connect_mode,
        access_token: config.access_token || '',
        refresh_token: config.refresh_token || '',
        mag_identifier: config.mag_identifier || '',
        client_id: config.client_id || '',
        client_secret: config.client_secret || '',
        token_url: config.token_url || '',
        country: config.country || 'gb',
        carelink_username: config.carelink_username || '',
        carelink_password: config.carelink_password || '',
        carelink_patient_id: config.carelink_patient_id || '',
    });
});

app.post('/api/config', (req, res) => {
    try {
        const body = req.body || {};
        const {
            cgm_source,
            access_token, refresh_token, mag_identifier, client_id, client_secret, token_url, country,
            carelink_username, carelink_password, carelink_patient_id,
            carelink_cookie_enabled, carelink_cookie_file, carelink_nightscout_connect_mode,
            dexcom_username, dexcom_password, dexcom_ous
        } = body;
        const config = storage.getConfig();

        const updates = { ...config, country: country ?? config.country ?? 'gb' };

        if (cgm_source !== undefined) updates.cgm_source = cgm_source === 'dexcom' ? 'dexcom' : 'medtronic';
        if (access_token !== undefined) updates.access_token = access_token;
        if (refresh_token !== undefined) updates.refresh_token = refresh_token;
        if (mag_identifier !== undefined) updates.mag_identifier = mag_identifier;
        if (client_id !== undefined) updates.client_id = client_id || '';
        if (client_secret !== undefined) updates.client_secret = client_secret || '';
        if (token_url !== undefined) updates.token_url = token_url || '';

        if (access_token && refresh_token && (mag_identifier || (token_url && client_id))) {
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 1);
            updates.token_expires = expiresAt.toISOString();
        }

        if (carelink_username !== undefined) updates.carelink_username = carelink_username;
        if (carelink_password !== undefined) updates.carelink_password = carelink_password;
        if (carelink_patient_id !== undefined) updates.carelink_patient_id = carelink_patient_id;
        if (carelink_cookie_enabled !== undefined) updates.carelink_cookie_enabled = Boolean(carelink_cookie_enabled);
        if (carelink_cookie_file !== undefined) updates.carelink_cookie_file = carelink_cookie_file;
        if (carelink_nightscout_connect_mode !== undefined) updates.carelink_nightscout_connect_mode = Boolean(carelink_nightscout_connect_mode);

        if (dexcom_username !== undefined) updates.dexcom_username = dexcom_username;
        if (dexcom_password !== undefined) updates.dexcom_password = dexcom_password;
        if (dexcom_ous !== undefined) updates.dexcom_ous = dexcom_ous !== false;

        storage.saveConfig(updates);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// API: Web Push - public key for subscription
app.get('/api/push-public-key', (req, res) => {
    if (!pushService) {
        return res.status(503).json({ error: 'Push service not available. Run: npm install web-push' });
    }
    try {
        res.json({ publicKey: pushService.getPublicKey() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API: Web Push - subscribe (store subscription for sending alerts)
app.post('/api/push-subscribe', (req, res) => {
    if (!pushService) {
        return res.status(503).json({ error: 'Push service not available. Run: npm install web-push' });
    }
    try {
        const subscription = req.body;
        if (!subscription?.endpoint) {
            return res.status(400).json({ error: 'Invalid subscription' });
        }
        pushService.addSubscription(subscription);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// API: Web Push - unsubscribe (remove subscription)
const handlePushUnsubscribe = (req, res) => {
    if (!pushService) {
        return res.status(503).json({ error: 'Push service not available' });
    }
    try {
        const { endpoint } = req.body || {};
        if (!endpoint) {
            return res.status(400).json({ error: 'Missing endpoint' });
        }
        pushService.removeSubscription(endpoint);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};
app.post('/api/push-unsubscribe', handlePushUnsubscribe);
app.delete('/api/push-subscribe', handlePushUnsubscribe);

// API: Fetch from configured CGM source (Medtronic or Dexcom)
app.post('/api/fetch-carelink', async (req, res) => {
    try {
        const result = await fetchCGM();
        res.json(result);
    } catch (err) {
        const msg = err.message || String(err);
        console.error('CGM fetch error:', msg);
        res.status(400).json({
            success: false,
            error: msg
        });
    }
});

// Serve built frontend when dist exists (after npm run build)
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(path.join(distPath, 'index.html'))) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
    });
} else {
    app.get('/', (req, res) => {
        res.type('html').send('API only. Run <code>npm run dev</code> and open <a href="http://localhost:5173">http://localhost:5173</a> for the app.');
    });
}

// Auto-fetch from configured CGM source every 5 minutes
const FETCH_INTERVAL_MS = 5 * 60 * 1000;
const cookiePath = path.join(__dirname, '../scripts/carelink-cookies.json');
setInterval(async () => {
    const config = storage.getConfig();
    const source = config.cgm_source || 'medtronic';
    let canFetch = false;
    if (source === 'dexcom') {
        canFetch = !!(config.dexcom_username && config.dexcom_password);
    } else {
        const cp = config.carelink_cookie_file || cookiePath;
        canFetch = (config.access_token && config.refresh_token) ||
            (config.carelink_username && config.carelink_password) ||
            (config.carelink_cookie_enabled && fs.existsSync(cp));
    }
    if (canFetch) {
        try {
            await fetchCGM();
            console.log(`[Scheduler] ${source} fetch successful`);
        } catch (err) {
            console.error(`[Scheduler] ${source} fetch failed:`, err.message);
        }
    }
}, FETCH_INTERVAL_MS);

// Stale data alert check every 10 minutes
setInterval(() => {
    checkStaleAlert();
}, 10 * 60 * 1000);

app.listen(PORT, '0.0.0.0', () => {
    // Change localhost to 0.0.0.0 in the log so you know it's public
    console.log(`BG Guardian Link server running on http://0.0.0.0:${PORT}`);
    console.log(`Auto-fetch from CGM every 5 minutes`);
});