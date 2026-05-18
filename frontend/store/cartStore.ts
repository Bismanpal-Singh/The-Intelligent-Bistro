import { create } from 'zustand';
import { MenuItem } from '../data/menu';
import {
  applyCustomizationPatch,
  CartCustomizations,
  CustomizationPatch,
  customizationKey,
  formatCartCustomizations,
  lineUnitPrice,
  normalizeCustomizations,
} from '../data/customizations';

export type { CartCustomizations, CustomizationPatch } from '../data/customizations';
export { formatCartCustomizations, itemHasCustomizations } from '../data/customizations';

export type CartItem = {
  cartLineId: string;
  itemId: string;
  name: string;
  price: number;
  quantity: number;
  customizations: CartCustomizations;
};

type CartStore = {
  items: CartItem[];
  addItem: (item: MenuItem, quantity?: number, customizations?: CartCustomizations) => void;
  removeItem: (cartLineId: string) => void;
  removeAllForItem: (itemId: string) => void;
  updateQuantity: (cartLineId: string, quantity: number) => void;
  updateCustomizations: (cartLineId: string, customizations: CartCustomizations) => void;
  patchCustomizations: (cartLineId: string, patch: CustomizationPatch) => void;
  decrementItem: (itemId: string) => void;
  getItemQuantity: (itemId: string) => number;
  clearCart: () => void;
  totalItems: () => number;
  totalPrice: () => number;
  lineTotal: (line: CartItem) => number;
};

const newLineId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],

  addItem: (item, quantity = 1, customizations = {}) =>
    set((state) => {
      const normalized = normalizeCustomizations(customizations);
      const key = customizationKey(normalized);
      const existing = state.items.find(
        (i) => i.itemId === item.id && customizationKey(i.customizations) === key
      );

      if (existing) {
        return {
          items: state.items.map((i) =>
            i.cartLineId === existing.cartLineId
              ? { ...i, quantity: i.quantity + quantity }
              : i
          ),
        };
      }

      return {
        items: [
          ...state.items,
          {
            cartLineId: newLineId(),
            itemId: item.id,
            name: item.name,
            price: item.price,
            quantity,
            customizations: normalized,
          },
        ],
      };
    }),

  removeItem: (cartLineId) =>
    set((state) => ({ items: state.items.filter((i) => i.cartLineId !== cartLineId) })),

  removeAllForItem: (itemId) =>
    set((state) => ({ items: state.items.filter((i) => i.itemId !== itemId) })),

  updateQuantity: (cartLineId, quantity) =>
    set((state) => {
      if (quantity <= 0) {
        return { items: state.items.filter((i) => i.cartLineId !== cartLineId) };
      }
      return {
        items: state.items.map((i) =>
          i.cartLineId === cartLineId ? { ...i, quantity } : i
        ),
      };
    }),

  updateCustomizations: (cartLineId, customizations) =>
    set((state) => {
      const line = state.items.find((i) => i.cartLineId === cartLineId);
      if (!line) return state;

      const normalized = normalizeCustomizations(customizations);
      const key = customizationKey(normalized);
      const duplicate = state.items.find(
        (i) =>
          i.cartLineId !== cartLineId &&
          i.itemId === line.itemId &&
          customizationKey(i.customizations) === key
      );

      if (duplicate) {
        return {
          items: state.items
            .filter((i) => i.cartLineId !== cartLineId)
            .map((i) =>
              i.cartLineId === duplicate.cartLineId
                ? { ...i, quantity: i.quantity + line.quantity }
                : i
            ),
        };
      }

      return {
        items: state.items.map((i) =>
          i.cartLineId === cartLineId ? { ...i, customizations: normalized } : i
        ),
      };
    }),

  patchCustomizations: (cartLineId, patch) => {
    const line = get().items.find((i) => i.cartLineId === cartLineId);
    if (!line) return;
    get().updateCustomizations(cartLineId, applyCustomizationPatch(line.customizations, patch));
  },

  decrementItem: (itemId) => {
    const { items, updateQuantity, removeItem } = get();
    const lines = items.filter((i) => i.itemId === itemId);
    if (lines.length === 0) return;

    const line =
      lines.find((i) => customizationKey(i.customizations) === customizationKey()) ??
      lines[lines.length - 1];

    if (line.quantity <= 1) removeItem(line.cartLineId);
    else updateQuantity(line.cartLineId, line.quantity - 1);
  },

  getItemQuantity: (itemId) =>
    get().items
      .filter((i) => i.itemId === itemId)
      .reduce((sum, i) => sum + i.quantity, 0),

  clearCart: () => set({ items: [] }),

  totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

  lineTotal: (line) =>
    lineUnitPrice(line.price, line.itemId, line.customizations) * line.quantity,

  totalPrice: () => get().items.reduce((sum, i) => sum + get().lineTotal(i), 0),
}));
