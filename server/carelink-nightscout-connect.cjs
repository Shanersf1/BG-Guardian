/**
 * CareLink fetch using nightscout-connect method.
 * https://github.com/nightscout/nightscout-connect
 *
 * Uses axios + cookie jar, form-based login to carelink.minimed.eu
 * (patient portal). Avoids mdtlogin OAuth - no Python, no TLS fingerprint issues.
 *
 * Config: carelink_username, carelink_password, country (default gb)
 * Optional: carelink_patient_id (for Care Partners), carelink_region ('eu'|'us')
 */

const qs = require('qs');
const axios = require('axios');
const tough = require('tough-cookie');
const axiosCookieJarSupport = require('axios-cookiejar-support');
const storage = require('./storage.cjs');

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const KNOWN_SERVERS = { eu: 'carelink.minimed.eu', us: 'carelink.minimed.com' };
const CLOUD_SERVERS = { eu: 'clcloud.minimed.eu', us: 'clcloud.minimed.com' };

const PATHS = {
    login: '/patient/sso/login',
    refresh: '/patient/sso/reauth',
    me: '/patient/users/me',
    profile: '/patient/users/me/profile',
    patientList: '/patient/m2m/links/patients',
    m2mData: '/patient/m2m/connect/data/gc/patients/',
    monitorData: '/patient/monitor/data',
    countrySettings: '/patient/countries/settings',
};

const TREND_MAP = {
    NONE: 'FLAT', UP: 'UP', DOWN: 'DOWN',
    UP_UP: 'UP_DOUBLE', DOWN_DOWN: 'DOWN_DOUBLE',
    UP_TRIPLE: 'UP_DOUBLE', DOWN_TRIPLE: 'DOWN_DOUBLE',
    FLAT: 'FLAT',
};

/**
 * Parse HTML for form action and hidden inputs.
 */
function parseLoginForm(html) {
    const result = { endpoint: null, fields: {} };
    const actionMatch = html.match(/<form[^>]*action=["']([^"']*)["']/i) ||
        html.match(/form[^>]*action=["']([^"']*)["']/i);
    if (actionMatch) {
        result.endpoint = actionMatch[1].replace(/&amp;/g, '&');
    }
    const inputRegex = /<input[^>]*name=["']([^"']*)["'][^>]*value=["']([^"']*)["'][^>]*>/gi;
    let m;
    while ((m = inputRegex.exec(html)) !== null) {
        result.fields[m[1]] = m[2];
    }
    return result;
}

/**
 * Parse consent/next form from HTML (e.g. after login).
 */
function parseForm(html) {
    const result = parseLoginForm(html);
    if (!result.endpoint && html.includes('form')) {
        const actionMatch2 = html.match(/action=["']([^"']*)["']/i);
        if (actionMatch2) result.endpoint = actionMatch2[1].replace(/&amp;/g, '&');
    }
    return result;
}

async function fetchCareLinkNightscoutConnect() {
    const config = storage.getConfig();
    const username = config.carelink_username;
    const password = config.carelink_password;
    if (!username || !password) {
        throw new Error('CareLink username/password not configured.');
    }

    const region = (config.carelink_region === 'us' || config.carelink_server === 'US') ? 'us' : 'eu';
    const countryCode = (config.country || 'gb').toLowerCase();
    const lang = 'en';
    const host = config.carelink_server ? KNOWN_SERVERS[region] || config.carelink_server : KNOWN_SERVERS.eu;
    const baseURL = `https://${host}`;

    const jar = new tough.CookieJar();
    const addJarSupport = axiosCookieJarSupport.wrapper || axiosCookieJarSupport.default?.wrapper;
    if (!addJarSupport) throw new Error('axios-cookiejar-support: wrapper not found.');
    const http = addJarSupport(axios.create({
        baseURL,
        jar,
        maxRedirects: 0,
        timeout: 20000,
        validateStatus: (s) => s >= 200 && s < 400,
        headers: {
            'User-Agent': BROWSER_UA,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en;q=0.9',
        },
    }));

    // 1) GET login page
    const loginUrl = `${PATHS.login}?country=${countryCode}&lang=${lang}`;
    let resp = await http.get(loginUrl);
    let html = typeof resp.data === 'string' ? resp.data : '';
    let location = resp.headers.location;

    // 2) Follow first redirect only; if next location has sessionID/sessionData, use it for POST (minimed-connect style)
    if (location && (resp.status >= 300 && resp.status < 400)) {
        const nextUrl = location.startsWith('http') ? location : new URL(location, baseURL).href;
        resp = await http.get(nextUrl, { baseURL: '', validateStatus: () => true }).catch((e) => e.response || { data: '', status: 0, headers: {} });
        if (resp && resp.headers) {
            html = typeof resp.data === 'string' ? resp.data : '';
            location = resp.headers.location;
        }
    }

    // 3) minimed-connect style: if redirect target has sessionID/sessionData, POST credentials there (don't follow)
    if (location && location.includes('sessionID') && location.includes('sessionData')) {
        const uri = new URL(location.startsWith('http') ? location : new URL(location, baseURL).href);
        const params = uri.searchParams;
        const postUrl = `${uri.origin}${uri.pathname}?locale=${params.get('locale') || 'en'}&countrycode=${params.get('countrycode') || countryCode}`;
        resp = await http.post(postUrl, qs.stringify({
            sessionID: params.get('sessionID'),
            sessionData: params.get('sessionData'),
            locale: 'en',
            action: 'login',
            username,
            password,
            actionButton: 'Log in',
        }), {
            baseURL: '',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }).catch((e) => e.response);
        html = typeof resp?.data === 'string' ? resp.data : '';
        location = resp?.headers?.location;
    } else {
        // 4) Parse HTML form (nightscout-connect style)
        let parsed = parseForm(html);
        if (!parsed.endpoint) parsed = parseLoginForm(html);

        const loginPayload = {
            ...parsed.fields,
            username,
            password,
            actionButton: 'Log In',
            country: countryCode,
            locale: lang,
            'g-recaptcha-response': Buffer.from('abc').toString('base64'),
        };
        const loginEndpoint = parsed.endpoint || `${baseURL}${PATHS.login}`;
        const isAbsolute = parsed.endpoint && parsed.endpoint.startsWith('http');
        const postTarget = isAbsolute ? parsed.endpoint : (parsed.endpoint ? new URL(parsed.endpoint, baseURL).href : `${baseURL}${PATHS.login}`);
        resp = await http.post(postTarget, qs.stringify(loginPayload), {
            baseURL: '',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }).catch((e) => e.response);
        html = typeof resp?.data === 'string' ? resp.data : '';
        location = resp?.headers?.location;
    }

    // 5) If redirect, follow
    location = resp.headers.location;
    while (location && (resp.status >= 300 && resp.status < 400 || resp.status === 200)) {
        const nextUrl = location.startsWith('http') ? location : new URL(location, baseURL).href;
        resp = await http.get(nextUrl, { baseURL: '' });
        html = typeof resp.data === 'string' ? resp.data : '';
        location = resp.headers.location;
    }

    // 6) Consent form (if present)
    if (resp.status === 200 && html.includes('form')) {
        const parsed2 = parseForm(html);
        if (parsed2.endpoint && Object.keys(parsed2.fields).length > 0) {
            const consentUrl = parsed2.endpoint.startsWith('http') ? parsed2.endpoint : new URL(parsed2.endpoint, baseURL).href;
            resp = await http.post(consentUrl, qs.stringify(parsed2.fields), {
                baseURL: '',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            }).catch((e) => e.response);
        }
    }

    // 7) Check we have auth cookie
    const cookies = jar.getCookiesSync(baseURL);
    const tokenCookie = cookies.find((c) => c.key === 'auth_tmp_token');
    if (!tokenCookie || !tokenCookie.value) {
        if (html.includes('reCAPTCHA') || html.includes('recaptcha')) {
            throw new Error('CareLink requires reCAPTCHA. Use Cookie Export mode instead.');
        }
        if (html.includes('invalid') || html.includes('Incorrect')) {
            throw new Error('Invalid CareLink username or password.');
        }
        throw new Error('CareLink login failed. Try Cookie Export mode.');
    }

    const token = tokenCookie.value;
    const authHeaders = { Authorization: `Bearer ${token}` };

    // 8) Get user and session
    const meResp = await http.get(PATHS.me, { headers: authHeaders });
    if (!meResp.data) throw new Error('Failed to get user info');
    const user = meResp.data;
    const role = (user.role || '').toUpperCase();

    // 9) Get country settings (for blePereodicDataEndpoint)
    const settingsResp = await http.get(`${PATHS.countrySettings}?countryCode=${countryCode}&language=${lang}`, { headers: authHeaders });
    const requirements = settingsResp.data || {};

    let patientUsername = username;
    let isPatient = ['PATIENT', 'PATIENT_OUS', 'PATIENT_US'].includes(role);
    if (!isPatient) {
        const patientsResp = await http.get(PATHS.patientList, { headers: authHeaders });
        const patients = Array.isArray(patientsResp.data) ? patientsResp.data : [];
        if (patients.length === 0) throw new Error('No patients found in Care Partner account');
        patientUsername = config.carelink_patient_id || patients[0].username || patients[0].relativeId;
    }

    // 10) Fetch data - try M2M (Guardian) first, then v13 display (xDrip), then BLE endpoint
    let data = null;
    const m2mUrl = `${PATHS.m2mData}${patientUsername}?cpSerialNumber=NONE&msgType=last24hours&requestTime=${Date.now()}`;
    try {
        const m2mResp = await http.get(m2mUrl, { headers: authHeaders });
        if (m2mResp.data && (m2mResp.data.sgs || m2mResp.data.lastSG)) {
            data = m2mResp.data;
        }
    } catch (_) { /* M2M may 404 for non-Guardian */ }

    // Try v13 display/message (xDrip - more stable for Care Partners / BLE devices)
    if (!data?.lastSG?.sg) {
        const cloudHost = CLOUD_SERVERS[region] || CLOUD_SERVERS.eu;
        const v13Url = `https://${cloudHost}/connect/carepartner/v13/display/message`;
        const v13Body = {
            username: user.username || username,
            role: isPatient ? 'patient' : 'carepartner',
            appVersion: '3.6.0'
        };
        if (!isPatient) v13Body.patientId = patientUsername;
        try {
            const v13Resp = await http.post(v13Url, v13Body, { headers: { ...authHeaders, 'Content-Type': 'application/json' }, baseURL: '' });
            if (v13Resp.data) {
                const v13Data = v13Resp.data.patientData || v13Resp.data;
                if (v13Data && (v13Data.sgs || v13Data.lastSG)) {
                    data = v13Data;
                }
            }
        } catch (_) { /* v13 may 404 for some configs */ }
    }

    if (!data?.lastSG?.sg && requirements.blePereodicDataEndpoint) {
        let endpoint = requirements.blePereodicDataEndpoint;
        endpoint = endpoint.replace('/carepartner/v6/display/message', '/carepartner/v5/display/message');
        const body = {
            username: user.username || username,
            role: isPatient ? 'patient' : 'carepartner',
        };
        if (!isPatient) body.patientId = patientUsername;
        const bleResp = await http.post(endpoint, body, { headers: { ...authHeaders, 'Content-Type': 'application/json' } });
        if (bleResp.data && (bleResp.data.sgs || bleResp.data.lastSG)) {
            data = bleResp.data;
        }
    }

    if (!data) {
        try {
            const monResp = await http.get(PATHS.monitorData, { headers: authHeaders });
            const mon = monResp.data;
            if (mon && mon.deviceFamily === 'GUARDIAN') {
                const m2mResp2 = await http.get(m2mUrl, { headers: authHeaders });
                if (m2mResp2.data) data = m2mResp2.data;
            } else if (mon && requirements.blePereodicDataEndpoint) {
                let ep = requirements.blePereodicDataEndpoint.replace('/v6/', '/v5/');
                const body = { username: user.username || username, role: isPatient ? 'patient' : 'carepartner' };
                if (!isPatient) body.patientId = patientUsername;
                const bleResp2 = await http.post(ep, body, { headers: { ...authHeaders, 'Content-Type': 'application/json' } });
                if (bleResp2.data) data = bleResp2.data;
            }
        } catch (_) { /* ignore */ }
    }

    const lastSG = data?.lastSG;
    const sgs = data?.sgs;
    let glucoseValue, timestamp, trend = 'FLAT';

    if (lastSG && lastSG.sg) {
        glucoseValue = lastSG.sg;
        timestamp = lastSG.datetime || new Date().toISOString();
        trend = TREND_MAP[lastSG.trendArrow] || 'FLAT';
    } else if (sgs && sgs.length > 0) {
        const valid = sgs.filter((e) => (e.kind === 'SG' || e.sg) && e.sg > 0);
        if (valid.length === 0) throw new Error('No glucose data');
        const last = valid[valid.length - 1];
        glucoseValue = last.sg;
        timestamp = last.datetime || new Date().toISOString();
        trend = TREND_MAP[data.lastSGTrend] || 'FLAT';
    } else {
        throw new Error('No glucose data from CareLink');
    }

    const reading = {
        glucose_value: glucoseValue,
        timestamp,
        trend,
        active_insulin: data?.activeInsulin?.amount ?? data?.lastAlarm?.activeInsulin?.amount,
        pump_battery: data?.medicalDeviceBatteryLevelPercent ?? data?.pumpBannerState?.batteryLevelPercent,
        sensor_duration: data?.sensorDurationHours ?? data?.lastSensorTS?.duration,
    };

    storage.addReading(reading);
    return {
        success: true,
        reading,
        glucose: glucoseValue,
        trend,
        method: 'carelink-nightscout-connect',
    };
}

module.exports = { fetchCareLinkNightscoutConnect };
