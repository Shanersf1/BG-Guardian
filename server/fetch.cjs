const storage = require('./storage.cjs');
const { fetchCareLink } = require('./carelink.cjs');
const { fetchDexcom } = require('./dexcom.cjs');
const { checkAlerts } = require('./alertService.cjs');

/**
 * Fetch glucose from the configured CGM source (Medtronic or Dexcom).
 * Checks alerts after a successful fetch.
 */
async function fetchCGM() {
    const config = storage.getConfig();
    const source = config.cgm_source || 'medtronic';

    let result;
    if (source === 'dexcom') {
        result = await fetchDexcom();
    } else {
        result = await fetchCareLink();
    }

    // Check for alerts (low, high, rapid rise/fall) and trigger audio if enabled
    if (result && result.reading) {
        checkAlerts(result.reading);
    }

    return result;
}

module.exports = { fetchCGM };
