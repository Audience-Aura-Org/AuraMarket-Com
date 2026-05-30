import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.auradime.app',
  appName: 'Auradime',
  webDir: 'out',
  server: {
    androidScheme: 'https',
  },
};

export default config;
