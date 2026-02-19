const webpush = require('web-push');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const VAPID_FILE = path.join(DATA_DIR, 'vapid-keys.json');
const SUBSCRIPTIONS_FILE = path.join(DATA_DIR, 'push-subscriptions.json');

function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

function getVapidKeys() {
    ensureDataDir();
    try {
        const data = fs.readFileSync(VAPID_FILE, 'utf8');
        const keys = JSON.parse(data);
        if (keys.publicKey && keys.privateKey) return keys;
    } catch {}

    const keys = webpush.generateVAPIDKeys();
    fs.writeFileSync(VAPID_FILE, JSON.stringify(keys, null, 2), 'utf8');
    console.log('[Push] Generated new VAPID keys');
    return keys;
}

let vapidKeys = null;

function getKeys() {
    if (!vapidKeys) vapidKeys = getVapidKeys();
    return vapidKeys;
}

function getSubscriptions() {
    ensureDataDir();
    try {
        const data = fs.readFileSync(SUBSCRIPTIONS_FILE, 'utf8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

function saveSubscriptions(subscriptions) {
    ensureDataDir();
    fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(subscriptions, null, 2), 'utf8');
}

function addSubscription(subscription) {
    const subs = getSubscriptions();
    const endpoint = subscription?.endpoint;
    if (!endpoint) return;
    const existing = subs.findIndex((s) => s.endpoint === endpoint);
    const sub = {
        endpoint,
        expirationTime: subscription.expirationTime || null,
        keys: subscription.keys || {},
    };
    if (existing >= 0) {
        subs[existing] = sub;
    } else {
        subs.push(sub);
    }
    saveSubscriptions(subs);
}

function removeSubscription(endpoint) {
    const subs = getSubscriptions().filter((s) => s.endpoint !== endpoint);
    saveSubscriptions(subs);
}

async function sendPushToAll(payload) {
    const keys = getKeys();
    webpush.setVapidDetails('mailto:support@bg-guardian-link.local', keys.publicKey, keys.privateKey);

    const subs = getSubscriptions();
    const results = await Promise.allSettled(
        subs.map((sub) =>
            webpush.sendNotification(
                {
                    endpoint: sub.endpoint,
                    keys: sub.keys,
                    expirationTime: sub.expirationTime,
                },
                JSON.stringify(payload),
                { TTL: 3600 }
            )
        )
    );

    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length > 0) {
        const deadEndpoints = failed
            .map((r, i) => (r.reason?.statusCode === 410 || r.reason?.statusCode === 404 ? subs[i]?.endpoint : null))
            .filter(Boolean);
        if (deadEndpoints.length > 0) {
            const subsNew = getSubscriptions().filter((s) => !deadEndpoints.includes(s.endpoint));
            saveSubscriptions(subsNew);
        }
    }
}

function getPublicKey() {
    return getKeys().publicKey;
}

module.exports = {
    getPublicKey,
    addSubscription,
    removeSubscription,
    sendPushToAll,
};
