import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { Fonts, Spacing } from '../constants/theme';
import { MenuItem, CATEGORIES } from '../data/menu';
import { useCartStore } from '../store/cartStore';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const IMAGE_HEIGHT = 280;

type Props = {
  item: MenuItem | null;
  onClose: () => void;
};

const ALLERGEN_ICONS: Record<string, string> = {
  Gluten: '🌾',
  Dairy: '🥛',
  Eggs: '🥚',
  Fish: '🐟',
  Shellfish: '🦐',
  Nuts: '🥜',
  Soy: '🫘',
  Sesame: '🌿',
  Sulphites: '🍷',
};

export default function MenuItemModal({ item, onClose }: Props) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { addItem, removeItem, updateQuantity, items } = useCartStore();
  const cartEntry = item ? items.find((i) => i.id === item.id) : null;
  const [imgError, setImgError] = useState(false);

  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (item) {
      setImgError(false);
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 180 }),
      ]).start();
    }
  }, [item]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: SCREEN_HEIGHT, duration: 260, useNativeDriver: true }),
    ]).start(() => onClose());
  };

  if (!item) return null;

  const categoryEmoji = CATEGORIES.find((c) => c.id === item.category)?.emoji ?? '🍽';

  return (
    <Modal transparent visible={!!item} onRequestClose={handleClose} statusBarTranslucent>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={handleClose} activeOpacity={1} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.bgCard,
            transform: [{ translateY }],
            paddingBottom: insets.bottom + 16,
          },
        ]}
      >
        {/* Drag handle */}
        <View style={styles.handleWrap}>
          <View style={[styles.handle, { backgroundColor: colors.borderSubtle }]} />
        </View>

        {/* Close button */}
        <TouchableOpacity onPress={handleClose} style={[styles.closeBtn, { backgroundColor: colors.bgElevated }]} activeOpacity={0.8}>
          <Text style={[styles.closeBtnText, { color: colors.cream }]}>✕</Text>
        </TouchableOpacity>

        <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
          {/* Hero image */}
          <View style={styles.imageWrap}>
            {!imgError ? (
              <Image
                source={{ uri: item.image }}
                style={styles.heroImage}
                resizeMode="cover"
                onError={() => setImgError(true)}
              />
            ) : (
              <View style={[styles.heroFallback, { backgroundColor: colors.bgElevated }]}>
                <Text style={styles.heroFallbackEmoji}>{categoryEmoji}</Text>
              </View>
            )}
            <LinearGradient
              colors={['transparent', isDark ? 'rgba(20,20,20,0.95)' : 'rgba(255,255,255,0.95)']}
              style={styles.imageGradient}
              start={{ x: 0, y: 0.4 }}
              end={{ x: 0, y: 1 }}
            />
          </View>

          {/* Content */}
          <View style={styles.content}>
            {/* Badges */}
            <View style={styles.badges}>
              {item.popular && (
                <View style={[styles.popularBadge, { backgroundColor: colors.goldMuted, borderColor: colors.border }]}>
                  <Text style={[styles.popularText, { color: colors.gold }]}>★ POPULAR</Text>
                </View>
              )}
              {item.tags?.map((tag) => (
                <View key={tag} style={[styles.tagBadge, { backgroundColor: colors.bgElevated }]}>
                  <Text style={[styles.tagText, { color: colors.creamMuted }]}>{tag.toUpperCase()}</Text>
                </View>
              ))}
            </View>

            {/* Name & price */}
            <View style={styles.titleRow}>
              <Text style={[styles.itemName, { color: colors.cream }]}>{item.name}</Text>
              <Text style={[styles.itemPrice, { color: colors.gold }]}>${item.price.toFixed(2)}</Text>
            </View>

            {/* Description */}
            <Text style={[styles.itemDesc, { color: colors.creamMuted }]}>{item.description}</Text>

            {/* Divider */}
            <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

            {/* Nutrition row */}
            {item.calories !== undefined && (
              <View style={styles.nutritionRow}>
                <View style={[styles.nutritionCard, { backgroundColor: colors.bgElevated, borderColor: colors.borderSubtle }]}>
                  <Text style={[styles.nutritionValue, { color: colors.gold }]}>{item.calories}</Text>
                  <Text style={[styles.nutritionLabel, { color: colors.creamMuted }]}>kcal</Text>
                </View>
                <View style={[styles.nutritionCard, { backgroundColor: colors.bgElevated, borderColor: colors.borderSubtle }]}>
                  <Text style={[styles.nutritionValue, { color: colors.cream }]}>
                    {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
                  </Text>
                  <Text style={[styles.nutritionLabel, { color: colors.creamMuted }]}>course</Text>
                </View>
                <View style={[styles.nutritionCard, { backgroundColor: colors.bgElevated, borderColor: colors.borderSubtle }]}>
                  <Text style={[styles.nutritionValue, { color: colors.cream }]}>
                    {item.allergens && item.allergens.length > 0 ? item.allergens.length : '✓'}
                  </Text>
                  <Text style={[styles.nutritionLabel, { color: colors.creamMuted }]}>allergens</Text>
                </View>
              </View>
            )}

            {/* Allergens */}
            {item.allergens && item.allergens.length > 0 && (
              <View style={styles.allergensSection}>
                <Text style={[styles.sectionTitle, { color: colors.cream }]}>Allergen Information</Text>
                <View style={styles.allergensList}>
                  {item.allergens.map((a) => (
                    <View key={a} style={[styles.allergenPill, { backgroundColor: colors.bgElevated, borderColor: colors.borderSubtle }]}>
                      <Text style={styles.allergenEmoji}>{ALLERGEN_ICONS[a] ?? '⚠️'}</Text>
                      <Text style={[styles.allergenText, { color: colors.creamMuted }]}>{a}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {item.allergens?.length === 0 && (
              <View style={styles.allergensSection}>
                <Text style={[styles.sectionTitle, { color: colors.cream }]}>Allergen Information</Text>
                <Text style={[styles.noAllergens, { color: colors.creamMuted }]}>✓ No common allergens</Text>
              </View>
            )}

            <View style={{ height: 16 }} />
          </View>
        </ScrollView>

        {/* Bottom CTA */}
        <View style={[styles.bottomBar, { borderColor: colors.borderSubtle, backgroundColor: colors.bgCard }]}>
          {cartEntry ? (
            <View style={[styles.qtyControl, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}>
              <TouchableOpacity
                onPress={() => cartEntry.quantity === 1 ? removeItem(item.id) : updateQuantity(item.id, cartEntry.quantity - 1)}
                style={styles.qtyBtn}
                activeOpacity={0.7}
              >
                <Text style={[styles.qtyBtnText, { color: colors.gold }]}>−</Text>
              </TouchableOpacity>
              <Text style={[styles.qtyValue, { color: colors.cream }]}>{cartEntry.quantity} in order</Text>
              <TouchableOpacity onPress={() => updateQuantity(item.id, cartEntry.quantity + 1)} style={styles.qtyBtn} activeOpacity={0.7}>
                <Text style={[styles.qtyBtnText, { color: colors.gold }]}>+</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => addItem(item)} activeOpacity={0.85} style={styles.addBtnWrap}>
              <LinearGradient colors={[colors.gold, colors.goldDim]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.addBtn}>
                <Text style={[styles.addBtnText, { color: isDark ? '#0D0D0D' : '#FFFFFF' }]}>
                  Add to Order — ${item.price.toFixed(2)}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: SCREEN_HEIGHT * 0.92,
    overflow: 'hidden',
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  closeBtnText: {
    fontSize: 13,
    fontFamily: Fonts.sansBold,
    lineHeight: 16,
  },
  imageWrap: {
    height: IMAGE_HEIGHT,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: IMAGE_HEIGHT,
  },
  heroFallback: {
    width: '100%',
    height: IMAGE_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroFallbackEmoji: {
    fontSize: 72,
  },
  imageGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: IMAGE_HEIGHT * 0.5,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: 12,
  },
  badges: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  popularBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
  },
  popularText: {
    fontFamily: Fonts.sansBold,
    fontSize: 9,
    letterSpacing: 1,
  },
  tagBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: {
    fontFamily: Fonts.sans,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  itemName: {
    fontFamily: Fonts.display,
    fontSize: 32,
    lineHeight: 36,
    flex: 1,
  },
  itemPrice: {
    fontFamily: Fonts.sansBold,
    fontSize: 22,
    marginTop: 4,
  },
  itemDesc: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 21,
  },
  divider: {
    height: 1,
  },
  nutritionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  nutritionCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: Spacing.sm,
    alignItems: 'center',
    gap: 2,
  },
  nutritionValue: {
    fontFamily: Fonts.sansBold,
    fontSize: 16,
  },
  nutritionLabel: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  allergensSection: {
    gap: 10,
  },
  sectionTitle: {
    fontFamily: Fonts.sansBold,
    fontSize: 13,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  allergensList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  allergenPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 100,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  allergenEmoji: {
    fontSize: 13,
  },
  allergenText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
  },
  noAllergens: {
    fontFamily: Fonts.sans,
    fontSize: 13,
  },
  bottomBar: {
    borderTopWidth: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  addBtnWrap: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  addBtn: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 14,
  },
  addBtnText: {
    fontFamily: Fonts.sansBold,
    fontSize: 16,
    letterSpacing: 0.3,
  },
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  qtyBtn: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  qtyBtnText: {
    fontFamily: Fonts.sansBold,
    fontSize: 20,
    lineHeight: 22,
  },
  qtyValue: {
    fontFamily: Fonts.sansBold,
    fontSize: 15,
  },
});
