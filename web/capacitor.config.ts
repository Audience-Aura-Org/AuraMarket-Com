import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.auradime.app',
  appName: 'Auradime',
  webDir: 'out',
  server: {
    androidScheme: 'https',
    cleartext: false,
    allowNavigation: [
      '*.eversend.co',
      '*.payunit.cm',
      'api.auradime.com',
    ],
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
