import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

const refetchReadings = (queryClient) => {
  queryClient.invalidateQueries({ queryKey: ['bgReadings'] });
};

const FIVE_MINUTES_MS = 5 * 60 * 1000;

/**
 * Central listener for native background updates and app lifecycle.
 * - bgg-data-update: Receives readings from MainActivity (BackgroundService).
 *   MUST be here (top-level) so it's always active regardless of current page.
 * - app-resume: Refetch when app comes to foreground.
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
          queryClient.invalidateQueries({ queryKey: ['bgReadings'] });
        }
      } catch (err) {
        console.warn('[AppRefreshListener] bgg-data-update parse failed, refetching:', err);
        queryClient.invalidateQueries({ queryKey: ['bgReadings'] });
      }
    };

    window.addEventListener('bgg-data-update', onBggDataUpdate);

    const onAppResume = () => refetchReadings(queryClient);

    window.addEventListener('app-resume', onAppResume);

    let capHandle = null;
    if (Capacitor.getPlatform() === 'web') {
      App.addListener('resume', onAppResume).then((h) => { capHandle = h; });
    }

    const fiveMinInterval = setInterval(() => {
      refetchReadings(queryClient);
    }, FIVE_MINUTES_MS);

    return () => {
      window.removeEventListener('bgg-data-update', onBggDataUpdate);
      window.removeEventListener('app-resume', onAppResume);
      if (capHandle) capHandle.remove();
      clearInterval(fiveMinInterval);
    };
  }, [queryClient]);

  return null;
}
