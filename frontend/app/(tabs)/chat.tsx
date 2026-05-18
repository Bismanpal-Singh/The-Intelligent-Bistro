import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Platform, Animated, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { Fonts, Spacing } from '../../constants/theme';
import { TAB_BAR_INSET } from '../../constants/layout';
import { useCartStore } from '../../store/cartStore';
import { MENU_ITEMS } from '../../data/menu';
import BistroAvatar, { BistroAvatarLarge } from '../../components/BistroAvatar';
import VoiceModePanel from '../../components/VoiceModePanel';
import { getApiBase } from '../../lib/apiBase';
import { useSpeechInput } from '../../hooks/useSpeechInput';
import { speakBistro, stopSpeaking } from '../../lib/bistroSpeech';

type ChatMode = 'text' | 'voice';

const modeToggleStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 100,
    padding: 3,
    gap: 2,
  },
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
  },
  label: { fontFamily: Fonts.sans, fontSize: 11, letterSpacing: 0.4 },
});

function ModeToggle({
  mode,
  onChange,
}: {
  mode: ChatMode;
  onChange: (mode: ChatMode) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[modeToggleStyles.row, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}>
      {(['text', 'voice'] as const).map((key) => {
        const active = mode === key;
        return (
          <TouchableOpacity
            key={key}
            onPress={() => onChange(key)}
            style={[modeToggleStyles.btn, active && { backgroundColor: colors.goldMuted }]}
            activeOpacity={0.85}
          >
            <Text
              style={[
                modeToggleStyles.label,
                { color: active ? colors.gold : colors.creamMuted },
                active && { fontFamily: Fonts.sansBold },
              ]}
            >
              {key === 'text' ? 'Text' : 'Voice'}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const API_BASE = getApiBase();

const TAB_BAR_HEIGHT = TAB_BAR_INSET;

type Message = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
};

const WELCOME: Message = {
  id: 'welcome',
  role: 'assistant',
  text: "Good evening. I'm Bistro, your personal dining assistant. Use Text to type or tap the mic, or switch to Voice for a hands-free call.\n\nTry saying:\n• \"Add a wagyu burger\"\n• \"Remove onions from my burger\"\n• \"What's popular tonight?\"",
  timestamp: new Date(),
};

function ChatBubble({
  message,
  onReplay,
}: {
  message: Message;
  onReplay?: (text: string) => void;
}) {
  const { colors } = useTheme();
  const isUser = message.role === 'user';
  const canReplay = !isUser && !!message.text && onReplay;
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 15, stiffness: 150 }),
    ]).start();
  }, []);

  const bubble = (
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
        <View style={styles.bubbleFooter}>
          <Text style={[styles.bubbleTime, { color: isUser ? colors.goldDim : colors.creamMuted }]}>
            {message.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </Text>
          {canReplay ? (
            <Text style={[styles.replayHint, { color: colors.goldDim }]}>Tap to hear</Text>
          ) : null}
        </View>
      </View>
    </Animated.View>
  );

  if (canReplay) {
    return (
      <TouchableOpacity onPress={() => onReplay(message.text)} activeOpacity={0.88}>
        {bubble}
      </TouchableOpacity>
    );
  }

  return bubble;
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
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [chatMode, setChatMode] = useState<ChatMode>('text');
  const flatListRef = useRef<FlatList>(null);
  const inputBottom = useRef(new Animated.Value(TAB_BAR_HEIGHT)).current;
  const micPulse = useRef(new Animated.Value(1)).current;

  const maybeSpeakReply = useCallback((text: string) => {
    if (text.trim()) speakBistro(text);
  }, []);

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

  useEffect(() => {
    if (__DEV__) console.log('[Bistro] API_BASE:', API_BASE);
  }, []);

  useEffect(() => () => stopSpeaking(), []);

  const applyActions = (actions: any[]) => {
    for (const action of actions) {
      const store = useCartStore.getState();
      if (action.action === 'add') {
        const item = MENU_ITEMS.find((m) => m.id === action.itemId);
        if (item) store.addItem(item, action.quantity ?? 1, action.customizations);
      } else if (action.action === 'remove') {
        if (action.cartLineId) store.removeItem(action.cartLineId);
        else if (action.itemId) store.removeAllForItem(action.itemId);
      } else if (action.action === 'update') {
        if (action.cartLineId) {
          store.updateQuantity(action.cartLineId, action.quantity);
        } else if (action.itemId) {
          const lines = store.items.filter((i) => i.itemId === action.itemId);
          if (lines.length === 1) store.updateQuantity(lines[0].cartLineId, action.quantity);
        }
      } else if (action.action === 'update_customizations') {
        const cart = useCartStore.getState().items;
        const lineId =
          action.cartLineId ??
          (action.itemId
            ? cart.filter((i) => i.itemId === action.itemId).length === 1
              ? cart.find((i) => i.itemId === action.itemId)!.cartLineId
              : null
            : null);
        if (!lineId) continue;
        const cartStore = useCartStore.getState();
        if (action.patch) cartStore.patchCustomizations(lineId, action.patch);
        else if (action.customizations) cartStore.updateCustomizations(lineId, action.customizations);
      } else if (action.action === 'clear') {
        store.clearCart();
      }
    }
  };

  const sendMessage = useCallback(async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || loading) return;

    setVoiceError(null);
    stopSpeaking();
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
      xhr.timeout = 120000;

      let processed = 0;

      const fail = (reason: string) => {
        stopTyping();
        setLoading(false);
        const failText = `${reason}\n\nBackend: ${API_BASE}\n• Backend running: cd backend && npm start\n• Same Wi‑Fi as this phone\n• macOS Firewall: allow Node incoming connections`;
        setMessages((prev) => [...prev, {
          id: assistantId,
          role: 'assistant',
          text: failText,
          timestamp: new Date(),
        }]);
        maybeSpeakReply(reason);
        resolve();
      };

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
                  maybeSpeakReply(fullText);
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

      xhr.onerror = () => fail("Can't reach the server.");
      xhr.ontimeout = () => fail('Request timed out.');
      xhr.onload = () => {
        if (xhr.status >= 400) {
          fail(`Server error (${xhr.status}).`);
          return;
        }
        const newChunk = xhr.responseText.slice(processed);
        if (newChunk) handleChunk(newChunk);
        resolve();
      };

      xhr.send(JSON.stringify({
        message: text,
        cartItems: useCartStore.getState().items,
        history,
      }));
    });
  }, [input, loading, history, maybeSpeakReply]);

  const sendMessageRef = useRef(sendMessage);
  sendMessageRef.current = sendMessage;

  const { listening, partialTranscript, toggleListening, stopListening } = useSpeechInput({
    onFinalTranscript: (text) => {
      sendMessageRef.current(text);
    },
    onError: (message) => setVoiceError(message),
  });

  useEffect(() => {
    if (!listening) {
      micPulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(micPulse, { toValue: 1.12, duration: 500, useNativeDriver: true }),
        Animated.timing(micPulse, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [listening, micPulse]);

  useEffect(() => {
    if (loading && listening) stopListening();
  }, [loading, listening, stopListening]);

  const handleMicPress = () => {
    if (loading) return;
    setVoiceError(null);
    stopSpeaking();
    toggleListening();
  };

  const handleReplay = (text: string) => {
    stopSpeaking();
    speakBistro(text);
  };

  const switchMode = (next: ChatMode) => {
    if (next === chatMode) return;
    if (next === 'text') {
      if (listening) stopListening();
      Keyboard.dismiss();
    } else {
      stopSpeaking();
      setVoiceError(null);
      Keyboard.dismiss();
    }
    setChatMode(next);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        {chatMode === 'text' ? (
          <BistroAvatarLarge />
        ) : (
          <View style={[styles.voiceHeaderIcon, { borderColor: colors.border, backgroundColor: colors.bgElevated }]}>
            <Text style={[styles.voiceHeaderGlyph, { color: colors.gold }]}>◎</Text>
          </View>
        )}
        <View style={styles.headerText}>
          <Text style={[styles.headerName, { color: colors.cream }]}>Bistro</Text>
          <View style={styles.onlineRow}>
            <View style={[styles.onlineDot, { backgroundColor: chatMode === 'voice' ? colors.gold : '#52B788' }]} />
            <Text style={[styles.onlineText, { color: colors.creamMuted }]}>
              {chatMode === 'voice' ? 'Voice ordering' : 'Your dining assistant'}
            </Text>
          </View>
        </View>
        <ModeToggle mode={chatMode} onChange={switchMode} />
      </View>

      <View style={[styles.headerRule, { backgroundColor: colors.borderSubtle }]} />

      {chatMode === 'voice' ? (
        <VoiceModePanel bottomInset={TAB_BAR_INSET} />
      ) : (
      <Animated.View style={[styles.flex, { paddingBottom: inputBottom }]}>
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => (
            <ChatBubble
              message={item}
              onReplay={handleReplay}
            />
          )}
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
          {listening && (
            <Text style={[styles.listeningHint, { color: colors.gold }]}>
              Listening… {partialTranscript ? `"${partialTranscript}"` : 'speak now'}
            </Text>
          )}
          {voiceError ? (
            <Text style={[styles.voiceError, { color: '#E07A5F' }]}>{voiceError}</Text>
          ) : null}
          <View style={styles.inputRow}>
            <TouchableOpacity
              onPress={handleMicPress}
              disabled={loading}
              activeOpacity={0.8}
              accessibilityLabel={listening ? 'Stop listening' : 'Start voice input'}
            >
              <Animated.View
                style={[
                  styles.micBtn,
                  {
                    backgroundColor: listening ? colors.goldMuted : colors.bgElevated,
                    borderColor: listening ? colors.gold : colors.border,
                    transform: [{ scale: micPulse }],
                  },
                ]}
              >
                <Text style={[styles.micIcon, { color: listening ? colors.gold : colors.creamMuted }]}>
                  {listening ? '◉' : '🎙'}
                </Text>
              </Animated.View>
            </TouchableOpacity>

            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder={listening ? 'Listening…' : "Tell Bistro what you'd like..."}
              placeholderTextColor={colors.creamMuted}
              style={[styles.input, { color: colors.cream }]}
              multiline
              maxLength={300}
              returnKeyType="send"
              onSubmitEditing={() => sendMessage()}
              blurOnSubmit
              editable={!listening && !loading}
            />
            <TouchableOpacity onPress={() => sendMessage()} disabled={!input.trim() || loading || listening} activeOpacity={0.8}>
              <LinearGradient
                colors={input.trim() && !loading && !listening ? [colors.gold, colors.goldDim] : [colors.bgElevated, colors.bgElevated]}
                style={styles.sendBtn}
              >
                <Text style={[styles.sendIcon, { color: input.trim() && !loading && !listening ? '#0D0D0D' : colors.creamMuted }]}>↑</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
      )}
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
  voiceHeaderIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceHeaderGlyph: { fontSize: 22, lineHeight: 26 },
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
  bubbleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
    gap: 8,
  },
  bubbleTime: { fontFamily: Fonts.sans, fontSize: 10 },
  replayHint: { fontFamily: Fonts.sans, fontSize: 9, letterSpacing: 0.3 },
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
  listeningHint: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    letterSpacing: 0.3,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  voiceError: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  micBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  micIcon: { fontSize: 16, lineHeight: 18 },
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
