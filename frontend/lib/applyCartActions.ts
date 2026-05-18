import { MENU_ITEMS } from '../data/menu';
import { formatCartCustomizations, lineUnitPrice } from '../data/customizations';
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
      const patch = normalizePatch(action.patch);
      if (patch) cartStore.patchCustomizations(lineId, patch);
      else if (action.customizations) cartStore.updateCustomizations(lineId, action.customizations);
    } else if (action.action === 'clear') {
      store.clearCart();
    }
  }
}

function normalizePatch(patch?: Record<string, unknown>) {
  if (!patch) return undefined;
  const p = { ...patch };
  if (p.removals && !p.addRemovals) {
    p.addRemovals = p.removals;
    delete p.removals;
  }
  if (p.addOns && !p.addAddOns) {
    p.addAddOns = p.addOns;
    delete p.addOns;
  }
  if (p.substitutions && !p.addSubstitutions) {
    p.addSubstitutions = p.substitutions;
    delete p.substitutions;
  }
  return p;
}

/** Full cart snapshot for the model (matches backend cartContextString). */
export function cartContextForVoice(): string {
  const items = useCartStore.getState().items;
  if (!items.length) return 'The cart is currently empty.';
  return (
    'Current cart:\n' +
    items
      .map((i) => {
        const human = formatCartCustomizations(i.itemId, i.customizations ?? {});
        const unit = lineUnitPrice(i.price, i.itemId, i.customizations ?? {});
        const lineTotal = unit * i.quantity;
        const c = human ? ` | ${human}` : '';
        const ids: string[] = [];
        const cus = i.customizations ?? {};
        if (cus.removals?.length) ids.push(`removalIds: [${cus.removals.join(', ')}]`);
        if (cus.addOns?.length) ids.push(`addOnIds: [${cus.addOns.join(', ')}]`);
        if (cus.substitutions?.length) ids.push(`substitutionIds: [${cus.substitutions.join(', ')}]`);
        if (cus.notes) ids.push(`note: ${cus.notes}`);
        const idPart = ids.length ? ` | ${ids.join(' | ')}` : '';
        return `- ${i.name} x${i.quantity}${c}${idPart} [cartLineId: ${i.cartLineId}, itemId: ${i.itemId}] — $${lineTotal.toFixed(2)}`;
      })
      .join('\n')
  );
}

/** Tool result text — model must read this before speaking. */
export function cartToolResultForVoice(): string {
  const cart = cartContextForVoice();
  if (cart.startsWith('The cart is currently empty')) {
    return `TOOL_RESULT: No change — cart is still empty.\n${cart}`;
  }
  return `TOOL_RESULT: Success.\n${cart}`;
}

export function cartSummaryForVoice(): string {
  return cartContextForVoice();
}
