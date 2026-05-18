import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { Fonts, Spacing } from '../../constants/theme';
import { BistroAvatarLarge } from '../../components/BistroAvatar';
import { useCartStore } from '../../store/cartStore';
import { useRealtimeVoice, VoiceStatus } from '../../hooks/useRealtimeVoice';
import { getApiBase } from '../../lib/apiBase';

const STATUS_LABEL: Record<VoiceStatus, string> = {
  idle: 'Tap to start a voice call with Bistro',
  connecting: 'Connecting to server…',
  linked: 'Starting Bistro voice…',
  ready: 'Listening — speak naturally',
  listening: 'Hearing you…',
  thinking: 'Working on your order…',
  speaking: 'Bistro is speaking',
  error: 'Something went wrong',
};

function PulseRing({ active, color }: { active: boolean; color: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    if (!active) {
      scale.setValue(1);
      opacity.setValue(0.2);
      return;
    }
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.35,
            duration: 1400,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 1400,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.05, duration: 1400, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.35, duration: 1400, useNativeDriver: true }),
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
          borderColor: color,
          opacity,
          transform: [{ scale }],
        },
      ]}
    />
  );
}

export default function VoiceScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const cartCount = useCartStore((s) => s.totalItems());
  const { status, error, liveTranscript, lastReply, isActive, connect, disconnect } =
    useRealtimeVoice();

  const pulseActive = isActive && (status === 'ready' || status === 'listening' || status === 'speaking');
  const starting = status === 'connecting' || status === 'linked';

  const handleMainPress = () => {
    if (isActive || starting) {
      void disconnect();
      return;
    }
    connect();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.cream }]}>Voice Bistro</Text>
          <Text style={[styles.subtitle, { color: colors.creamMuted }]}>
            Natural conversation · hands-free ordering
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/chat')}
          style={[styles.textLink, { borderColor: colors.border }]}
          activeOpacity={0.8}
        >
          <Text style={[styles.textLinkLabel, { color: colors.gold }]}>Text</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.hero}>
        <View style={styles.avatarStack}>
          <PulseRing active={pulseActive} color={colors.gold} />
          <PulseRing active={pulseActive} color={colors.goldDim} />
          <BistroAvatarLarge />
        </View>

        <Text style={[styles.statusLabel, { color: colors.gold }]}>
          {STATUS_LABEL[status]}
        </Text>

        {liveTranscript ? (
          <View style={[styles.captionCard, { backgroundColor: colors.bgCard, borderColor: colors.borderSubtle }]}>
            <Text style={[styles.captionLabel, { color: colors.creamMuted }]}>You</Text>
            <Text style={[styles.captionText, { color: colors.cream }]}>{liveTranscript}</Text>
          </View>
        ) : null}

        {lastReply && status !== 'listening' ? (
          <View style={[styles.captionCard, { backgroundColor: colors.bgElevated, borderColor: colors.borderSubtle }]}>
            <Text style={[styles.captionLabel, { color: colors.goldDim }]}>Bistro</Text>
            <Text style={[styles.captionText, { color: colors.cream }]}>{lastReply}</Text>
          </View>
        ) : null}

        {error ? (
          <Text style={[styles.errorText, { color: '#E07A5F' }]}>{error}</Text>
        ) : null}

        {!error && status === 'idle' ? (
          <Text style={[styles.hint, { color: colors.creamMuted }]}>
            Try: “Add two wagyu burgers” or “What’s popular tonight?”
          </Text>
        ) : null}
      </View>

      <View style={styles.footer}>
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

        <TouchableOpacity onPress={handleMainPress} activeOpacity={0.9}>
          <LinearGradient
            colors={
              isActive || starting
                ? ['#8B3A3A', '#5C2020']
                : [colors.gold, colors.goldDim]
            }
            style={styles.callBtn}
          >
            <Text style={styles.callBtnIcon}>{isActive || starting ? '✕' : '◉'}</Text>
            <Text style={[styles.callBtnLabel, { color: isActive || starting ? '#F5F0E8' : '#0D0D0D' }]}>
              {isActive || starting ? 'End call' : 'Start voice call'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        <Text style={[styles.backendHint, { color: colors.creamMuted }]}>
          Backend {getApiBase()}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  title: { fontFamily: Fonts.display, fontSize: 28, lineHeight: 32 },
  subtitle: { fontFamily: Fonts.sans, fontSize: 12, marginTop: 4, letterSpacing: 0.2 },
  textLink: {
    borderWidth: 1,
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 4,
  },
  textLinkLabel: { fontFamily: Fonts.sansMedium, fontSize: 12, letterSpacing: 0.5 },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  avatarStack: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  pulseRing: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 1,
  },
  statusLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 15,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  captionCard: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  captionLabel: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  captionText: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 20,
  },
  hint: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: Spacing.md,
  },
  errorText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: Spacing.md,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 100,
    gap: Spacing.md,
    alignItems: 'center',
  },
  cartPill: {
    borderWidth: 1,
    borderRadius: 100,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  cartPillText: { fontFamily: Fonts.sansMedium, fontSize: 13 },
  callBtn: {
    width: 220,
    height: 56,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  callBtnIcon: { fontSize: 18, color: '#0D0D0D', lineHeight: 22 },
  callBtnLabel: { fontFamily: Fonts.sansBold, fontSize: 15, letterSpacing: 0.2 },
  backendHint: { fontFamily: Fonts.sans, fontSize: 10, opacity: 0.6 },
});
