import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { Fonts } from '../constants/theme';

const DOTS = [
  { top: 2, left: '50%', marginLeft: -2 },
  { bottom: 2, left: '50%', marginLeft: -2 },
  { left: 2, top: '50%', marginTop: -2 },
  { right: 2, top: '50%', marginTop: -2 },
];

export default function BistroAvatar({ size = 44 }: { size?: number }) {
  const { colors } = useTheme();
  const innerSize = size - 8;
  const fontSize = size * 0.42;

  return (
    <View style={[styles.outerRing, {
      width: size,
      height: size,
      borderRadius: size / 2,
      borderColor: colors.gold,
    }]}>
      {/* Corner dots */}
      {([
        { top: 1, left: size / 2 - 2 },
        { bottom: 1, left: size / 2 - 2 },
        { left: 1, top: size / 2 - 2 },
        { right: 1, top: size / 2 - 2 },
      ] as any[]).map((pos, i) => (
        <View key={i} style={[styles.dot, { backgroundColor: colors.gold }, pos]} />
      ))}

      {/* Inner gradient circle */}
      <LinearGradient
        colors={['#2A1E0A', '#1A1208']}
        style={[styles.inner, {
          width: innerSize,
          height: innerSize,
          borderRadius: innerSize / 2,
        }]}
      >
        <Text style={[styles.letter, { fontSize, color: colors.gold }]}>𝔅</Text>
      </LinearGradient>
    </View>
  );
}

export function BistroAvatarLarge() {
  const { colors } = useTheme();
  return (
    <View style={styles.largeWrap}>
      {/* Outer decorative ring */}
      <View style={[styles.largeOuter, { borderColor: colors.border }]}>
        {/* Gold tick marks at 12, 3, 6, 9 o'clock */}
        {[0, 90, 180, 270].map((deg) => (
          <View
            key={deg}
            style={[
              styles.tickMark,
              { backgroundColor: colors.gold, transform: [{ rotate: `${deg}deg` }, { translateY: -26 }] },
            ]}
          />
        ))}

        {/* Inner gradient */}
        <LinearGradient
          colors={[colors.bgElevated, colors.bgCard]}
          style={styles.largeInner}
        >
          <Text style={[styles.largeLetter, { color: colors.gold }]}>𝔅</Text>
          <Text style={[styles.largeSubtext, { color: colors.creamMuted }]}>BISTRO</Text>
        </LinearGradient>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerRing: {
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  dot: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    fontFamily: Fonts.display,
    lineHeight: undefined,
    includeFontPadding: false,
  },
  largeWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  largeOuter: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tickMark: {
    position: 'absolute',
    width: 2,
    height: 6,
    borderRadius: 1,
    top: '50%',
    left: '50%',
    marginLeft: -1,
    marginTop: -3,
  },
  largeInner: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
  },
  largeLetter: {
    fontFamily: Fonts.display,
    fontSize: 22,
    lineHeight: 24,
    includeFontPadding: false,
  },
  largeSubtext: {
    fontFamily: Fonts.sansBold,
    fontSize: 5,
    letterSpacing: 2,
    marginTop: 1,
  },
});
