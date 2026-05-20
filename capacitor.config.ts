import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.syantw.aquatrack',
  appName: 'AquaTrack',
  webDir: 'dist',
  ios: {
    contentInset: 'automatic',
    allowsLinkPreview: false,
  },
  server: {
    // Required for WKWebView / OAuth redirects
    iosScheme: 'https',
  },
};

export default config;
