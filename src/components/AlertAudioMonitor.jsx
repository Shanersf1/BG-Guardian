import { useAlertAudio } from '@/hooks/useAlertAudio';

/**
 * Renders nothing - just runs the alert audio hook.
 * Must be inside QueryClientProvider.
 */
export default function AlertAudioMonitor() {
  useAlertAudio();
  return null;
}
