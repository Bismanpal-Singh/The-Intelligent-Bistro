import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { Fonts, Spacing } from '../../constants/theme';
import { useCartStore } from '../../store/cartStore';
import { MENU_ITEMS } from '../../data/menu';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
};

const WELCOME: Message = {
  id: 'welcome',
  role: 'assistant',
  text: "Good evening. I'm Bistro, your personal dining assistant. Tell me what you're in the mood for, and I'll take care of the rest.\n\nTry saying:\n• \"Add two wagyu burgers\"\n• \"What's popular tonight?\"\n• \"Remove the fries from my order\"",
  timestamp: new Date(),
};

function ChatBubble({ message }: { message: Message }) {
  const { colors } = useTheme();
  const isUser = message.role === 'user';
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 15, stiffness: 150 }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[styles.bubbleWrap, isUser && styles.bubbleWrapUser, { opacity, transform: [{ translateY }] }]}>
      {!isUser && (
        <View style={styles.avatar}>
          <LinearGradient colors={[colors.gold, colors.goldDim]} style={styles.avatarGradient}>
            <Text style={[styles.avatarText, { color: '#0D0D0D' }]}>B</Text>
          </LinearGradient>
        </View>
      )}
      <View style={[styles.bubble, isUser
        ? [styles.bubbleUser, { backgroundColor: colors.goldMuted, borderColor: colors.border }]
        : [styles.bubbleAssistant, { backgroundColor: colors.bgCard, borderColor: colors.borderSubtle }]
      ]}>
        <Text style={[styles.bubbleText, { color: colors.cream }]}>{message.text}</Text>
        <Text style={[styles.bubbleTime, { color: isUser ? colors.goldDim : colors.creamMuted }]}>
          {message.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </Animated.View>
  );
}

function TypingIndicator() {
  const { colors } = useTheme();
  const dots = [
    useRef(new Animated.Value(0.3)).current,
    useRef(new Animated.Value(0.3)).current,
    useRef(new Animated.Value(0.3)).current,
  ];

  useEffect(() => {
    const animate = () => {
      dots.forEach((dot, i) => {
        setTimeout(() => {
          Animated.sequence([
            Animated.timing(dot, { toValue: 1, duration: 350, useNativeDriver: true }),
            Animated.timing(dot, { toValue: 0.3, duration: 350, useNativeDriver: true }),
          ]).start();
        }, i * 150);
      });
    };
    animate();
    const interval = setInterval(animate, 1050);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.bubbleWrap}>
      <View style={styles.avatar}>
        <LinearGradient colors={[colors.gold, colors.goldDim]} style={styles.avatarGradient}>
          <Text style={[styles.avatarText, { color: '#0D0D0D' }]}>B</Text>
        </LinearGradient>
      </View>
      <View style={[styles.bubble, styles.bubbleAssistant, styles.typingBubble, { backgroundColor: colors.bgCard, borderColor: colors.borderSubtle }]}>
        {dots.map((dot, i) => (
          <Animated.View key={i} style={[styles.typingDot, { opacity: dot, backgroundColor: colors.gold }]} />
        ))}
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const { colors, isDark } = useTheme();
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const { addItem, removeItem, clearCart, items } = useCartStore();

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, cartItems: items }),
      });
      const data = await response.json();

      if (data.actions?.length) {
        for (const action of data.actions) {
          if (action.action === 'add') {
            const item = MENU_ITEMS.find((m) => m.id === action.itemId || m.name.toLowerCase().includes((action.itemId ?? '').toLowerCase()));
            if (item) for (let i = 0; i < (action.quantity ?? 1); i++) addItem(item);
          } else if (action.action === 'remove') {
            const item = MENU_ITEMS.find((m) => m.id === action.itemId || m.name.toLowerCase().includes((action.itemId ?? '').toLowerCase()));
            if (item) removeItem(item.id);
          } else if (action.action === 'clear') {
            clearCart();
          }
        }
      }

      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', text: data.reply ?? 'Done!', timestamp: new Date() }]);
    } catch {
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', text: "I'm having trouble connecting right now. Please try again in a moment.", timestamp: new Date() }]);
    } finally {
      setLoading(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <LinearGradient colors={[colors.gold, colors.goldDim]} style={styles.headerAvatar}>
            <Text style={[styles.headerAvatarText, { color: '#0D0D0D' }]}>B</Text>
          </LinearGradient>
          <View>
            <Text style={[styles.headerName, { color: colors.cream }]}>Bistro</Text>
            <View style={styles.onlineRow}>
              <View style={[styles.onlineDot, { backgroundColor: '#52B788' }]} />
              <Text style={[styles.onlineText, { color: colors.creamMuted }]}>Your dining assistant</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={[styles.headerRule, { backgroundColor: colors.borderSubtle }]} />

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => <ChatBubble message={item} />}
        contentContainerStyle={styles.messageList}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={loading ? <TypingIndicator /> : null}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      {messages.length <= 1 && (
        <View style={styles.suggestions}>
          {["What's popular?", 'Add a burger', 'What desserts?'].map((s) => (
            <TouchableOpacity key={s} onPress={() => setInput(s)} style={[styles.chip, { backgroundColor: colors.bgCard, borderColor: colors.border }]} activeOpacity={0.7}>
              <Text style={[styles.chipText, { color: colors.gold }]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.inputWrap, { backgroundColor: colors.inputBg }]}>
          <View style={[styles.inputBorder, { backgroundColor: colors.borderSubtle }]} />
          <View style={styles.inputRow}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Tell Bistro what you'd like..."
              placeholderTextColor={colors.creamMuted}
              style={[styles.input, { color: colors.cream }]}
              multiline
              maxLength={300}
              returnKeyType="send"
              onSubmitEditing={sendMessage}
              blurOnSubmit
            />
            <TouchableOpacity onPress={sendMessage} disabled={!input.trim() || loading} activeOpacity={0.8}>
              <LinearGradient
                colors={input.trim() && !loading ? [colors.gold, colors.goldDim] : [colors.bgElevated, colors.bgElevated]}
                style={styles.sendBtn}
              >
                <Text style={[styles.sendIcon, { color: input.trim() && !loading ? '#0D0D0D' : colors.creamMuted }]}>↑</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.md },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  headerAvatarText: { fontFamily: Fonts.serif, fontSize: 20 },
  headerName: { fontFamily: Fonts.serif, fontSize: 20 },
  onlineRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 },
  onlineDot: { width: 6, height: 6, borderRadius: 3 },
  onlineText: { fontFamily: Fonts.sans, fontSize: 11, letterSpacing: 0.3 },
  headerRule: { height: 1, marginHorizontal: Spacing.lg },
  messageList: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: 20, gap: 12 },
  bubbleWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 4 },
  bubbleWrapUser: { flexDirection: 'row-reverse' },
  avatar: { width: 32, height: 32, borderRadius: 16, overflow: 'hidden' },
  avatarGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: Fonts.serif, fontSize: 14 },
  bubble: { maxWidth: '75%', borderRadius: 16, padding: 12, gap: 4 },
  bubbleAssistant: { borderWidth: 1, borderBottomLeftRadius: 4 },
  bubbleUser: { borderWidth: 1, borderBottomRightRadius: 4 },
  bubbleText: { fontFamily: Fonts.sans, fontSize: 14, lineHeight: 20 },
  bubbleTime: { fontFamily: Fonts.sans, fontSize: 10, alignSelf: 'flex-end', marginTop: 2 },
  typingBubble: { flexDirection: 'row', gap: 5, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center' },
  typingDot: { width: 7, height: 7, borderRadius: 3.5 },
  suggestions: { flexDirection: 'row', paddingHorizontal: Spacing.md, paddingBottom: 8, gap: 8, flexWrap: 'wrap' },
  chip: { borderWidth: 1, borderRadius: 100, paddingHorizontal: 14, paddingVertical: 7 },
  chipText: { fontFamily: Fonts.sans, fontSize: 12, letterSpacing: 0.3 },
  inputWrap: { paddingBottom: Platform.OS === 'ios' ? 28 : 12 },
  inputBorder: { height: 1, marginHorizontal: Spacing.md },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: Spacing.md, paddingTop: 10, gap: 10 },
  input: { flex: 1, fontFamily: Fonts.sans, fontSize: 15, lineHeight: 22, maxHeight: 100, paddingVertical: 8 },
  sendBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  sendIcon: { fontSize: 18, fontWeight: '700', lineHeight: 20 },
});
