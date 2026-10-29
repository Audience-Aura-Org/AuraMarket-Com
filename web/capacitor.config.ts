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
    // Logo on the brand background until the first screen has painted (hidden from
    // components/NativeShell.js), so the app never flashes a blank WebView.
    SplashScreen: {
      launchAutoHide: false,
      launchShowDuration: 8000,
      backgroundColor: '#0a050a',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: false,
      splashImmersive: false,
    },
    StatusBar: {
      backgroundColor: '#0a050a',
      style: 'DARK',
      overlaysWebView: false,
    },
  },
};

export default config;
