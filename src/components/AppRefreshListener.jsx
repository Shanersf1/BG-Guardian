import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const refetchReadings = (queryClient) => {
  queryClient.refetchQueries({ queryKey: ['bgReadings'] });
};

const FIVE_MINUTES_MS = 5 * 60 * 1000;

/**
 * Central listener for native background updates.
 * Capacitor resume/appStateChange are registered in main.jsx (before React mounts).
 * Here we handle:
 * - bgg-data-update: Readings from MainActivity (BackgroundService).
 * - app-resume: Window event from MainActivity.onResume.
 * - 5-min timer: Fixed sync interval, never reset.
 */
export default function AppRefreshListener() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const onBggDataUpdate = (event) => {
      try {
        const payload = event?.detail;
        if (payload == null) return;
        const newData = typeof payload === 'string' ? JSON.parse(payload) : payload;
        if (Array.isArray(newData)) {
          queryClient.setQueryData(['bgReadings'], newData);
          console.log('[AppRefreshListener] bgg-data-update: received', newData.length, 'readings');
        } else {
          queryClient.refetchQueries({ queryKey: ['bgReadings'] });
        }
      } catch (err) {
        console.warn('[AppRefreshListener] bgg-data-update parse failed, refetching:', err);
        queryClient.refetchQueries({ queryKey: ['bgReadings'] });
      }
    };

    window.addEventListener('bgg-data-update', onBggDataUpdate);

    const onAppResume = () => refetchReadings(queryClient);

    window.addEventListener('app-resume', onAppResume);

    const fiveMinInterval = setInterval(() => {
      refetchReadings(queryClient);
    }, FIVE_MINUTES_MS);

    return () => {
      window.removeEventListener('bgg-data-update', onBggDataUpdate);
      window.removeEventListener('app-resume', onAppResume);
      clearInterval(fiveMinInterval);
    };
  }, [queryClient]);

  return null;
}
