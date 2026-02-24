/**
 * Client-side alert audio using Web Audio API and Capacitor TextToSpeech.
 * Uses @capacitor-community/text-to-speech for native TTS (Android/iOS) with proper permissions.
 * playAlert/speakAlert enabled for Test button; automatic monitoring uses native BackgroundService.
 */

import { TextToSpeech } from '@capacitor-community/text-to-speech';

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
 * Used by Test alert button. volume 0-1 (default 1).
 */
export async function speakAlert(message, volume = 1) {
  try {
    if (!message?.trim()) return;
    const vol = Math.max(0, Math.min(1, Number(volume) ?? 1));

    try {
      await TextToSpeech.speak({
        text: message,
        lang: 'en-GB',
        rate: 1.0,
        pitch: 1.0,
        volume: vol,
        category: 'ambient',
      });
    } catch (e) {
      console.warn('[AlertAudio] Capacitor TTS failed, using speechSynthesis:', e?.message);
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(message);
        u.lang = 'en-GB';
        u.rate = 1;
        u.pitch = 1;
        u.volume = vol;
        window.speechSynthesis.speak(u);
      }
    }
  } catch (e) {
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
 * DISABLED: Native BackgroundService should be the only source of alerts.
 */
export async function triggerFullUrgentAlert(alert) {
  // DISABLED: UrgentNotification.show + TextToSpeech.speak commented out - native only
  void alert;
  return;
}

/**
 * Show urgent notification. On Android: full-screen intent to wake phone and show on lock screen.
 * On iOS: fallback to LocalNotifications.
 */
async function scheduleLocalNotification(alertType, body) {
  // DISABLED: LocalNotifications.schedule + UrgentNotification.show commented out - native only
  void alertType;
  void body;
  return;
}

/**
 * Play full alert: beeps + voice. Used by Test button.
 * volume 0-1 from settings (default 1).
 * Automatic monitoring uses native BackgroundService, not this.
 */
export async function playAlert(alertType, userName = 'User', value = null, volume = 1) {
  const name = (userName || 'User').trim() || 'User';
  const msg = MESSAGES[alertType]
    ? MESSAGES[alertType](name, value)
    : `Hey ${name}, glucose alert. Please check your glucose.`;

  playBeeps(3);
  setTimeout(() => speakAlert(msg, volume ?? 1), 900);
}
