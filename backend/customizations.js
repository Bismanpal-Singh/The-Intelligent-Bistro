/** Customization catalog — keep in sync with frontend/data/customizations.ts */
export const ITEM_CUSTOMIZATIONS = {
  'wagyu-burger': {
    addOns: [
      { id: 'extra-onion', label: 'Extra onion', price: 1 },
      { id: 'extra-cheese', label: 'Extra cheddar', price: 2 },
      { id: 'extra-bacon', label: 'Crispy bacon', price: 3 },
      { id: 'extra-aioli', label: 'Extra truffle aioli', price: 1.5 },
    ],
    removals: [
      { id: 'no-tomato', label: 'No tomato' },
      { id: 'no-onion', label: 'No onion' },
      { id: 'no-cheese', label: 'No cheddar' },
      { id: 'no-aioli', label: 'No aioli' },
    ],
    substitutions: [
      { id: 'gf-bun', label: 'Gluten-free bun', price: 2 },
      { id: 'lettuce-wrap', label: 'Lettuce wrap (no bun)' },
    ],
  },
  'spicy-chicken': {
    addOns: [
      { id: 'extra-slaw', label: 'Extra pickled slaw', price: 1.5 },
      { id: 'extra-glaze', label: 'Extra gochujang glaze', price: 1 },
    ],
    removals: [
      { id: 'no-slaw', label: 'No slaw' },
      { id: 'mild-glaze', label: 'Mild glaze (less heat)' },
    ],
  },
  'veggie-wrap': {
    addOns: [
      { id: 'extra-feta', label: 'Extra feta', price: 2 },
      { id: 'extra-hummus', label: 'Extra hummus', price: 1.5 },
    ],
    removals: [
      { id: 'no-feta', label: 'No feta' },
      { id: 'no-hummus', label: 'No hummus' },
    ],
  },
};

const NL_ALIASES = `
Natural language → option id (use these when interpreting guest requests):
- wagyu-burger: "no onion/onions" → no-onion | "no tomato" → no-tomato | "no cheese" → no-cheese | "no aioli" → no-aioli | "extra cheese" → extra-cheese | "extra onion" → extra-onion | "bacon" → extra-bacon | "gluten free bun" → gf-bun | "lettuce wrap" → lettuce-wrap
- spicy-chicken: "no slaw" → no-slaw | "mild/less spicy" → mild-glaze | "extra slaw" → extra-slaw | "extra glaze" → extra-glaze
- veggie-wrap: "no feta" → no-feta | "no hummus" → no-hummus | "extra feta" → extra-feta | "extra hummus" → extra-hummus
`;

export function customizationGuideForPrompt() {
  const lines = Object.entries(ITEM_CUSTOMIZATIONS).map(([itemId, group]) => {
    const fmt = (opts) => opts?.map((o) => `${o.id} (${o.label})`).join(', ') ?? '';
    return `- ${itemId}: addOns [${fmt(group.addOns)}] | removals [${fmt(group.removals)}] | substitutions [${fmt(group.substitutions)}]`;
  });
  return `${lines.join('\n')}\n${NL_ALIASES}`;
}

export function lineUnitPrice(basePrice, itemId, customizations = {}) {
  const group = ITEM_CUSTOMIZATIONS[itemId];
  if (!group) return basePrice;
  let extra = 0;
  for (const id of [...(customizations.addOns ?? []), ...(customizations.substitutions ?? [])]) {
    const opt =
      group.addOns?.find((o) => o.id === id) ?? group.substitutions?.find((o) => o.id === id);
    if (opt?.price) extra += opt.price;
  }
  return basePrice + extra;
}

export function formatCustomizationsHuman(itemId, customizations = {}) {
  const group = ITEM_CUSTOMIZATIONS[itemId];
  if (!group) return '';

  const label = (kind, id) => {
    const list =
      kind === 'add' ? group.addOns : kind === 'remove' ? group.removals : group.substitutions;
    return list?.find((o) => o.id === id)?.label;
  };

  const parts = [];
  for (const id of customizations.removals ?? []) {
    const l = label('remove', id);
    if (l) parts.push(l);
  }
  for (const id of customizations.substitutions ?? []) {
    const l = label('substitute', id);
    if (l) parts.push(l);
  }
  for (const id of customizations.addOns ?? []) {
    const l = label('add', id);
    if (l) parts.push(`+ ${l}`);
  }
  if (customizations.notes?.trim()) parts.push(`"${customizations.notes.trim()}"`);
  return parts.join(' · ');
}
