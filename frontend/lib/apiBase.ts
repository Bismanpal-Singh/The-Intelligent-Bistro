import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Backend URL for Expo Go / simulators.
 * Uses the same host as Metro (debuggerHost) so the phone always targets
 * the machine that served the JS bundle. Override with EXPO_PUBLIC_API_BASE in .env.
 */
export function getApiBase(): string {
  const debuggerHost =
    Constants.expoGoConfig?.debuggerHost ??
    Constants.expoConfig?.hostUri;

  if (debuggerHost) {
    const hostname = debuggerHost.split(':')[0];
    if (hostname) {
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        if (Platform.OS === 'android') return 'http://10.0.2.2:3000';
        return 'http://localhost:3000';
      }
      return `http://${hostname}:3000`;
    }
  }

  const envBase = process.env.EXPO_PUBLIC_API_BASE?.trim();
  if (envBase) return envBase.replace(/\/$/, '');

  if (Platform.OS === 'android') return 'http://10.0.2.2:3000';
  return 'http://localhost:3000';
}
