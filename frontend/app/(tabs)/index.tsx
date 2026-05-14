import React, { useState, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  FlatList, Animated, Image, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { Fonts, Spacing } from '../../constants/theme';
import { CATEGORIES, MENU_ITEMS, MenuItem } from '../../data/menu';
import { useCartStore } from '../../store/cartStore';
import MenuItemModal from '../../components/MenuItemModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FEATURED_CARD_WIDTH = SCREEN_WIDTH * 0.58;
const FEATURED_CARD_HEIGHT = 260;

const TABS = CATEGORIES.filter((c) => c.id !== 'all');
const POPULAR_ITEMS = MENU_ITEMS.filter((m) => m.popular);

// ─── Theme Toggle ──────────────────────────────────────────────────────────────
function ThemeToggle() {
  const { isDark, toggleTheme, colors } = useTheme();
  return (
    <TouchableOpacity onPress={toggleTheme} activeOpacity={0.7} style={[styles.themeToggle, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}>
      <Text style={styles.themeIcon}>{isDark ? '☀' : '☾'}</Text>
      <Text style={[styles.themeLabel, { color: colors.gold }]}>{isDark ? 'Light' : 'Dark'}</Text>
    </TouchableOpacity>
  );
}

// ─── Featured Card ─────────────────────────────────────────────────────────────
function FeaturedCard({ item, onPress }: { item: MenuItem; onPress: () => void }) {
  const { colors } = useTheme();
  const [imgError, setImgError] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 50 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20 }),
    ]).start();
    onPress();
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={1}>
      <Animated.View style={[styles.featuredCard, { transform: [{ scale }] }]}>
        {!imgError ? (
          <Image
            source={{ uri: item.image }}
            style={styles.featuredImage}
            resizeMode="cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <View style={[styles.featuredImageFallback, { backgroundColor: colors.bgElevated }]}>
            <Text style={styles.featuredFallbackEmoji}>🍽</Text>
          </View>
        )}

        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.82)']}
          style={styles.featuredGradient}
          start={{ x: 0, y: 0.3 }}
          end={{ x: 0, y: 1 }}
        />

        {/* Top badge */}
        <View style={[styles.featuredBadge, { backgroundColor: colors.goldMuted, borderColor: colors.gold }]}>
          <Text style={[styles.featuredBadgeText, { color: colors.gold }]}>★ TONIGHT</Text>
        </View>

        {/* Bottom overlay */}
        <View style={styles.featuredOverlay}>
          <Text style={styles.featuredName} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.featuredPrice}>${item.price.toFixed(2)}</Text>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Quantity Control ──────────────────────────────────────────────────────────
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

// ─── Menu Card ─────────────────────────────────────────────────────────────────
function MenuCard({ item, onPress, index = 0 }: { item: MenuItem; onPress: () => void; index?: number }) {
  const { colors, isDark } = useTheme();
  const addItem = useCartStore((s) => s.addItem);
  const cartItems = useCartStore((s) => s.items);
  const cartEntry = cartItems.find((i) => i.id === item.id);
  const [imgError, setImgError] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 220, delay: index * 40, useNativeDriver: true }).start();
  }, []);

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
      <Animated.View style={[styles.card, { opacity, transform: [{ scale }], borderColor: colors.borderSubtle, shadowColor: colors.shadow }]}>
        <LinearGradient colors={[gp[0], gp[1]]} style={styles.cardGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View style={[styles.cardGoldBar, { backgroundColor: colors.gold }]} />
          <View style={styles.cardBody}>
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

// ─── Menu Screen ───────────────────────────────────────────────────────────────
export default function MenuScreen() {
  const [activeTab, setActiveTab] = useState(TABS[0].id);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const { colors } = useTheme();
  const tabScrollRef = useRef<ScrollView>(null);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  const DIETARY_FILTERS = [
    { id: 'vegan',        label: 'Vegan',        emoji: '🌱' },
    { id: 'vegetarian',   label: 'Vegetarian',   emoji: '🥗' },
    { id: 'spicy',        label: 'Spicy',        emoji: '🌶' },
    { id: 'gluten-free',  label: 'Gluten-Free',  emoji: '🌾' },
    { id: 'dairy-free',   label: 'Dairy-Free',   emoji: '🥛' },
    { id: 'nut-free',     label: 'Nut-Free',     emoji: '🥜' },
    { id: 'low-cal',      label: 'Low-Cal',      emoji: '⚡' },
  ];

  const matchesFilter = (item: MenuItem, filterId: string): boolean => {
    switch (filterId) {
      case 'vegan':       return item.tags?.includes('vegan') ?? false;
      case 'vegetarian':  return item.tags?.includes('vegetarian') ?? false;
      case 'spicy':       return item.tags?.includes('spicy') ?? false;
      case 'gluten-free': return !(item.allergens?.includes('Gluten') ?? false);
      case 'dairy-free':  return !(item.allergens?.includes('Dairy') ?? false);
      case 'nut-free':    return !(item.allergens?.includes('Nuts') ?? false);
      case 'low-cal':     return item.calories !== undefined && item.calories < 400;
      default:            return true;
    }
  };

  const toggleFilter = (id: string) => {
    setActiveFilters((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  const filtered = MENU_ITEMS.filter((i) => {
    if (i.category !== activeTab) return false;
    if (activeFilters.length === 0) return true;
    return activeFilters.every((f) => matchesFilter(i, f));
  });

  const switchTab = (id: string) => {
    if (id === activeTab) return;
    setActiveTab(id);
  };

  const ListHeader = (
    <View>
      {/* ── Page header ── */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Text style={[styles.headerEyebrow, { color: colors.creamMuted }]}>Welcome to</Text>
          <ThemeToggle />
        </View>
        <Text style={[styles.headerTitle, { color: colors.cream }]}>The Bistro</Text>
        <View style={[styles.headerDivider, { backgroundColor: colors.gold }]} />
        <Text style={[styles.headerTagline, { color: colors.creamMuted }]}>Fine dining, simplified.</Text>
      </View>

      {/* ── Tonight's Menu ── */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.cream }]}>Tonight's Menu</Text>
        <View style={[styles.sectionLine, { backgroundColor: colors.borderSubtle }]} />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.featuredRow}
      >
        {POPULAR_ITEMS.map((item) => (
          <FeaturedCard key={item.id} item={item} onPress={() => setSelectedItem(item)} />
        ))}
      </ScrollView>

      {/* ── Category Tabs ── */}
      <View style={[styles.tabBar, { borderBottomColor: colors.borderSubtle }]}>
        <ScrollView
          ref={tabScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabRow}
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => switchTab(tab.id)}
                style={styles.tab}
                activeOpacity={0.7}
              >
                <Text style={styles.tabEmoji}>{tab.emoji}</Text>
                <Text style={[
                  styles.tabLabel,
                  { color: isActive ? colors.gold : colors.creamMuted },
                  isActive && { fontFamily: Fonts.sansBold },
                ]}>
                  {tab.label}
                </Text>
                {isActive && <View style={[styles.tabIndicator, { backgroundColor: colors.gold }]} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Dietary Filters ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {DIETARY_FILTERS.map((f) => {
          const active = activeFilters.includes(f.id);
          return (
            <TouchableOpacity
              key={f.id}
              onPress={() => toggleFilter(f.id)}
              activeOpacity={0.75}
              style={[
                styles.filterChip,
                { borderColor: active ? colors.gold : colors.borderSubtle,
                  backgroundColor: active ? colors.goldMuted : 'transparent' },
              ]}
            >
              <Text style={styles.filterEmoji}>{f.emoji}</Text>
              <Text style={[styles.filterLabel, { color: active ? colors.gold : colors.creamMuted,
                fontFamily: active ? Fonts.sansBold : Fonts.sans }]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
        {activeFilters.length > 0 && (
          <TouchableOpacity onPress={() => setActiveFilters([])} activeOpacity={0.7} style={styles.clearFilters}>
            <Text style={[styles.clearFiltersText, { color: colors.creamMuted }]}>Clear</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <MenuCard item={item} index={index} onPress={() => setSelectedItem(item)} />
        )}
        ListEmptyComponent={
          <View style={styles.emptyFilter}>
            <Text style={[styles.emptyFilterText, { color: colors.creamMuted }]}>
              No items match your dietary filters in this category.
            </Text>
          </View>
        }
        ListHeaderComponent={ListHeader}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
      />

      <MenuItemModal item={selectedItem} onClose={() => setSelectedItem(null)} />
    </SafeAreaView>

  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: { paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  headerEyebrow: { fontFamily: Fonts.displayItalic, fontSize: 15, letterSpacing: 0.3 },
  headerTitle: { fontFamily: Fonts.display, fontSize: 48, letterSpacing: 0, lineHeight: 52 },
  headerDivider: { width: 40, height: 1.5, marginVertical: Spacing.sm },
  headerTagline: { fontFamily: Fonts.sans, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' },
  themeToggle: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 100, borderWidth: 1 },
  themeIcon: { fontSize: 13 },
  themeLabel: { fontFamily: Fonts.sansMedium, fontSize: 11, letterSpacing: 0.3 },

  // Section header
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: Spacing.md, marginTop: Spacing.sm },
  sectionTitle: { fontFamily: Fonts.serif, fontSize: 20, letterSpacing: 0.3 },
  sectionLine: { flex: 1, height: 1 },

  // Featured cards
  featuredRow: { paddingRight: Spacing.lg, gap: 12 },
  featuredCard: {
    width: FEATURED_CARD_WIDTH,
    height: FEATURED_CARD_HEIGHT,
    borderRadius: 18,
    overflow: 'hidden',
  },
  featuredImage: { width: '100%', height: '100%' },
  featuredImageFallback: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  featuredFallbackEmoji: { fontSize: 48 },
  featuredGradient: { ...StyleSheet.absoluteFillObject },
  featuredBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  featuredBadgeText: { fontFamily: Fonts.sansBold, fontSize: 8, letterSpacing: 1.5 },
  featuredOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 14 },
  featuredName: { fontFamily: Fonts.serif, fontSize: 18, color: '#F5F0E8', lineHeight: 22, marginBottom: 4 },
  featuredPrice: { fontFamily: Fonts.sansBold, fontSize: 15, color: '#C9A84C' },

  // Tab bar
  tabBar: { borderBottomWidth: 1, marginTop: Spacing.lg },
  tabRow: { flexDirection: 'row', paddingBottom: 0 },
  tab: { paddingHorizontal: 16, paddingBottom: 12, paddingTop: 4, alignItems: 'center', gap: 4, position: 'relative' },
  tabEmoji: { fontSize: 16 },
  tabLabel: { fontFamily: Fonts.sans, fontSize: 12, letterSpacing: 0.3 },
  tabIndicator: { position: 'absolute', bottom: 0, left: 16, right: 16, height: 2, borderRadius: 1 },

  // Dietary filters
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: Spacing.md, paddingBottom: Spacing.sm, paddingRight: Spacing.lg },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 100, paddingHorizontal: 12, paddingVertical: 6 },
  filterEmoji: { fontSize: 12 },
  filterLabel: { fontSize: 12, letterSpacing: 0.2 },
  clearFilters: { paddingHorizontal: 8, paddingVertical: 6 },
  clearFiltersText: { fontFamily: Fonts.sans, fontSize: 12, textDecorationLine: 'underline' },
  emptyFilter: { paddingVertical: 40, alignItems: 'center' },
  emptyFilterText: { fontFamily: Fonts.sans, fontSize: 14, textAlign: 'center' },

  // List
  listContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: 120 },

  // Menu card
  card: { borderRadius: 16, overflow: 'hidden', borderWidth: 1, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
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
  cardRight: { width: 96, padding: Spacing.sm, paddingLeft: 0, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
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
