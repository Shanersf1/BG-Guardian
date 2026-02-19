import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bgguardianlink.app',
  appName: 'BG Guardian Link',
  webDir: 'dist',
  "server": {
    "androidScheme": "http",   
  },
};

export default config;
