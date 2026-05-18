import { Platform } from 'react-native';

/** Space reserved above the floating tab bar (matches CustomTabBar). */
export const TAB_BAR_INSET = Platform.OS === 'ios' ? 88 : 68;
