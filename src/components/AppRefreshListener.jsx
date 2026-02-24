import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { App } from '@capacitor/app';

/**
 * When the app comes to foreground (user opens it), invalidate bgReadings
 * so React Query refetches and shows the latest readings immediately.
 */
export default function AppRefreshListener() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let listenerHandle = null;
    let mounted = true;
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        queryClient.invalidateQueries({ queryKey: ['bgReadings'] });
      }
    }).then((h) => {
      listenerHandle = h;
      if (!mounted) h.remove();
    });
    return () => {
      mounted = false;
      if (listenerHandle) listenerHandle.remove();
    };
  }, [queryClient]);

  return null;
}
