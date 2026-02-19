const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const READINGS_FILE = path.join(DATA_DIR, 'readings.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

function readJson(file, defaultValue = []) {
    ensureDataDir();
    try {
        const data = fs.readFileSync(file, 'utf8');
        return JSON.parse(data);
    } catch {
        return defaultValue;
    }
}

function writeJson(file, data) {
    ensureDataDir();
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function getReadings(limit = 50) {
    const readings = readJson(READINGS_FILE, []);
    return readings
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, limit);
}

function addReading(reading) {
    const readings = readJson(READINGS_FILE, []);
    const id = 'r_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    readings.unshift({ id, ...reading, timestamp: reading.timestamp || new Date().toISOString() });
    writeJson(READINGS_FILE, readings);
    return { id, ...reading };
}

function getConfig() {
    return readJson(CONFIG_FILE, {});
}

function saveConfig(config) {
    writeJson(CONFIG_FILE, config);
}

function getSettings() {
    const settings = readJson(SETTINGS_FILE, []);
    return settings[0] || null;
}

function saveSettings(settings) {
    const existing = readJson(SETTINGS_FILE, []);
    if (existing[0]) {
        writeJson(SETTINGS_FILE, [{ ...existing[0], ...settings }]);
    } else {
        writeJson(SETTINGS_FILE, [settings]);
    }
}

module.exports = {
    getReadings,
    addReading,
    getConfig,
    saveConfig,
    getSettings,
    saveSettings,
};
