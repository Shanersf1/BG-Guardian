const storage = require('./storage.cjs');

/** Map dexcom-share-api trend strings to our internal format (same as CareLink). */
const TREND_MAP = {
    doubleup: 'UP_DOUBLE',
    singleup: 'UP',
    fortyfiveup: 'UP',
    flat: 'FLAT',
    fortyfivedown: 'DOWN',
    singledown: 'DOWN',
    doubledown: 'DOWN_DOUBLE',
    notcomputable: 'FLAT',
};

/**
 * Fetch glucose from Dexcom Share API via dexcom-share-api (pure Node.js).
 * Returns normalized reading in same format as CareLink.
 */
async function fetchDexcom() {
    const config = storage.getConfig();
    if (!config.dexcom_username || !config.dexcom_password) {
        throw new Error('Dexcom credentials not configured. Set up Dexcom in Connect settings.');
    }

    const server = config.dexcom_ous !== false ? 'eu' : 'us';
    const { DexcomClient } = require('dexcom-share-api');

    const client = new DexcomClient({
        username: config.dexcom_username.trim(),
        password: config.dexcom_password,
        server,
    });

    const entries = await client.getEstimatedGlucoseValues({ minutes: 1440, maxCount: 1 });
    if (!entries || entries.length === 0) {
        throw new Error('No glucose reading available from Dexcom');
    }

    const entry = entries[0];
    const trendKey = (entry.trend || 'flat').toLowerCase();
    const trend = TREND_MAP[trendKey] || 'FLAT';

    const ts = entry.timestamp;
    const timestamp = typeof ts === 'number'
        ? new Date(ts).toISOString()
        : (ts || new Date().toISOString());

    const reading = {
        glucose_value: entry.mgdl,
        timestamp,
        trend,
    };

    storage.addReading(reading);

    return {
        success: true,
        reading,
        glucose: reading.glucose_value,
        trend: reading.trend,
        method: 'dexcom-share',
    };
}

module.exports = { fetchDexcom };
