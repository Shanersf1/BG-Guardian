import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/localApi';
import { toMmol } from '@/utils/bgUnits';
import { playAlert } from '@/utils/alertAudio';

const COOLDOWN_MS = 5 * 60 * 1000; // 5 min per alert type
const CHECK_INTERVAL_MS = 60 * 1000; // Check every minute
const STALE_THRESHOLD_MS = 20 * 60 * 1000; // 20 min = stale

/**
 * Hook that monitors readings and plays browser audio when alerts fire.
 * Works on PC and mobile - plays on the device viewing the app.
 */
export function useAlertAudio() {
  const lastAlertRef = useRef({});

  const { data: readings = [] } = useQuery({
    queryKey: ['bgReadings'],
    queryFn: () => api.getReadings(50),
    refetchInterval: CHECK_INTERVAL_MS,
  });

  const { data: settings } = useQuery({
    queryKey: ['alertSettings'],
    queryFn: () => api.getSettings(),
  });

  useEffect(() => {
    if (!settings?.audio_alerts_enabled || !readings?.length) return;

    const latest = readings[0];
    if (!latest) return;

    const unit = settings.bg_unit || 'mmol';
    const displayVal =
      unit === 'mmol' ? toMmol(latest.glucose_value) : latest.glucose_value;
    const low = settings.low_threshold ?? (unit === 'mmol' ? 3.9 : 70);
    const high = settings.high_threshold ?? (unit === 'mmol' ? 10 : 180);
    const userName = (settings.user_name || 'User').trim() || 'User';
    const now = Date.now();

    const canFire = (type) => {
      const last = lastAlertRef.current[type] || 0;
      return now - last >= COOLDOWN_MS;
    };

    const fire = (type, value = null) => {
      if (!canFire(type)) return;
      lastAlertRef.current[type] = now;
      // #region agent log
      try { fetch('http://127.0.0.1:7380/ingest/e81b9cf9-8c2c-4638-a3d7-83ebe80b2a11', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'b07eda' }, body: JSON.stringify({ sessionId: 'b07eda', location: 'useAlertAudio.js:fire', message: 'fire() invoking playAlert', data: { type, value }, hypothesisId: 'A', timestamp: Date.now() }) }).catch(() => {}); } catch (_) {}
      // #endregion
      playAlert(type, userName, value);
    };

    let alertType = null;

    if (settings.low_alert_enabled !== false && displayVal < low) {
      alertType = 'low';
    } else if (settings.high_alert_enabled !== false && displayVal > high) {
      alertType = 'high';
    }

    if (!alertType && (settings.rapid_rise_enabled || settings.rapid_fall_enabled)) {
      const latestTime = new Date(latest.timestamp).getTime();
      const fifteenMinAgo = latestTime - 15 * 60 * 1000;
      const oldReading = readings.find(
        (r) => new Date(r.timestamp).getTime() <= fifteenMinAgo
      );
      if (oldReading) {
        const oldVal =
          unit === 'mmol' ? toMmol(oldReading.glucose_value) : oldReading.glucose_value;
        const diff = displayVal - oldVal;
        const riseThresh = settings.rapid_rise_threshold ?? 1.7;
        const fallThresh = settings.rapid_fall_threshold ?? 1.7;
        if (settings.rapid_rise_enabled !== false && diff >= riseThresh) {
          alertType = 'rapid_rise';
        } else if (
          settings.rapid_fall_enabled !== false &&
          diff <= -fallThresh
        ) {
          alertType = 'rapid_fall';
        }
      }
    }

    if (alertType) {
      fire(alertType, displayVal);
      return;
    }

    // Stale data check
    if (settings.stale_data_enabled && canFire('stale')) {
      const ageMs = now - new Date(latest.timestamp).getTime();
      if (ageMs >= STALE_THRESHOLD_MS) {
        fire('stale');
      }
    }
  }, [readings, settings]);
}
