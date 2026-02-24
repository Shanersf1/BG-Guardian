import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

const refetchReadings = (queryClient) => {
  queryClient.invalidateQueries({ queryKey: ['bgReadings'] });
};

const FIVE_MINUTES_MS = 5 * 60 * 1000;

/**
 * When the app comes to foreground (user opens it), invalidate bgReadings
 * so React Query refetches and shows the latest readings immediately.
 * On native: listens for 'app-resume' from MainActivity.onResume().
 * On web: uses Capacitor App plugin (visibilitychange).
 *
 * Also runs a fixed 5-minute sync timer - runs every 5 min from app load,
 * never reset by app-resume or manual refresh. Keeps backend sync on schedule.
 */
export default function AppRefreshListener() {
  const queryClient = useQueryClient();

  useEffect(() => {
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
      window.removeEventListener('app-resume', onAppResume);
      if (capHandle) capHandle.remove();
      clearInterval(fiveMinInterval);
    };
  }, [queryClient]);

  return null;
}
