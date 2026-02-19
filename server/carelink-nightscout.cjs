/**
 * CareLink fetch using Nightscout's minimed-connect-to-nightscout approach.
 *
 * Uses form-based SSO login (no OAuth, no CAPTCHA in the flow).
 * Same approach as nightscout/minimed-connect-to-nightscout.
 *
 * Config needs: carelink_username, carelink_password, country (default gb)
 * Optional for Care Partner: carelink_patient_id
 */

const mmcns = require('minimed-connect-to-nightscout');
const storage = require('./storage.cjs');

const TREND_MAP = {
    NONE: 'FLAT',
    UP: 'UP',
    DOWN: 'DOWN',
    UP_UP: 'UP_DOUBLE',
    DOWN_UP: 'UP_DOUBLE',
    UP_TRIPLE: 'UP_DOUBLE',
    DOWN_DOWN: 'DOWN_DOUBLE',
    DOWN: 'DOWN',
    DOWN_TRIPLE: 'DOWN_DOUBLE',
    FLAT: 'FLAT',
};

/**
 * Fetch CareLink data using Nightscout's cookie-based login.
 * @returns {Promise<{ success: boolean, reading: object, glucose: number, trend: string, method: string }>}
 */
function fetchCareLinkNightscout() {
    return new Promise((resolve, reject) => {
        const config = storage.getConfig();
        if (!config.carelink_username || !config.carelink_password) {
            return reject(new Error('CareLink username/password not configured. Use Nightscout-style setup.'));
        }

        process.env.MMCONNECT_SERVER = 'EU';
        process.env.MMCONNECT_COUNTRYCODE = config.country || 'gb';

        const client = mmcns.carelink.Client({
            username: config.carelink_username,
            password: config.carelink_password,
            countrycode: config.country || 'gb',
            patientId: config.carelink_patient_id || undefined,
        });

        client.fetch((err, data) => {
            if (err) {
                return reject(new Error(err));
            }
            if (!data) {
                return reject(new Error('No data from CareLink'));
            }

            // Extract latest BG - format varies (sgs array vs lastSG object)
            let glucoseValue;
            let timestamp;
            let trend = 'FLAT';

            if (data.lastSG && data.lastSG.sg) {
                glucoseValue = data.lastSG.sg;
                timestamp = data.lastSG.datetime || new Date().toISOString();
                trend = TREND_MAP[data.lastSG.trendArrow] || 'FLAT';
            } else if (data.sgs && data.sgs.length > 0) {
                const valid = data.sgs.filter((e) => e.kind === 'SG' && e.sg > 0);
                if (valid.length === 0) {
                    return reject(new Error('No glucose data available'));
                }
                const last = valid[valid.length - 1];
                glucoseValue = last.sg;
                timestamp = last.datetime || new Date().toISOString();
                trend = TREND_MAP[data.lastSGTrend] || 'FLAT';
            } else {
                return reject(new Error('No glucose data available'));
            }

            const reading = {
                glucose_value: glucoseValue,
                timestamp,
                trend,
                active_insulin: data?.lastAlarm?.activeInsulin?.amount,
                pump_battery: data?.pumpBannerState?.batteryLevelPercent ?? data?.medicalDeviceBatteryLevelPercent,
                sensor_duration: data?.lastSensorTS?.duration ?? data?.sensorDurationHours,
            };

            storage.addReading(reading);

            resolve({
                success: true,
                reading,
                glucose: glucoseValue,
                trend,
                method: 'carelink-nightscout',
            });
        });
    });
}

module.exports = { fetchCareLinkNightscout };
