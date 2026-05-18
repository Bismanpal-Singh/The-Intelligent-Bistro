import {
  customizationGuideForPrompt,
  formatCustomizationsHuman,
  lineUnitPrice,
  ITEM_CUSTOMIZATIONS,
} from './customizations.js';

export const MENU = [
  { id: 'crispy-calamari', name: 'Crispy Calamari', price: 14.0, category: 'starters', popular: true },
  { id: 'burrata', name: 'Burrata & Heritage Tomato', price: 16.0, category: 'starters', popular: true },
  { id: 'french-onion', name: 'French Onion Soup', price: 12.0, category: 'starters' },
  { id: 'garlic-focaccia', name: 'Rosemary Focaccia', price: 8.0, category: 'starters' },
  { id: 'avocado-toast', name: 'Avocado Toast', price: 13.0, category: 'starters' },
  { id: 'caprese-stack', name: 'Caprese Stack', price: 14.0, category: 'starters' },
  { id: 'spicy-chicken', name: 'Spicy Chicken Sandwich', price: 22.0, category: 'mains', popular: true },
  { id: 'wagyu-burger', name: 'Wagyu Beef Burger', price: 28.0, category: 'mains', popular: true },
  { id: 'grilled-salmon', name: 'Grilled Atlantic Salmon', price: 32.0, category: 'mains' },
  { id: 'veggie-wrap', name: 'Roasted Veggie Wrap', price: 18.0, category: 'mains' },
  { id: 'steak-frites', name: 'Steak Frites', price: 42.0, category: 'mains' },
  { id: 'mushroom-risotto', name: 'Wild Mushroom Risotto', price: 24.0, category: 'mains', popular: true },
  { id: 'cauliflower-steak', name: 'Roasted Cauliflower Steak', price: 21.0, category: 'mains' },
  { id: 'truffle-fries', name: 'Truffle Fries', price: 10.0, category: 'sides', popular: true },
  { id: 'onion-rings', name: 'Onion Rings', price: 9.0, category: 'sides' },
  { id: 'side-salad', name: 'Garden Salad', price: 8.0, category: 'sides' },
  { id: 'mac-cheese', name: 'Bistro Mac & Cheese', price: 11.0, category: 'sides' },
  { id: 'halloumi-fries', name: 'Halloumi Fries', price: 12.0, category: 'sides', popular: true },
  { id: 'house-lemonade', name: 'House Lemonade', price: 6.0, category: 'drinks', popular: true },
  { id: 'still-water', name: 'Still Water', price: 3.0, category: 'drinks' },
  { id: 'sparkling-water', name: 'Sparkling Water', price: 4.0, category: 'drinks' },
  { id: 'coke', name: 'Classic Coke', price: 4.5, category: 'drinks' },
  { id: 'orange-juice', name: 'Fresh Orange Juice', price: 7.0, category: 'drinks' },
  { id: 'bistro-cocktail', name: 'Bistro Signature', price: 12.0, category: 'drinks', popular: true },
  { id: 'lava-cake', name: 'Chocolate Lava Cake', price: 14.0, category: 'desserts', popular: true },
  { id: 'cheesecake', name: 'Burnt Basque Cheesecake', price: 12.0, category: 'desserts' },
  { id: 'panna-cotta', name: 'Vanilla Panna Cotta', price: 11.0, category: 'desserts' },
  { id: 'mango-sorbet', name: 'Mango Sorbet', price: 9.0, category: 'desserts' },
];

export const MENU_IDS = MENU.map((m) => m.id);

const menuText = MENU.map(
  (m) =>
    `- ${m.name} (${m.id}) — $${m.price.toFixed(2)} [${m.category}]${m.popular ? ' ★ popular' : ''}`
).join('\n');

/** Vocabulary hint for Realtime input transcription (UI “You” captions). Keep short for API limits. */
export function transcriptionHintForPrompt() {
  const menuNames = MENU.map((m) => m.name).join(', ');
  const labels = new Set();
  for (const group of Object.values(ITEM_CUSTOMIZATIONS)) {
    for (const key of ['addOns', 'removals', 'substitutions']) {
      for (const opt of group[key] ?? []) {
        if (opt.label) labels.add(opt.label);
      }
    }
  }
  const modifiers = [...labels].slice(0, 24).join(', ');
  const hint = `Restaurant order. Menu: ${menuNames}. Modifiers: ${modifiers}.`;
  return hint.length > 900 ? `${hint.slice(0, 897)}...` : hint;
}

export const VOICE_INSTRUCTIONS = `You are Bistro, an elegant voice dining assistant for The Intelligent Bistro — a premium restaurant. You are on a live voice call with a guest.

Speak naturally in short sentences (one or two). No markdown.

Tool rules (critical):
- When you need to change the cart, call the tool FIRST. Do not describe cart changes until you receive the tool result text.
- After the tool result, speak one short confirmation based ONLY on that result (never say an item failed if the result shows it in the cart).

When the guest asks what's popular, mention items marked ★. Use cart context for vague references to items already in the cart.

Customization rules:
- New item with modifiers → add_to_cart with a customizations object (addOns, removals, substitutions using option ids from the catalog below).
- Change an item already in the cart → update_customizations with patch (addRemovals, addAddOns, addSubstitutions, etc.) or a full customizations object. Do not add_to_cart again for the same line.
- Remove an entire line → remove_from_cart (not for ingredient-only requests).
- Use cartLineId from the cart context. If exactly one line matches an itemId, itemId alone is enough.

Customization catalog (map guest language to option ids):
${customizationGuideForPrompt()}

Never invent menu items.

Menu:
${menuText}`;

export const TOOLS = [
  {
    name: 'add_to_cart',
    description: "Add a menu item to the guest's order.",
    input_schema: {
      type: 'object',
      properties: {
        itemId: { type: 'string', enum: MENU_IDS, description: 'Menu item id' },
        quantity: { type: 'integer', minimum: 1, description: 'Quantity (default 1)' },
        customizations: {
          type: 'object',
          properties: {
            addOns: { type: 'array', items: { type: 'string' } },
            removals: { type: 'array', items: { type: 'string' } },
            substitutions: { type: 'array', items: { type: 'string' } },
            notes: { type: 'string' },
          },
        },
      },
      required: ['itemId', 'quantity'],
    },
  },
  {
    name: 'remove_from_cart',
    description: 'Remove from cart by cartLineId or all lines for itemId.',
    input_schema: {
      type: 'object',
      properties: {
        cartLineId: { type: 'string' },
        itemId: { type: 'string', enum: MENU_IDS },
      },
    },
  },
  {
    name: 'update_customizations',
    description: 'Modify customizations on an existing cart line.',
    input_schema: {
      type: 'object',
      properties: {
        cartLineId: { type: 'string' },
        itemId: { type: 'string', enum: MENU_IDS },
        patch: {
          type: 'object',
          properties: {
            addRemovals: { type: 'array', items: { type: 'string' } },
            removeRemovals: { type: 'array', items: { type: 'string' } },
            addAddOns: { type: 'array', items: { type: 'string' } },
            removeAddOns: { type: 'array', items: { type: 'string' } },
            addSubstitutions: { type: 'array', items: { type: 'string' } },
            removeSubstitutions: { type: 'array', items: { type: 'string' } },
            notes: { type: 'string' },
          },
        },
        customizations: {
          type: 'object',
          properties: {
            addOns: { type: 'array', items: { type: 'string' } },
            removals: { type: 'array', items: { type: 'string' } },
            substitutions: { type: 'array', items: { type: 'string' } },
            notes: { type: 'string' },
          },
        },
      },
    },
  },
  {
    name: 'update_quantity',
    description: 'Set quantity for a cart line.',
    input_schema: {
      type: 'object',
      properties: {
        cartLineId: { type: 'string' },
        itemId: { type: 'string', enum: MENU_IDS },
        quantity: { type: 'integer', minimum: 1 },
      },
      required: ['quantity'],
    },
  },
  {
    name: 'clear_cart',
    description: 'Clear the entire cart when the guest explicitly asks.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
];

export function toOpenAITools() {
  return TOOLS.map((t) => ({
    type: 'function',
    name: t.name,
    description: t.description,
    parameters: t.input_schema,
  }));
}

function customizationSummary(itemId, customizations = {}) {
  const human = formatCustomizationsHuman(itemId, customizations);
  const ids = [];
  if (customizations.removals?.length) ids.push(`removalIds: [${customizations.removals.join(', ')}]`);
  if (customizations.addOns?.length) ids.push(`addOnIds: [${customizations.addOns.join(', ')}]`);
  if (customizations.substitutions?.length) {
    ids.push(`substitutionIds: [${customizations.substitutions.join(', ')}]`);
  }
  if (customizations.notes) ids.push(`note: ${customizations.notes}`);
  const idPart = ids.length ? ` | ${ids.join(' | ')}` : '';
  return human ? ` | ${human}${idPart}` : idPart;
}

export function cartContextString(cartItems) {
  if (!cartItems?.length) return 'The cart is currently empty.';
  return (
    'Current cart:\n' +
    cartItems
      .map((i) => {
        const unit = lineUnitPrice(i.price, i.itemId, i.customizations ?? {});
        const lineTotal = unit * i.quantity;
        const c = customizationSummary(i.itemId, i.customizations);
        return `- ${i.name} x${i.quantity}${c} [cartLineId: ${i.cartLineId}, itemId: ${i.itemId}] — $${lineTotal.toFixed(2)}`;
      })
      .join('\n')
  );
}

function normalizeAddCustomizations(input) {
  if (input.customizations && typeof input.customizations === 'object') {
    return input.customizations;
  }
  const c = {};
  if (input.substitutions) c.substitutions = input.substitutions;
  if (input.removals) c.removals = input.removals;
  if (input.addOns) c.addOns = input.addOns;
  if (input.notes) c.notes = input.notes;
  return Object.keys(c).length ? c : undefined;
}

export function toolCallToActions(name, input) {
  const actions = [];
  if (name === 'add_to_cart') {
    if (!MENU_IDS.includes(input.itemId)) return actions;
    actions.push({
      action: 'add',
      itemId: input.itemId,
      quantity: input.quantity ?? 1,
      customizations: normalizeAddCustomizations(input),
    });
  } else if (name === 'remove_from_cart') {
    if (input.cartLineId) actions.push({ action: 'remove', cartLineId: input.cartLineId });
    else if (input.itemId && MENU_IDS.includes(input.itemId)) {
      actions.push({ action: 'remove', itemId: input.itemId });
    }
  } else if (name === 'update_customizations') {
    const payload = { action: 'update_customizations' };
    if (input.cartLineId) payload.cartLineId = input.cartLineId;
    else if (input.itemId && MENU_IDS.includes(input.itemId)) payload.itemId = input.itemId;
    else return actions;
    if (input.patch) payload.patch = normalizeCustomizationPatch(input.patch);
    if (input.customizations) payload.customizations = input.customizations;
    if (payload.patch || payload.customizations) actions.push(payload);
  } else if (name === 'update_quantity') {
    if (input.cartLineId) {
      actions.push({ action: 'update', cartLineId: input.cartLineId, quantity: input.quantity });
    } else if (input.itemId && MENU_IDS.includes(input.itemId)) {
      actions.push({ action: 'update', itemId: input.itemId, quantity: input.quantity });
    }
  } else if (name === 'clear_cart') {
    actions.push({ action: 'clear' });
  }
  return actions;
}

/** Models often send removals/addOns instead of addRemovals/addAddOns — normalize. */
function normalizeCustomizationPatch(patch) {
  if (!patch || typeof patch !== 'object') return patch;
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
