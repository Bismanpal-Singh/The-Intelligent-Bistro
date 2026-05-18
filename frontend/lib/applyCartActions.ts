import { MENU_ITEMS } from '../data/menu';
import { useCartStore, CartItem } from '../store/cartStore';

export type CartAction = {
  action: string;
  itemId?: string;
  cartLineId?: string;
  quantity?: number;
  customizations?: CartItem['customizations'];
  patch?: Record<string, unknown>;
};

export function applyCartActions(actions: CartAction[]) {
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
        store.updateQuantity(action.cartLineId, action.quantity!);
      } else if (action.itemId) {
        const lines = store.items.filter((i) => i.itemId === action.itemId);
        if (lines.length === 1) store.updateQuantity(lines[0].cartLineId, action.quantity!);
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
      if (action.patch) cartStore.patchCustomizations(lineId, action.patch as never);
      else if (action.customizations) cartStore.updateCustomizations(lineId, action.customizations);
    } else if (action.action === 'clear') {
      store.clearCart();
    }
  }
}

export function cartSummaryForVoice(): string {
  const items = useCartStore.getState().items;
  if (!items.length) return 'Cart is now empty.';
  return `Cart updated. ${items.length} line(s): ${items.map((i) => `${i.name} x${i.quantity}`).join(', ')}.`;
}
