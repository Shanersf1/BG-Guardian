const fs = require('fs');
const path = require('path');
const storage = require('./storage.cjs');
const { fetchCareLinkNightscout } = require('./carelink-nightscout.cjs');
const { fetchCareLinkCookie } = require('./carelink-cookie.cjs');
const { fetchCareLinkNightscoutConnect } = require('./carelink-nightscout-connect.cjs');

const CARELINK_CONFIG_URL = 'https://clcloud.minimed.eu/connect/carepartner/v11/discover/android/3.3';
const CARELINK_HEADERS = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': 'Dalvik/2.1.0 (Linux; U; Android 10; Nexus 5X Build/QQ3A.200805.001)'
};
const MOBILE_HEADERS = {
    ...CARELINK_HEADERS,
    'User-Agent': 'CareLinkConnect/1.2.0 (iPhone; iOS 15.0; Scale/3.00)'
};

const TREND_MAP = {
    'NONE': 'FLAT',
    'UP': 'UP',
    'DOWN': 'DOWN',
    'UP_UP': 'UP_DOUBLE',
    'DOWN_DOWN': 'DOWN_DOUBLE',
    'FLAT': 'FLAT'
};

async function fetchCareLinkOAuth() {
    const config = storage.getConfig();
    if (!config.access_token || !config.refresh_token) {
        throw new Error('CareLink OAuth tokens not configured. Please set them up in CareLink Setup.');
    }

    const country = config.country || 'gb';

    const configResp = await fetch(CARELINK_CONFIG_URL, { headers: CARELINK_HEADERS });
    if (!configResp.ok) {
        throw new Error('Failed to get CareLink config');
    }
    const configData = await configResp.json();

    let region = null;
    for (const c of configData.supportedCountries) {
        if (c[country.toUpperCase()]) {
            region = c[country.toUpperCase()].region;
            break;
        }
    }
    if (!region) {
        throw new Error('Country not supported');
    }

    let carelinkConfig = null;
    for (const c of configData.CP) {
        if (c.region === region) {
            carelinkConfig = c;
            break;
        }
    }
    if (!carelinkConfig) {
        throw new Error('Failed to get region config');
    }

    const authHeaders = (h) => ({ ...h, ...(config.mag_identifier ? { 'mag-identifier': config.mag_identifier } : {}) });

    const tokenExpires = config.token_expires ? new Date(config.token_expires) : new Date(0);
    const now = new Date();
    let accessToken = config.access_token;

    if (tokenExpires <= now) {
        let tokenUrl;
        let refreshBody;
        let refreshHeaders;

        if (config.token_url && config.client_id && !config.client_secret) {
            // carelink-bridge format: public client, no Basic auth
            tokenUrl = config.token_url;
            refreshBody = new URLSearchParams({
                grant_type: 'refresh_token',
                client_id: config.client_id,
                refresh_token: config.refresh_token
            });
            refreshHeaders = { 'Content-Type': 'application/x-www-form-urlencoded' };
        } else {
            // carelink-python-client format: client_id + client_secret
            const ssoResp = await fetch(carelinkConfig.SSOConfiguration);
            const ssoConfig = await ssoResp.json();
            tokenUrl = `https://${ssoConfig.server.hostname}:${ssoConfig.server.port}/${ssoConfig.server.prefix}${ssoConfig.system_endpoints.token_endpoint_path}`;
            refreshBody = new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: config.refresh_token,
                scope: ssoConfig.oauth.client.client_ids[0].scope
            });
            refreshHeaders = {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${Buffer.from((config.client_id || '') + ':' + (config.client_secret || '')).toString('base64')}`
            };
        }

        const refreshResp = await fetch(tokenUrl, { method: 'POST', headers: refreshHeaders, body: refreshBody });

        if (!refreshResp.ok) {
            throw new Error('Failed to refresh token. Please re-authenticate in CareLink Setup.');
        }

        const refreshData = await refreshResp.json();
        accessToken = refreshData.access_token;

        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1);

        storage.saveConfig({
            ...config,
            access_token: accessToken,
            refresh_token: refreshData.refresh_token || config.refresh_token,
            token_expires: expiresAt.toISOString()
        });
    }

    const userUrl = carelinkConfig.baseUrlCareLink + '/users/me';
    const userResp = await fetch(userUrl, {
        headers: authHeaders({ ...CARELINK_HEADERS, 'Authorization': `Bearer ${accessToken}` })
    });

    if (!userResp.ok) {
        throw new Error(`Failed to get user info: ${userResp.status}`);
    }

    const userData = await userResp.json();
    const username = userData.username;
    // Care Partner accounts must use role "carepartner" or server returns empty data
    const role = ['CARE_PARTNER', 'CARE_PARTNER_OUS'].includes(userData.role) ? 'carepartner' : (userData.role?.toLowerCase() || 'patient');

    const patientsUrl = carelinkConfig.baseUrlCareLink + '/links/patients';
    const patientsResp = await fetch(patientsUrl, {
        headers: authHeaders({ ...CARELINK_HEADERS, 'Authorization': `Bearer ${accessToken}` })
    });

    if (!patientsResp.ok) {
        throw new Error(`Failed to get patient list: ${patientsResp.status}`);
    }

    const patientsData = await patientsResp.json();
    if (!patientsData || patientsData.length === 0) {
        throw new Error('No patients found in account');
    }

    const patientId = patientsData[0].relativeId;
    const authHeadersObj = authHeaders({ 'Authorization': `Bearer ${accessToken}` });

    // 0) Care Partners: try real-time sources first (avoid report/dashboard data)
    let data = null;
    if (role === 'carepartner') {
        // 0a) monitor v2 dashboard - documented real-time endpoint (5-min data)
        const monitorHost = region === 'US' ? 'carelink.minimed.com' : 'carelink.minimed.eu';
        const dashboardUrl = `https://${monitorHost}/connect/monitor/v2/dashboard`;
        try {
            const r = await fetch(dashboardUrl, {
                method: 'GET',
                headers: { ...MOBILE_HEADERS, ...authHeadersObj, 'Role': 'carepartner' }
            });
            if (r.ok) {
                const d = await r.json();
                if (d?.lastSG?.sg != null) data = d;
            }
        } catch (_) { /* fall through */ }

        // 0b) blePereodicDataEndpoint from country settings (carelink-bridge flow)
        if (!data?.lastSG?.sg) {
            const carelinkHost = region === 'US' ? 'carelink.minimed.com' : 'carelink.minimed.eu';
            const countrySettingsUrl = `https://${carelinkHost}/patient/countries/settings?countryCode=${country}&language=en`;
            try {
                const settingsResp = await fetch(countrySettingsUrl, {
                    headers: { ...MOBILE_HEADERS, ...authHeadersObj }
                });
                if (settingsResp.ok) {
                    const settings = await settingsResp.json();
                    const bleEndpoint = settings?.blePereodicDataEndpoint;
                    if (bleEndpoint) {
                        const endpoints = [
                            bleEndpoint,
                            bleEndpoint.replace('/v6/', '/v11/'),
                            bleEndpoint.replace('/v5/', '/v11/')
                        ];
                        const body = { username, role, patientId };
                        for (const ep of endpoints) {
                            try {
                                const r = await fetch(ep, {
                                    method: 'POST',
                                    headers: { ...MOBILE_HEADERS, ...authHeadersObj, 'Content-Type': 'application/json' },
                                    body: JSON.stringify(body)
                                });
                                if (r.ok) {
                                    const d = await r.json();
                                    if (d?.lastSG?.sg != null) {
                                        data = d;
                                        break;
                                    }
                                }
                            } catch (_) { /* try next */ }
                            if (data) break;
                        }
                    }
                }
            } catch (_) { /* fall through */ }
        }
    }

    // 1) Try v13 display/message (xDrip uses this)
    const cloudHost = region === 'US' ? 'clcloud.minimed.com' : 'clcloud.minimed.eu';
    const v13DisplayUrl = `https://${cloudHost}/connect/carepartner/v13/display/message`;
    let dataResp;
    if (!data?.lastSG?.sg) {
        dataResp = await fetch(v13DisplayUrl, {
        method: 'POST',
        headers: { ...CARELINK_HEADERS, ...authHeadersObj },
        body: JSON.stringify({ username, role, patientId, appVersion: '3.6.0' })
    });

        if (dataResp.ok) {
            const v13Data = await dataResp.json();
            // v13 returns DisplayMessage with patientData wrapper
            data = v13Data.patientData || v13Data;
        }
    }

    // 2) Fallback: v11 Cumulus display/message
    if (!data?.lastSG?.sg) {
        const displayUrl = carelinkConfig.baseUrlCumulus + '/display/message';
        dataResp = await fetch(displayUrl, {
            method: 'POST',
            headers: { ...CARELINK_HEADERS, ...authHeadersObj },
            body: JSON.stringify({ username, role, patientId })
        });
        if (dataResp.ok) {
            data = await dataResp.json();
        }
    }

    // 3) If no lastSG, try monitor v2 dashboard (real-time mobile app API) with mobile headers
    if (!data?.lastSG?.sg) {
        const monitorHost = region === 'US' ? 'carelink.minimed.com' : 'carelink.minimed.eu';
        const dashboardUrl = `https://${monitorHost}/connect/monitor/v2/dashboard`;
        const dashboardResp = await fetch(dashboardUrl, {
            method: 'GET',
            headers: { ...MOBILE_HEADERS, ...authHeadersObj, 'Role': 'carepartner' }
        });
        if (dashboardResp.ok) {
            const dashboardData = await dashboardResp.json();
            if (dashboardData?.lastSG?.sg) {
                data = dashboardData;
            }
        }
    }

    // 4) If still no data, try v13 then v11 display/message with mobile headers
    if (!data?.lastSG?.sg) {
        dataResp = await fetch(v13DisplayUrl, {
            method: 'POST',
            headers: { ...MOBILE_HEADERS, ...authHeadersObj },
            body: JSON.stringify({ username, role, patientId, appVersion: '3.6.0' })
        });
        if (dataResp.ok) {
            const v13Data = await dataResp.json();
            data = v13Data.patientData || v13Data;
        }
        if (!data?.lastSG?.sg) {
            const displayUrl = carelinkConfig.baseUrlCumulus + '/display/message';
            dataResp = await fetch(displayUrl, {
                method: 'POST',
                headers: { ...MOBILE_HEADERS, ...authHeadersObj },
                body: JSON.stringify({ username, role, patientId })
            });
            if (dataResp.ok) {
                data = await dataResp.json();
            }
        }
    }

    const lastSG = data?.lastSG;
    if (!lastSG || !lastSG.sg) {
        throw new Error('No glucose data. Check: 1) Open CareLink Connect app on your phone and view daughter\'s data once to activate Follower stream. 2) Sync to CareLink ON (daughter\'s MiniMed app). 3) Sensor not in warm-up/error.');
    }

    const glucoseValue = lastSG.sg;
    const timestamp = lastSG.datetime || new Date().toISOString();
    const trend = TREND_MAP[lastSG.trendArrow] || 'FLAT';

    const reading = {
        glucose_value: glucoseValue,
        timestamp,
        trend,
        active_insulin: data?.lastAlarm?.activeInsulin,
        pump_battery: data?.pumpBannerState?.batteryLevelPercent,
        sensor_duration: data?.lastSensorTS?.duration
    };

    storage.addReading(reading);

    return {
        success: true,
        reading,
        glucose: glucoseValue,
        trend,
        method: 'carelink-oauth-api'
    };
}

/**
 * Fetch CareLink data - OAuth first (real-time), then cookie, then nightscout.
 * OAuth tokens from carelink-bridge give real-time; cookie gives report data.
 */
async function fetchCareLink() {
    const config = storage.getConfig();
    let cookiePath = config.carelink_cookie_file || 'scripts/carelink-cookies.json';
    if (!path.isAbsolute(cookiePath)) {
        cookiePath = path.join(__dirname, '..', cookiePath);
    }

    // OAuth first when configured (real-time data from carelink-bridge logindata)
    if (config.access_token && config.refresh_token) {
        try {
            return await fetchCareLinkOAuth();
        } catch (oauthErr) {
            console.error('OAuth fetch failed:', oauthErr.message);
        }
    }

    // Cookie Export: works for EU (reCAPTCHA) - may return report data (2h delayed)
    if (config.carelink_cookie_enabled && fs.existsSync(cookiePath)) {
        // Try cookie first when enabled (xDrip equivalent: user logs in via browser, app uses session)
        try {
            return await fetchCareLinkCookie();
        } catch (cookieErr) {
            // When cookie mode is enabled, surface the cookie error directly.
            // Do NOT fall through to nightscout-connect (EU has reCAPTCHA, so it always fails).
            throw cookieErr;
        }
    } else if (config.carelink_cookie_enabled && !fs.existsSync(cookiePath)) {
        throw new Error(`Cookie file not found. Save cookies as scripts/carelink-cookies.json`);
    }

    // Nightscout-connect: automated form login (works for US; EU has reCAPTCHA so often fails)
    if (config.carelink_username && config.carelink_password) {
        try {
            return await fetchCareLinkNightscoutConnect();
        } catch (nsErr) {
            // EU reCAPTCHA blocks automated login - suggest Cookie Export
            const msg = nsErr.message || '';
            if (msg.includes('login failed') || msg.includes('reCAPTCHA') || msg.includes('Cookie Export')) {
                throw new Error('CareLink login failed (EU uses reCAPTCHA). Use Cookie Export: log in to carelink.minimed.eu in Edge, export cookies with Cookie-Editor, save as scripts/carelink-cookies.json, enable Cookie mode.');
            }
            throw nsErr;
        }
    }
    throw new Error('No CareLink connection configured. Add OAuth tokens (from carelink-bridge), or enable Cookie mode.');
}

module.exports = { fetchCareLink, fetchCareLinkOAuth, fetchCareLinkNightscout };
