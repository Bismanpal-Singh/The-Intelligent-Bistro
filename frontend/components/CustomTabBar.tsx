import React, { useEffect, useRef } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform, Animated } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { Fonts } from '../constants/theme';
import { useCartStore } from '../store/cartStore';
import { useTheme } from '../context/ThemeContext';

const TAB_ICONS: Record<string, string> = {
  index: '◈',
  cart: '◉',
  chat: '◎',
};

const TAB_LABELS: Record<string, string> = {
  index: 'Menu',
  cart: 'Order',
  chat: 'Bistro',
};

function TabButton({ route, isFocused, onPress, onLongPress }: {
  route: { name: string; key: string };
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const { colors, isDark } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const dotOpacity = useRef(new Animated.Value(isFocused ? 1 : 0)).current;
  const cartCount = useCartStore((s) => s.totalItems());

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: isFocused ? 1.08 : 1, useNativeDriver: true, damping: 12, stiffness: 150 }),
      Animated.timing(dotOpacity, { toValue: isFocused ? 1 : 0, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [isFocused]);

  const isCart = route.name === 'cart';

  return (
    <TouchableOpacity onPress={onPress} onLongPress={onLongPress} style={styles.tabButton} activeOpacity={0.7}>
      <Animated.View style={[styles.tabInner, { transform: [{ scale }] }]}>
        <View style={styles.iconWrap}>
          <Text style={[styles.icon, { color: isFocused ? colors.gold : colors.creamMuted }]}>
            {TAB_ICONS[route.name] ?? '◌'}
          </Text>
          {isCart && cartCount > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.gold }]}>
              <Text style={[styles.badgeText, { color: isDark ? '#0D0D0D' : '#FFFFFF' }]}>
                {cartCount > 9 ? '9+' : cartCount}
              </Text>
            </View>
          )}
        </View>
        <Text style={[styles.label, { color: isFocused ? colors.gold : colors.creamMuted, fontFamily: isFocused ? Fonts.sansBold : Fonts.sans }]}>
          {TAB_LABELS[route.name] ?? route.name}
        </Text>
        <Animated.View style={[styles.activeDot, { opacity: dotOpacity, backgroundColor: colors.gold }]} />
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors, isDark } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.tabBar }]}>
      <BlurView intensity={isDark ? 60 : 80} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      <View style={[styles.border, { backgroundColor: colors.border }]} />
      <View style={styles.row}>
        {state.routes.map((route, index) => (
          <TabButton
            key={route.key}
            route={route}
            isFocused={state.index === index}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!event.defaultPrevented) navigation.navigate(route.name);
            }}
            onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
  },
  border: { height: 1, marginHorizontal: 24 },
  row: { flexDirection: 'row', paddingTop: 10, paddingHorizontal: 16 },
  tabButton: { flex: 1, alignItems: 'center' },
  tabInner: { alignItems: 'center', gap: 3 },
  iconWrap: { position: 'relative' },
  icon: { fontSize: 22, lineHeight: 26 },
  label: { fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase' },
  activeDot: { width: 16, height: 2, borderRadius: 1, marginTop: 2 },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { fontSize: 9, fontFamily: Fonts.sansBold, lineHeight: 14 },
});
