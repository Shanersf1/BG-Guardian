/**
 * Client-side alert audio using Web Audio API and Capacitor TextToSpeech.
 * Uses @capacitor-community/text-to-speech for native TTS (Android/iOS) with proper permissions.
 */

import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { registerPlugin } from '@capacitor/core';

const ALERT_CHANNEL_ID = 'AlertChannel';
const ALERT_IDS = { low: 1, high: 2, rapid_rise: 3, rapid_fall: 4, stale: 5 };
let localNotificationReady = false;

// Android-only: urgent notifications with full-screen intent to wake sleeping phone
const UrgentNotification = registerPlugin('UrgentNotification');

async function ensureLocalNotificationReady() {
  if (localNotificationReady || Capacitor.getPlatform() === 'web') return;
  try {
    const { display } = await LocalNotifications.checkPermissions();
    if (display !== 'granted') {
      const { display: after } = await LocalNotifications.requestPermissions();
      if (after !== 'granted') return;
    }
    localNotificationReady = true;
  } catch (e) {
    console.warn('[AlertAudio] Local notification setup failed:', e);
  }
}

// #region agent log
function _log(location, message, data, hypothesisId) {
  const payload = { sessionId: 'b07eda', location, message, data: data || {}, hypothesisId, timestamp: Date.now() };
  try {
    fetch('http://127.0.0.1:7380/ingest/e81b9cf9-8c2c-4638-a3d7-83ebe80b2a11', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'b07eda' }, body: JSON.stringify(payload) }).catch(() => {});
  } catch (_) {}
  console.log('[DEBUG-b07eda]', location, message, data);
}
// #endregion

/**
 * Play short beep using Web Audio API (no external files needed)
 */
export function playBeeps(count = 3, frequency = 880, durationMs = 150) {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    // #region agent log
    _log('alertAudio.js:playBeeps:entry', 'playBeeps called', { hasAudioContext: !!AudioContext, count }, 'B');
    // #endregion
    if (!AudioContext) return;

    const ctx = new AudioContext();
    // #region agent log
    _log('alertAudio.js:playBeeps:ctx', 'AudioContext created', { state: ctx.state, baseLatency: ctx.baseLatency }, 'B');
    // #endregion

    const playOne = () => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = frequency;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + durationMs / 1000);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + durationMs / 1000);
    };

    let n = 0;
    const playNext = () => {
      if (n >= count) return;
      playOne();
      n++;
      setTimeout(playNext, 250);
    };
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    playNext();
  } catch (e) {
    // #region agent log
    _log('alertAudio.js:playBeeps:error', 'Beep failed', { error: String(e), message: e?.message }, 'B');
    // #endregion
    console.warn('[AlertAudio] Beep failed:', e);
  }
}

/**
 * Speak message using Capacitor TextToSpeech plugin.
 * Handles native permissions correctly on Android/iOS.
 */
export async function speakAlert(message) {
  try {
    const platform = Capacitor.getPlatform();
    console.log('[AlertAudio] speakAlert: using @capacitor-community/text-to-speech, platform=', platform);
    _log('alertAudio.js:speakAlert:entry', 'speakAlert called', { msgLen: message?.length, platform }, 'C');
    if (!message?.trim()) return;

    await TextToSpeech.speak({
      text: message,
      lang: 'en-GB',
      rate: 1.0,
      pitch: 1.0,
      volume: 1.0,
      category: 'ambient',
    });
    console.log('[AlertAudio] TextToSpeech.speak() completed');
    _log('alertAudio.js:speakAlert:speak', 'TextToSpeech.speak() completed', { platform }, 'C');
    // #endregion
  } catch (e) {
    // #region agent log
    _log('alertAudio.js:speakAlert:error', 'TTS failed', { error: String(e), message: e?.message }, 'C');
    // #endregion
    console.warn('[AlertAudio] TTS failed:', e);
  }
}

const MESSAGES = {
  low: (name, value) =>
    `Hey ${name}, your blood sugar is low. Current reading is ${value}. Please check your glucose.`,
  high: (name, value) =>
    `Hey ${name}, your blood sugar is high. Current reading is ${value}. Please check your glucose.`,
  rapid_rise: (name) =>
    `Hey ${name}, your blood sugar is rising quickly. Please check your glucose.`,
  rapid_fall: (name) =>
    `Hey ${name}, your blood sugar is falling quickly. Please check your glucose.`,
  stale: (name) =>
    `Hey ${name}, there has been no new glucose reading. Please check your sensor.`,
};

const NOTIFICATION_TITLES = {
  low: 'Critical BG Alert!',
  high: 'High BG Alert',
  rapid_rise: 'Rapid Rise',
  rapid_fall: 'Rapid Fall',
  stale: 'Stale Data',
};

/**
 * Triggers the full urgent alert: full-screen notification + voice.
 * Used when a critical glucose alert fires. On Android, wakes the phone and shows on lock screen.
 * @param {object} alert - { title, body, id }
 */
export async function triggerFullUrgentAlert(alert) {
  if (Capacitor.getPlatform() === 'web') return;
  try {
    if (Capacitor.getPlatform() === 'android' && UrgentNotification) {
      await UrgentNotification.show({
        title: alert.title,
        body: alert.body,
        id: alert.id,
      });
    }
    if (alert.body?.trim()) {
      await TextToSpeech.speak({
        text: alert.body,
        lang: 'en-US',
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0,
        category: 'ambient',
      });
    }
    console.log('[AlertAudio] Full urgent alert triggered.');
  } catch (e) {
    console.error('[AlertAudio] Full urgent alert failed:', e);
  }
}

/**
 * Show urgent notification. On Android: full-screen intent to wake phone and show on lock screen.
 * On iOS: fallback to LocalNotifications.
 */
async function scheduleLocalNotification(alertType, body) {
  if (Capacitor.getPlatform() === 'web') return;
  const id = ALERT_IDS[alertType] ?? 0;
  const title = NOTIFICATION_TITLES[alertType] || 'BG Alert';

  if (Capacitor.getPlatform() === 'android') {
    try {
      await UrgentNotification.show({ title, body, id });
    } catch (e) {
      console.warn('[AlertAudio] Urgent notification failed:', e);
    }
    return;
  }

  try {
    await ensureLocalNotificationReady();
    await LocalNotifications.schedule({
      notifications: [
        {
          title,
          body,
          id,
          schedule: { at: new Date(Date.now() + 1000) },
          sound: null,
          attachments: null,
          actionTypeId: '',
          extra: null,
          channelId: ALERT_CHANNEL_ID,
        },
      ],
    });
  } catch (e) {
    console.warn('[AlertAudio] Local notification failed:', e);
  }
}

/**
 * Play full alert: beeps, voice message, and local notification (on native).
 * On Android: uses UrgentNotification (full-screen) + TextToSpeech.
 * On iOS: uses LocalNotifications + TextToSpeech.
 */
export async function playAlert(alertType, userName = 'User', value = null) {
  // #region agent log
  _log('alertAudio.js:playAlert:entry', 'playAlert called', { alertType, userName, value, isCapacitor: !!window.Capacitor }, 'A');
  // #endregion
  const name = (userName || 'User').trim() || 'User';
  const msg = MESSAGES[alertType]
    ? MESSAGES[alertType](name, value)
    : `Hey ${name}, glucose alert. Please check your glucose.`;
  const title = NOTIFICATION_TITLES[alertType] || 'BG Alert';
  const id = ALERT_IDS[alertType] ?? 0;

  if (Capacitor.getPlatform() === 'android') {
    await triggerFullUrgentAlert({ title, body: msg, id });
    playBeeps(3);
    return;
  }

  if (Capacitor.getPlatform() === 'ios') {
    await scheduleLocalNotification(alertType, msg);
  }
  playBeeps(3);
  setTimeout(() => speakAlert(msg), 900);
}
