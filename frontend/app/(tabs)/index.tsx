import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Animated,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { Fonts, Spacing } from '../../constants/theme';
import { CATEGORIES, MENU_ITEMS, MenuItem } from '../../data/menu';
import { useCartStore } from '../../store/cartStore';
import MenuItemModal from '../../components/MenuItemModal';

function ThemeToggle() {
  const { isDark, toggleTheme, colors } = useTheme();
  return (
    <TouchableOpacity onPress={toggleTheme} activeOpacity={0.7} style={[styles.themeToggle, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}>
      <Text style={styles.themeIcon}>{isDark ? '☀' : '☾'}</Text>
      <Text style={[styles.themeLabel, { color: colors.gold }]}>{isDark ? 'Light' : 'Dark'}</Text>
    </TouchableOpacity>
  );
}

function CategoryPill({ label, emoji, active, onPress }: { label: string; emoji: string; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
      <View style={[
        styles.pillInner,
        { backgroundColor: colors.pillBg, borderColor: colors.borderSubtle },
        active && { backgroundColor: colors.goldMuted, borderColor: colors.gold },
      ]}>
        <Text style={styles.pillEmoji}>{emoji}</Text>
        <Text style={[styles.pillLabel, { color: active ? colors.gold : colors.creamMuted, fontFamily: active ? Fonts.sansBold : Fonts.sans }]}>
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function QuantityControl({ item }: { item: MenuItem }) {
  const { colors } = useTheme();
  const { updateQuantity, removeItem, items } = useCartStore();
  const entry = items.find((i) => i.id === item.id);
  if (!entry) return null;
  return (
    <View style={[styles.qtyControl, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}>
      <TouchableOpacity onPress={() => entry.quantity === 1 ? removeItem(item.id) : updateQuantity(item.id, entry.quantity - 1)} style={styles.qtyBtn} activeOpacity={0.7}>
        <Text style={[styles.qtyBtnText, { color: colors.gold }]}>−</Text>
      </TouchableOpacity>
      <Text style={[styles.qtyValue, { color: colors.cream }]}>{entry.quantity}</Text>
      <TouchableOpacity onPress={() => updateQuantity(item.id, entry.quantity + 1)} style={styles.qtyBtn} activeOpacity={0.7}>
        <Text style={[styles.qtyBtnText, { color: colors.gold }]}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

function MenuCard({ item, onPress }: { item: MenuItem; onPress: () => void }) {
  const { colors, isDark } = useTheme();
  const addItem = useCartStore((s) => s.addItem);
  const cartItems = useCartStore((s) => s.items);
  const cartEntry = cartItems.find((i) => i.id === item.id);
  const [imgError, setImgError] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;

  const handleAdd = () => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 50 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20 }),
    ]).start();
    addItem(item);
  };

  const gradients: [string, string][] = isDark
    ? [['#1A1208', '#2A1E0A'], ['#0A1A14', '#0E2218'], ['#0F0A1A', '#1A0E2A'], ['#1A0A0A', '#2A0E0E'], ['#0A141A', '#0E1E2A']]
    : [['#FFF8EE', '#FFF3E0'], ['#F0FFF4', '#E8F8EE'], ['#F5F0FF', '#EDE8FF'], ['#FFF0F0', '#FFE8E8'], ['#F0F8FF', '#E8F4FF']];
  const gp = gradients[item.id.charCodeAt(0) % gradients.length];

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.92}>
    <Animated.View style={[styles.card, { transform: [{ scale }], borderColor: colors.borderSubtle, shadowColor: colors.shadow }]}>
      <LinearGradient colors={[gp[0], gp[1]]} style={styles.cardGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={[styles.cardGoldBar, { backgroundColor: colors.gold }]} />

        <View style={styles.cardBody}>
          {/* Left: text content */}
          <View style={styles.cardContent}>
            <View style={styles.cardBadges}>
              {item.popular && (
                <View style={[styles.popularBadge, { backgroundColor: colors.goldMuted, borderColor: colors.border }]}>
                  <Text style={[styles.popularText, { color: colors.gold }]}>POPULAR</Text>
                </View>
              )}
              {item.tags?.map((tag) => (
                <View key={tag} style={[styles.tagBadge, { backgroundColor: colors.bgElevated }]}>
                  <Text style={[styles.tagText, { color: colors.creamMuted }]}>{tag.toUpperCase()}</Text>
                </View>
              ))}
            </View>
            <Text style={[styles.itemName, { color: colors.cream }]} numberOfLines={2}>{item.name}</Text>
            <Text style={[styles.itemDesc, { color: colors.creamMuted }]} numberOfLines={2}>{item.description}</Text>
            <Text style={[styles.price, { color: colors.gold }]}>${item.price.toFixed(2)}</Text>
          </View>

          {/* Right: image + add button */}
          <View style={styles.cardRight}>
            <View style={[styles.cardImageWrap, { backgroundColor: colors.bgElevated }]}>
              {!imgError ? (
                <Image source={{ uri: item.image }} style={styles.cardImage} onError={() => setImgError(true)} resizeMode="cover" />
              ) : (
                <View style={styles.cardImageFallback}>
                  <Text style={styles.cardImageFallbackEmoji}>
                    {CATEGORIES.find((c) => c.id === item.category)?.emoji ?? '🍽'}
                  </Text>
                </View>
              )}
            </View>
            {cartEntry ? (
              <QuantityControl item={item} />
            ) : (
              <TouchableOpacity onPress={handleAdd} style={[styles.addBtn, { backgroundColor: colors.goldMuted, borderColor: colors.border }]} activeOpacity={0.8}>
                <Text style={[styles.addBtnText, { color: colors.gold }]}>+ Add</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </LinearGradient>
    </Animated.View>
    </TouchableOpacity>
  );
}

export default function MenuScreen() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const { colors } = useTheme();

  const filtered = activeCategory === 'all' ? MENU_ITEMS : MENU_ITEMS.filter((i) => i.category === activeCategory);

  const ListHeader = (
    <View>
      {/* Header */}
      <View style={styles.header}>
        {/* Top row: eyebrow + toggle */}
        <View style={styles.headerTopRow}>
          <Text style={[styles.headerEyebrow, { color: colors.creamMuted }]}>Welcome to</Text>
          <ThemeToggle />
        </View>
        {/* Title full width */}
        <Text style={[styles.headerTitle, { color: colors.cream }]}>The Bistro</Text>
        <View style={[styles.headerDivider, { backgroundColor: colors.gold }]} />
        <Text style={[styles.headerTagline, { color: colors.creamMuted }]}>Fine dining, simplified.</Text>
      </View>

      {/* Category pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow} style={styles.pillScroll}>
        {CATEGORIES.map((cat) => (
          <CategoryPill key={cat.id} label={cat.label} emoji={cat.emoji} active={activeCategory === cat.id} onPress={() => setActiveCategory(cat.id)} />
        ))}
      </ScrollView>

      <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MenuCard item={item} onPress={() => setSelectedItem(item)} />}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={[styles.listContent, { paddingBottom: 120 }]}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
      />

      <MenuItemModal item={selectedItem} onClose={() => setSelectedItem(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  headerEyebrow: { fontFamily: Fonts.displayItalic, fontSize: 15, letterSpacing: 0.3 },
  headerTitle: { fontFamily: Fonts.display, fontSize: 48, letterSpacing: 0, lineHeight: 52 },
  headerDivider: { width: 40, height: 1.5, marginVertical: Spacing.sm },
  headerTagline: { fontFamily: Fonts.sans, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' },
  themeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 100,
    borderWidth: 1,
  },
  themeIcon: { fontSize: 13 },
  themeLabel: { fontFamily: Fonts.sansMedium, fontSize: 11, letterSpacing: 0.3 },
  pillScroll: { marginTop: Spacing.md },
  pillRow: { gap: Spacing.sm, flexDirection: 'row' },
  pillInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
    gap: 5,
    marginRight: Spacing.xs,
  },
  pillEmoji: { fontSize: 12 },
  pillLabel: { fontSize: 12, letterSpacing: 0.3 },
  divider: { height: 1, marginTop: Spacing.md },
  listContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  cardGradient: { flexDirection: 'row' },
  cardGoldBar: { width: 3, opacity: 0.8 },
  cardBody: { flex: 1, flexDirection: 'row', alignItems: 'stretch' },
  cardContent: { flex: 1, padding: Spacing.md, gap: 6, justifyContent: 'center' },
  cardBadges: { flexDirection: 'row', gap: 5, flexWrap: 'wrap' },
  popularBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1 },
  popularText: { fontFamily: Fonts.sansBold, fontSize: 8, letterSpacing: 1 },
  tagBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  tagText: { fontFamily: Fonts.sans, fontSize: 8, letterSpacing: 0.8 },
  itemName: { fontFamily: Fonts.serif, fontSize: 17, lineHeight: 22 },
  itemDesc: { fontFamily: Fonts.sans, fontSize: 12, lineHeight: 17 },
  price: { fontFamily: Fonts.sansBold, fontSize: 16 },
  cardRight: {
    width: 96,
    padding: Spacing.sm,
    paddingLeft: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  cardImageWrap: { width: 80, height: 80, borderRadius: 10, overflow: 'hidden' },
  cardImage: { width: 80, height: 80 },
  cardImageFallback: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center' },
  cardImageFallbackEmoji: { fontSize: 28 },
  addBtn: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, width: 80, alignItems: 'center' },
  addBtnText: { fontFamily: Fonts.sansBold, fontSize: 12, letterSpacing: 0.3 },
  qtyControl: { flexDirection: 'row', alignItems: 'center', borderRadius: 8, borderWidth: 1, overflow: 'hidden', width: 80, justifyContent: 'space-between' },
  qtyBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  qtyBtnText: { fontFamily: Fonts.sansBold, fontSize: 15, lineHeight: 18 },
  qtyValue: { fontFamily: Fonts.sansBold, fontSize: 13, minWidth: 20, textAlign: 'center' },
});
