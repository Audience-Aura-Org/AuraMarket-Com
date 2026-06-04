import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.auradime.app',
  appName: 'Auradime',
  webDir: 'out',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    Keyboard: {
      resize: 'none',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
