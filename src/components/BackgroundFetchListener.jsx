import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/localApi';

/**
 * Listens for the native BackgroundService 'fetch-bg-data' event (fires every 5 min).
 * Triggers a fetch from the backend and invalidates the readings cache so the UI updates.
 */
export default function BackgroundFetchListener() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleFetchBgData = async () => {
      console.log('Background fetch event received!');
      try {
        await api.fetchCareLink();
        queryClient.invalidateQueries({ queryKey: ['bgReadings'] });
      } catch (e) {
        console.warn('[BackgroundFetch] Fetch failed:', e?.message);
      }
    };

    window.addEventListener('fetch-bg-data', handleFetchBgData);
    return () => window.removeEventListener('fetch-bg-data', handleFetchBgData);
  }, [queryClient]);

  return null;
}
