import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.auradime.app',
  appName: 'Auradime',
  webDir: 'out',
  server: {
    url: 'https://auradime.com',
    androidScheme: 'https',
    cleartext: false,
  },
  plugins: {
    Keyboard: {
      resize: 'none',
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
