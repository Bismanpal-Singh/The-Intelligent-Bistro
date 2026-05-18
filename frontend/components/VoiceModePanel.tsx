import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import { Fonts, Spacing } from '../constants/theme';
import { TAB_BAR_INSET } from '../constants/layout';
import { BistroAvatarLarge } from './BistroAvatar';
import { useCartStore } from '../store/cartStore';
import { useRealtimeVoice, VoiceStatus } from '../hooks/useRealtimeVoice';

const VOICE_HINTS = ['Add two wagyu burgers', "What's popular tonight?", 'Make my burger no onions'];

const STATUS_LABEL: Record<VoiceStatus, string> = {
  idle: 'Ready when you are',
  connecting: 'Connecting…',
  linked: 'Warming up Bistro…',
  ready: 'Listening',
  listening: 'Hearing you',
  thinking: 'On it',
  speaking: 'Speaking',
  error: 'Connection issue',
};

function PulseRing({ active, color, size }: { active: boolean; color: string; size: number }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (!active) {
      scale.setValue(1);
      opacity.setValue(0.15);
      return;
    }
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.28,
            duration: 1300,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 1300,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.04, duration: 1300, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.32, duration: 1300, useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active, opacity, scale]);

  return (
    <Animated.View
      style={[
        styles.pulseRing,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: color,
          opacity,
          transform: [{ scale }],
        },
      ]}
    />
  );
}

type Props = {
  onAssistantLine?: (text: string) => void;
  bottomInset?: number;
};

export default function VoiceModePanel({
  onAssistantLine,
  bottomInset = TAB_BAR_INSET,
}: Props) {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const cartCount = useCartStore((s) => s.totalItems());
  const { status, error, lastReply, isActive, connect, disconnect } = useRealtimeVoice({
    onTranscript: onAssistantLine,
  });

  const pulseActive =
    isActive && (status === 'ready' || status === 'listening' || status === 'speaking');
  const starting = status === 'connecting' || status === 'linked';
  const showCaption = Boolean(lastReply) || status === 'speaking';
  const canStart = !isActive && !starting && status !== 'error';

  useEffect(() => () => {
    void disconnect();
  }, [disconnect]);

  const handleCallPress = () => {
    if (isActive || starting) {
      void disconnect();
      return;
    }
    connect();
  };

  const handleAvatarPress = () => {
    if (canStart) connect();
  };

  const ctaLabel = isActive || starting ? 'End call' : 'Start voice call';
  const ctaIcon = isActive || starting ? '✕' : '◉';

  return (
    <View style={styles.root}>
      <View style={styles.body}>
        <View
          style={[
            styles.statusPill,
            {
              backgroundColor: colors.bgElevated,
              borderColor: colors.borderSubtle,
            },
          ]}
        >
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor: error
                  ? '#E07A5F'
                  : isActive
                    ? colors.gold
                    : colors.creamMuted,
              },
            ]}
          />
          <Text style={[styles.statusPillText, { color: colors.creamMuted }]}>
            {STATUS_LABEL[status]}
          </Text>
        </View>

        <Pressable
          onPress={handleAvatarPress}
          disabled={!canStart}
          style={({ pressed }) => [styles.avatarPress, pressed && canStart && styles.avatarPressed]}
          accessibilityRole="button"
          accessibilityLabel={canStart ? 'Start voice call' : 'Bistro voice assistant'}
        >
          <View style={styles.avatarStack}>
            <PulseRing active={pulseActive} color={colors.gold} size={168} />
            <PulseRing active={pulseActive} color={colors.goldDim} size={140} />
            <BistroAvatarLarge />
          </View>
          {canStart ? (
            <Text style={[styles.avatarHint, { color: colors.creamMuted }]}>
              Or tap Bistro to begin
            </Text>
          ) : null}
        </Pressable>

        {showCaption ? (
          <View
            style={[
              styles.captionCard,
              { backgroundColor: colors.bgCard, borderColor: colors.borderSubtle },
            ]}
          >
            <Text style={[styles.captionLabel, { color: colors.goldDim }]}>Bistro</Text>
            <Text style={[styles.captionText, { color: colors.cream }]} numberOfLines={6}>
              {lastReply || '…'}
            </Text>
          </View>
        ) : (
          <View style={styles.idleBlock}>
            <Text style={[styles.idleTitle, { color: colors.cream }]}>
              Hands-free ordering
            </Text>
            <Text style={[styles.idleSub, { color: colors.creamMuted }]}>
              Speak naturally — add items, change your order, or ask for recommendations.
            </Text>
            <View style={styles.chips}>
              {VOICE_HINTS.map((hint) => (
                <View
                  key={hint}
                  style={[
                    styles.chip,
                    { backgroundColor: colors.bgElevated, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.chipText, { color: colors.goldDim }]}>{hint}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {error ? (
          <Text style={[styles.errorText, { color: '#E07A5F' }]}>{error}</Text>
        ) : null}
      </View>

      <View
        style={[
          styles.dock,
          {
            borderTopColor: colors.borderSubtle,
            backgroundColor: colors.inputBg,
            paddingBottom: bottomInset + Spacing.sm,
          },
        ]}
      >
        {cartCount > 0 ? (
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/cart')}
            style={[styles.cartPill, { backgroundColor: colors.goldMuted, borderColor: colors.border }]}
            activeOpacity={0.85}
          >
            <Text style={[styles.cartPillText, { color: colors.gold }]}>
              View order · {cartCount} item{cartCount === 1 ? '' : 's'}
            </Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          onPress={handleCallPress}
          activeOpacity={0.88}
          disabled={starting}
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
          style={styles.ctaTouch}
        >
          <LinearGradient
            colors={
              isActive || starting
                ? ['#9B4545', '#6B2E2E']
                : [colors.gold, colors.goldDim]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.cta,
              starting && styles.ctaDisabled,
              !isActive && !starting && styles.ctaShadow,
            ]}
          >
            {starting ? (
              <ActivityIndicator color={isDark ? '#F5F0E8' : '#FFFFFF'} size="small" />
            ) : (
              <View style={[styles.ctaIconWrap, { backgroundColor: isActive || starting ? 'rgba(255,255,255,0.15)' : 'rgba(13,13,13,0.12)' }]}>
                <Text style={[styles.ctaIcon, { color: isActive || starting ? '#F5F0E8' : '#0D0D0D' }]}>
                  {ctaIcon}
                </Text>
              </View>
            )}
            <View style={styles.ctaTextCol}>
              <Text
                style={[
                  styles.ctaLabel,
                  { color: isActive || starting ? '#F5F0E8' : '#0D0D0D' },
                ]}
              >
                {starting ? 'Connecting…' : ctaLabel}
              </Text>
              {!isActive && !starting ? (
                <Text style={[styles.ctaSub, { color: 'rgba(13,13,13,0.55)' }]}>
                  Live conversation with Bistro
                </Text>
              ) : null}
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
    marginBottom: Spacing.xl,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusPillText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  avatarPress: {
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
    paddingVertical: Spacing.sm,
  },
  avatarPressed: { opacity: 0.92 },
  avatarStack: {
    width: 168,
    height: 168,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  pulseRing: {
    position: 'absolute',
    borderWidth: 1,
  },
  avatarHint: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    letterSpacing: 0.2,
  },
  captionCard: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.md,
    gap: 6,
    marginTop: Spacing.lg,
  },
  captionLabel: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  captionText: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 22,
  },
  idleBlock: {
    width: '100%',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xs,
    marginTop: Spacing.lg,
  },
  idleTitle: {
    fontFamily: Fonts.displaySemi,
    fontSize: 22,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  idleSub: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 300,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: Spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipText: { fontFamily: Fonts.sans, fontSize: 11, letterSpacing: 0.2 },
  errorText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: Spacing.md,
  },
  dock: {
    borderTopWidth: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    gap: Spacing.md,
    alignItems: 'stretch',
  },
  cartPill: {
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: 100,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  cartPillText: { fontFamily: Fonts.sansMedium, fontSize: 13 },
  ctaTouch: { width: '100%' },
  cta: {
    minHeight: 60,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    gap: 14,
  },
  ctaDisabled: { opacity: 0.92 },
  ctaShadow: {
    shadowColor: '#C9A84C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 6,
  },
  ctaIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaIcon: { fontSize: 18, lineHeight: 22 },
  ctaTextCol: { flex: 1, gap: 2 },
  ctaLabel: { fontFamily: Fonts.sansBold, fontSize: 16, letterSpacing: 0.15 },
  ctaSub: { fontFamily: Fonts.sans, fontSize: 12, letterSpacing: 0.1 },
});
