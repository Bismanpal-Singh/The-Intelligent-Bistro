import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Platform, Animated, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { Fonts, Spacing } from '../../constants/theme';
import { useCartStore } from '../../store/cartStore';
import { MENU_ITEMS } from '../../data/menu';
import BistroAvatar, { BistroAvatarLarge } from '../../components/BistroAvatar';

// ── Update this to your machine's local IP when running on a physical device ──
const API_BASE = 'http://192.168.3.239:3000';

const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 85 : 65;

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
    <Animated.View style={[
      styles.bubbleWrap,
      isUser && styles.bubbleWrapUser,
      { opacity, transform: [{ translateY }] },
    ]}>
      {!isUser && (
        <BistroAvatar size={32} />
      )}
      <View style={[
        styles.bubble,
        isUser
          ? [styles.bubbleUser, { backgroundColor: colors.goldMuted, borderColor: colors.border }]
          : [styles.bubbleAssistant, { backgroundColor: colors.bgCard, borderColor: colors.borderSubtle }],
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
      <BistroAvatar size={32} />
      <View style={[styles.bubble, styles.bubbleAssistant, styles.typingBubble, { backgroundColor: colors.bgCard, borderColor: colors.borderSubtle }]}>
        {dots.map((dot, i) => (
          <Animated.View key={i} style={[styles.typingDot, { opacity: dot, backgroundColor: colors.gold }]} />
        ))}
      </View>
    </View>
  );
}

type HistoryEntry = { role: 'user' | 'assistant'; content: string };

const TYPING_SPEED_MS = 9; // ms per character (~110 chars/sec)

export default function ChatScreen() {
  const { colors } = useTheme();
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const { addItem, removeItem, updateQuantity, clearCart, items } = useCartStore();
  const inputBottom = useRef(new Animated.Value(TAB_BAR_HEIGHT)).current;

  // Typing queue — incoming chunks get buffered here, drained char-by-char
  const typingQueue = useRef('');
  const typingInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingTarget = useRef('');

  const startTyping = (msgId: string) => {
    if (typingInterval.current) return;
    typingInterval.current = setInterval(() => {
      if (typingQueue.current.length === 0) return;
      const char = typingQueue.current[0];
      typingQueue.current = typingQueue.current.slice(1);
      typingTarget.current += char;
      const snapshot = typingTarget.current;
      setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, text: snapshot } : m));
    }, TYPING_SPEED_MS);
  };

  const stopTyping = () => {
    if (typingInterval.current) {
      clearInterval(typingInterval.current);
      typingInterval.current = null;
    }
    typingQueue.current = '';
    typingTarget.current = '';
  };

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        Animated.timing(inputBottom, {
          toValue: e.endCoordinates.height,
          duration: Platform.OS === 'ios' ? e.duration : 150,
          useNativeDriver: false,
        }).start();
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), (Platform.OS === 'ios' ? e.duration : 160) + 50);
      }
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      (e) => {
        Animated.timing(inputBottom, {
          toValue: TAB_BAR_HEIGHT,
          duration: Platform.OS === 'ios' ? e.duration : 150,
          useNativeDriver: false,
        }).start();
      }
    );
    return () => { show.remove(); hide.remove(); };
  }, []);

  // Scroll to bottom whenever messages change or typing indicator appears/disappears
  useEffect(() => {
    const timer = setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(timer);
  }, [messages.length, loading]);

  const applyActions = (actions: any[]) => {
    for (const action of actions) {
      if (action.action === 'add') {
        const item = MENU_ITEMS.find((m) => m.id === action.itemId);
        if (item) for (let i = 0; i < (action.quantity ?? 1); i++) addItem(item);
      } else if (action.action === 'remove') {
        const item = MENU_ITEMS.find((m) => m.id === action.itemId);
        if (item) removeItem(item.id);
      } else if (action.action === 'update') {
        const item = MENU_ITEMS.find((m) => m.id === action.itemId);
        if (item) updateQuantity(item.id, action.quantity);
      } else if (action.action === 'clear') {
        clearCart();
      }
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const assistantId = (Date.now() + 1).toString();
    let fullText = '';
    stopTyping();

    await new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE}/api/chat/stream`);
      xhr.setRequestHeader('Content-Type', 'application/json');

      let processed = 0;

      const handleChunk = (chunk: string) => {
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'actions') {
              applyActions(data.actions);
              setLoading(false);
              setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', text: '', timestamp: new Date() }]);
              startTyping(assistantId);

            } else if (data.type === 'delta') {
              fullText += data.text;
              typingQueue.current += data.text;

            } else if (data.type === 'done') {
              const waitAndSave = () => {
                if (typingQueue.current.length > 0) {
                  setTimeout(waitAndSave, 100);
                } else {
                  stopTyping();
                  setHistory((prev) => [...prev, { role: 'user', content: text }, { role: 'assistant', content: fullText }]);
                }
              };
              waitAndSave();
            }
          } catch { /* ignore malformed lines */ }
        }
      };

      xhr.onprogress = () => {
        const newChunk = xhr.responseText.slice(processed);
        processed = xhr.responseText.length;
        handleChunk(newChunk);
      };

      xhr.onload = () => {
        const newChunk = xhr.responseText.slice(processed);
        if (newChunk) handleChunk(newChunk);
        resolve();
      };

      xhr.onerror = () => {
        stopTyping();
        setLoading(false);
        setMessages((prev) => [...prev, {
          id: assistantId,
          role: 'assistant',
          text: "I'm having trouble connecting right now. Please try again in a moment.",
          timestamp: new Date(),
        }]);
        resolve();
      };

      xhr.send(JSON.stringify({ message: text, cartItems: items, history }));
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <BistroAvatarLarge />
        <View style={styles.headerText}>
          <Text style={[styles.headerName, { color: colors.cream }]}>Bistro</Text>
          <View style={styles.onlineRow}>
            <View style={[styles.onlineDot, { backgroundColor: '#52B788' }]} />
            <Text style={[styles.onlineText, { color: colors.creamMuted }]}>Your dining assistant</Text>
          </View>
        </View>
      </View>

      <View style={[styles.headerRule, { backgroundColor: colors.borderSubtle }]} />

      {/* Messages + input */}
      <Animated.View style={[styles.flex, { paddingBottom: inputBottom }]}>
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <ChatBubble message={item} />}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={loading ? <TypingIndicator /> : null}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
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

        {/* Input bar */}
        <View style={[styles.inputWrap, { backgroundColor: colors.inputBg, borderTopColor: colors.borderSubtle }]}>
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
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    gap: 14,
  },
  headerText: { flex: 1 },
  headerName: { fontFamily: Fonts.display, fontSize: 22, lineHeight: 26 },
  onlineRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  onlineDot: { width: 6, height: 6, borderRadius: 3 },
  onlineText: { fontFamily: Fonts.sans, fontSize: 11, letterSpacing: 0.3 },
  headerRule: { height: 1, marginHorizontal: Spacing.lg },
  messageList: { flexGrow: 1, justifyContent: 'flex-end', paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: 4, gap: 12 },
  bubbleWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 4 },
  bubbleWrapUser: { flexDirection: 'row-reverse' },
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
  inputWrap: {
    borderTopWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingTop: 10,
    paddingBottom: 10,
  },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  input: {
    flex: 1,
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    maxHeight: 100,
    paddingVertical: 8,
  },
  sendBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  sendIcon: { fontSize: 18, fontWeight: '700', lineHeight: 20 },
});
