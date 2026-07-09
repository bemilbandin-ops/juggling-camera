import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lumentracker.app',
  appName: 'Lumen Tracker',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
