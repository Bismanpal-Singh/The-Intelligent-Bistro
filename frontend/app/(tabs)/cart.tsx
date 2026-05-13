import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { Fonts, Spacing } from '../../constants/theme';
import { useCartStore } from '../../store/cartStore';

function DashedLine() {
  const { colors } = useTheme();
  return (
    <View style={styles.dashedRow}>
      {Array.from({ length: 30 }).map((_, i) => (
        <View key={i} style={[styles.dash, { backgroundColor: colors.borderSubtle }]} />
      ))}
    </View>
  );
}

function CartRow({ item }: { item: ReturnType<typeof useCartStore.getState>['items'][0] }) {
  const { colors } = useTheme();
  const { updateQuantity, removeItem } = useCartStore();
  return (
    <View style={styles.cartRow}>
      <View style={styles.cartRowLeft}>
        <View style={[styles.cartQtyWrap, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}>
          <TouchableOpacity onPress={() => entry_qty === 1 ? removeItem(item.id) : updateQuantity(item.id, item.quantity - 1)} style={styles.cartQtyBtn} activeOpacity={0.7}>
            <Text style={[styles.cartQtyBtnText, { color: colors.gold }]}>−</Text>
          </TouchableOpacity>
          <Text style={[styles.cartQty, { color: colors.cream }]}>{item.quantity}</Text>
          <TouchableOpacity onPress={() => updateQuantity(item.id, item.quantity + 1)} style={styles.cartQtyBtn} activeOpacity={0.7}>
            <Text style={[styles.cartQtyBtnText, { color: colors.gold }]}>+</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.cartItemInfo}>
          <Text style={[styles.cartItemName, { color: colors.cream }]} numberOfLines={1}>{item.name}</Text>
          <Text style={[styles.cartItemUnit, { color: colors.creamMuted }]}>${item.price.toFixed(2)} each</Text>
        </View>
      </View>
      <View style={styles.cartRowRight}>
        <Text style={[styles.cartItemTotal, { color: colors.gold }]}>${(item.price * item.quantity).toFixed(2)}</Text>
        <TouchableOpacity onPress={() => removeItem(item.id)} activeOpacity={0.6} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[styles.removeBtn, { color: colors.creamMuted }]}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// needed to reference quantity outside closure
const entry_qty = 1; // placeholder, actual qty comes from item prop

function CartRowFixed({ item }: { item: ReturnType<typeof useCartStore.getState>['items'][0] }) {
  const { colors } = useTheme();
  const { updateQuantity, removeItem } = useCartStore();
  return (
    <View style={styles.cartRow}>
      <View style={styles.cartRowLeft}>
        <View style={[styles.cartQtyWrap, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}>
          <TouchableOpacity
            onPress={() => item.quantity === 1 ? removeItem(item.id) : updateQuantity(item.id, item.quantity - 1)}
            style={styles.cartQtyBtn}
            activeOpacity={0.7}
          >
            <Text style={[styles.cartQtyBtnText, { color: colors.gold }]}>−</Text>
          </TouchableOpacity>
          <Text style={[styles.cartQty, { color: colors.cream }]}>{item.quantity}</Text>
          <TouchableOpacity onPress={() => updateQuantity(item.id, item.quantity + 1)} style={styles.cartQtyBtn} activeOpacity={0.7}>
            <Text style={[styles.cartQtyBtnText, { color: colors.gold }]}>+</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.cartItemInfo}>
          <Text style={[styles.cartItemName, { color: colors.cream }]} numberOfLines={1}>{item.name}</Text>
          <Text style={[styles.cartItemUnit, { color: colors.creamMuted }]}>${item.price.toFixed(2)} each</Text>
        </View>
      </View>
      <View style={styles.cartRowRight}>
        <Text style={[styles.cartItemTotal, { color: colors.gold }]}>${(item.price * item.quantity).toFixed(2)}</Text>
        <TouchableOpacity onPress={() => removeItem(item.id)} activeOpacity={0.6} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[styles.removeBtn, { color: colors.creamMuted }]}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function CartScreen() {
  const { colors, isDark } = useTheme();
  const { items, totalPrice, totalItems, clearCart } = useCartStore();
  const subtotal = totalPrice();
  const tax = subtotal * 0.13;
  const total = subtotal + tax;

  const handlePlaceOrder = () => {
    if (items.length === 0) return;
    Alert.alert(
      'Order Placed',
      `Your order of $${total.toFixed(2)} has been sent to the kitchen. Enjoy!`,
      [{ text: 'Great!', onPress: clearCart }]
    );
  };

  if (items.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.cream }]}>Your Order</Text>
          <View style={[styles.headerUnderline, { backgroundColor: colors.gold }]} />
        </View>
        <View style={styles.emptyState}>
          <Text style={[styles.emptyIcon, { color: colors.creamMuted }]}>◉</Text>
          <Text style={[styles.emptyTitle, { color: colors.cream }]}>Nothing here yet</Text>
          <Text style={[styles.emptySubtitle, { color: colors.creamMuted }]}>
            Browse the menu or ask Bistro to add something for you.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.cream }]}>Your Order</Text>
          <View style={[styles.headerUnderline, { backgroundColor: colors.gold }]} />
        </View>
        <Text style={[styles.headerCount, { color: colors.creamMuted }]}>
          {totalItems()} item{totalItems() !== 1 ? 's' : ''}
        </Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.receipt, { backgroundColor: colors.bgCard, borderColor: colors.borderSubtle }]}>
          {/* Receipt header */}
          <View style={styles.receiptHeader}>
            <Text style={[styles.receiptBistro, { color: colors.gold }]}>THE BISTRO</Text>
            <Text style={[styles.receiptDate, { color: colors.creamMuted }]}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </Text>
            <Text style={[styles.receiptOrderNo, { color: colors.creamMuted }]}>
              ORDER #{Math.floor(Math.random() * 9000) + 1000}
            </Text>
          </View>

          <DashedLine />

          <View style={styles.itemsSection}>
            {items.map((item) => <CartRowFixed key={item.id} item={item} />)}
          </View>

          <DashedLine />

          <View style={styles.totals}>
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: colors.creamMuted }]}>Subtotal</Text>
              <Text style={[styles.totalValue, { color: colors.cream }]}>${subtotal.toFixed(2)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: colors.creamMuted }]}>Tax (13%)</Text>
              <Text style={[styles.totalValue, { color: colors.cream }]}>${tax.toFixed(2)}</Text>
            </View>
          </View>

          <View style={[styles.goldRule, { backgroundColor: colors.border }]} />

          <View style={styles.grandTotalRow}>
            <Text style={[styles.grandTotalLabel, { color: colors.cream }]}>Total</Text>
            <Text style={[styles.grandTotalValue, { color: colors.gold }]}>${total.toFixed(2)}</Text>
          </View>

          <DashedLine />

          <Text style={[styles.receiptFooter, { color: colors.creamMuted }]}>
            Thank you for dining with us.{'\n'}We hope to see you again soon.
          </Text>
        </View>

        <TouchableOpacity onPress={handlePlaceOrder} activeOpacity={0.85} style={styles.orderBtnWrap}>
          <LinearGradient
            colors={[colors.gold, colors.goldDim]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.orderBtn}
          >
            <Text style={[styles.orderBtnText, { color: isDark ? '#0D0D0D' : '#FFFFFF' }]}>
              Place Order — ${total.toFixed(2)}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity onPress={clearCart} activeOpacity={0.6} style={styles.clearBtn}>
          <Text style={[styles.clearBtnText, { color: colors.creamMuted }]}>Clear Order</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.md },
  headerTitle: { fontFamily: Fonts.serif, fontSize: 34, lineHeight: 40 },
  headerUnderline: { width: 40, height: 1.5, marginTop: 6 },
  headerCount: { fontFamily: Fonts.sans, fontSize: 13, letterSpacing: 0.5, marginBottom: 4 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: 120 },
  receipt: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', paddingVertical: Spacing.lg },
  receiptHeader: { alignItems: 'center', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, gap: 4 },
  receiptBistro: { fontFamily: Fonts.serif, fontSize: 22, letterSpacing: 6 },
  receiptDate: { fontFamily: Fonts.sans, fontSize: 12, letterSpacing: 0.5 },
  receiptOrderNo: { fontFamily: Fonts.sansMedium, fontSize: 11, letterSpacing: 2 },
  dashedRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, marginVertical: 2 },
  dash: { width: 5, height: 1 },
  itemsSection: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, gap: 14 },
  cartRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cartRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  cartRowRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cartQtyWrap: { flexDirection: 'row', alignItems: 'center', borderRadius: 6, borderWidth: 1 },
  cartQtyBtn: { paddingHorizontal: 8, paddingVertical: 5 },
  cartQtyBtnText: { fontFamily: Fonts.sansBold, fontSize: 14 },
  cartQty: { fontFamily: Fonts.sansBold, fontSize: 13, minWidth: 18, textAlign: 'center' },
  cartItemInfo: { flex: 1 },
  cartItemName: { fontFamily: Fonts.sansMedium, fontSize: 13 },
  cartItemUnit: { fontFamily: Fonts.sans, fontSize: 11, marginTop: 1 },
  cartItemTotal: { fontFamily: Fonts.sansBold, fontSize: 14 },
  removeBtn: { fontSize: 11 },
  totals: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, gap: 6 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { fontFamily: Fonts.sans, fontSize: 13 },
  totalValue: { fontFamily: Fonts.sans, fontSize: 13 },
  goldRule: { height: 1, marginHorizontal: Spacing.lg, marginVertical: 8 },
  grandTotalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  grandTotalLabel: { fontFamily: Fonts.serif, fontSize: 20 },
  grandTotalValue: { fontFamily: Fonts.serif, fontSize: 22 },
  receiptFooter: { fontFamily: Fonts.serifItalic, fontSize: 12, textAlign: 'center', paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, lineHeight: 18 },
  orderBtnWrap: { marginTop: Spacing.lg, borderRadius: 12, overflow: 'hidden' },
  orderBtn: { paddingVertical: 16, alignItems: 'center', borderRadius: 12 },
  orderBtnText: { fontFamily: Fonts.sansBold, fontSize: 16, letterSpacing: 0.5 },
  clearBtn: { marginTop: Spacing.sm, alignItems: 'center', paddingVertical: 12 },
  clearBtnText: { fontFamily: Fonts.sans, fontSize: 13, letterSpacing: 0.5 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: Spacing.xl, paddingBottom: 80 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontFamily: Fonts.serif, fontSize: 24 },
  emptySubtitle: { fontFamily: Fonts.sans, fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
