import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/localApi';
import { toast } from '@/components/ui/use-toast';
import { Capacitor } from '@capacitor/core';

/**
 * Listens for the native BackgroundService 'fetch-bg-data' event (fires every 5 min).
 * Triggers a fetch from the backend and invalidates the readings cache so the UI updates.
 * Also shows in-app toast when monitoring starts.
 */
export default function BackgroundFetchListener() {
  const queryClient = useQueryClient();
  const hasShownMonitoringToast = useRef(false);

  useEffect(() => {
    const showMonitoringToast = () => {
      if (Capacitor.getPlatform() !== 'web' && !hasShownMonitoringToast.current) {
        hasShownMonitoringToast.current = true;
        toast({
          title: 'BG Guardian is monitoring your blood glucose',
          description: 'Checking every 5 minutes. Alerts will fire when needed.',
          duration: 6000,
        });
      }
    };

    const handleFetchBgData = async () => {
      console.log('Background fetch event received!');
      showMonitoringToast();
      try {
        await api.fetchCareLink();
        queryClient.invalidateQueries({ queryKey: ['bgReadings'] });
      } catch (e) {
        console.warn('[BackgroundFetch] Fetch failed:', e?.message);
      }
    };

    const handleMonitoringStarted = () => {
      showMonitoringToast();
    };

    window.addEventListener('fetch-bg-data', handleFetchBgData);
    window.addEventListener('monitoring-started', handleMonitoringStarted);
    return () => {
      window.removeEventListener('fetch-bg-data', handleFetchBgData);
      window.removeEventListener('monitoring-started', handleMonitoringStarted);
    };
  }, [queryClient]);

  return null;
}
