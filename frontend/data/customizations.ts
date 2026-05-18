export type CustomizationKind = 'add' | 'remove' | 'substitute';

export type CustomizationOption = {
  id: string;
  label: string;
  kind: CustomizationKind;
  price?: number;
};

export type ItemCustomizationGroup = {
  addOns?: CustomizationOption[];
  removals?: CustomizationOption[];
  substitutions?: CustomizationOption[];
};

export type CartCustomizations = {
  addOns?: string[];
  removals?: string[];
  substitutions?: string[];
  notes?: string;
};

export const ITEM_CUSTOMIZATIONS: Record<string, ItemCustomizationGroup> = {
  'wagyu-burger': {
    addOns: [
      { id: 'extra-onion', label: 'Extra onion', kind: 'add', price: 1 },
      { id: 'extra-cheese', label: 'Extra cheddar', kind: 'add', price: 2 },
      { id: 'extra-bacon', label: 'Crispy bacon', kind: 'add', price: 3 },
      { id: 'extra-aioli', label: 'Extra truffle aioli', kind: 'add', price: 1.5 },
    ],
    removals: [
      { id: 'no-tomato', label: 'No tomato', kind: 'remove' },
      { id: 'no-onion', label: 'No onion', kind: 'remove' },
      { id: 'no-cheese', label: 'No cheddar', kind: 'remove' },
      { id: 'no-aioli', label: 'No aioli', kind: 'remove' },
    ],
    substitutions: [
      { id: 'gf-bun', label: 'Gluten-free bun', kind: 'substitute', price: 2 },
      { id: 'lettuce-wrap', label: 'Lettuce wrap (no bun)', kind: 'substitute' },
    ],
  },
  'spicy-chicken': {
    addOns: [
      { id: 'extra-slaw', label: 'Extra pickled slaw', kind: 'add', price: 1.5 },
      { id: 'extra-glaze', label: 'Extra gochujang glaze', kind: 'add', price: 1 },
    ],
    removals: [
      { id: 'no-slaw', label: 'No slaw', kind: 'remove' },
      { id: 'mild-glaze', label: 'Mild glaze (less heat)', kind: 'remove' },
    ],
  },
  'veggie-wrap': {
    addOns: [
      { id: 'extra-feta', label: 'Extra feta', kind: 'add', price: 2 },
      { id: 'extra-hummus', label: 'Extra hummus', kind: 'add', price: 1.5 },
    ],
    removals: [
      { id: 'no-feta', label: 'No feta', kind: 'remove' },
      { id: 'no-hummus', label: 'No hummus', kind: 'remove' },
    ],
  },
};

export function itemHasCustomizations(itemId: string): boolean {
  return itemId in ITEM_CUSTOMIZATIONS;
}

export function getCustomizationOptions(itemId: string): ItemCustomizationGroup | undefined {
  return ITEM_CUSTOMIZATIONS[itemId];
}

export function normalizeCustomizations(customizations: CartCustomizations = {}): CartCustomizations {
  const sortIds = (ids?: string[]) => [...(ids ?? [])].sort();
  const notes = customizations.notes?.trim();
  return {
    addOns: sortIds(customizations.addOns),
    removals: sortIds(customizations.removals),
    substitutions: sortIds(customizations.substitutions),
    ...(notes ? { notes } : {}),
  };
}

export function customizationKey(customizations: CartCustomizations = {}): string {
  const n = normalizeCustomizations(customizations);
  return JSON.stringify({
    addOns: n.addOns ?? [],
    removals: n.removals ?? [],
    substitutions: n.substitutions ?? [],
    notes: n.notes ?? '',
  });
}

export function lineUnitPrice(basePrice: number, itemId: string, customizations: CartCustomizations): number {
  const group = ITEM_CUSTOMIZATIONS[itemId];
  if (!group) return basePrice;

  let extra = 0;
  const ids = [
    ...(customizations.addOns ?? []),
    ...(customizations.substitutions ?? []),
  ];
  for (const id of ids) {
    const opt =
      group.addOns?.find((o) => o.id === id) ??
      group.substitutions?.find((o) => o.id === id);
    if (opt?.price) extra += opt.price;
  }
  return basePrice + extra;
}

export type CustomizationPatch = {
  addRemovals?: string[];
  removeRemovals?: string[];
  addAddOns?: string[];
  removeAddOns?: string[];
  addSubstitutions?: string[];
  removeSubstitutions?: string[];
  notes?: string | null;
};

function patchList(
  current: string[] | undefined,
  add?: string[],
  remove?: string[]
): string[] | undefined {
  let next = [...(current ?? [])];
  for (const id of add ?? []) {
    if (!next.includes(id)) next.push(id);
  }
  for (const id of remove ?? []) {
    next = next.filter((x) => x !== id);
  }
  return next.length > 0 ? next : undefined;
}

export function applyCustomizationPatch(
  current: CartCustomizations = {},
  patch: CustomizationPatch
): CartCustomizations {
  const notes =
    patch.notes !== undefined
      ? patch.notes?.trim() || undefined
      : current.notes;

  return normalizeCustomizations({
    addOns: patchList(current.addOns, patch.addAddOns, patch.removeAddOns),
    removals: patchList(current.removals, patch.addRemovals, patch.removeRemovals),
    substitutions: patchList(
      current.substitutions,
      patch.addSubstitutions,
      patch.removeSubstitutions
    ),
    notes,
  });
}

export function formatCartCustomizations(itemId: string, customizations: CartCustomizations): string | null {
  const group = ITEM_CUSTOMIZATIONS[itemId];
  if (!group) return null;

  const parts: string[] = [];
  const labelFor = (kind: CustomizationKind, id: string) => {
    const list =
      kind === 'add'
        ? group.addOns
        : kind === 'remove'
          ? group.removals
          : group.substitutions;
    return list?.find((o) => o.id === id)?.label;
  };

  for (const id of customizations.removals ?? []) {
    const label = labelFor('remove', id);
    if (label) parts.push(label);
  }
  for (const id of customizations.substitutions ?? []) {
    const label = labelFor('substitute', id);
    if (label) parts.push(label);
  }
  for (const id of customizations.addOns ?? []) {
    const label = labelFor('add', id);
    if (label) parts.push(`+ ${label}`);
  }
  if (customizations.notes?.trim()) {
    parts.push(`"${customizations.notes.trim()}"`);
  }

  return parts.length > 0 ? parts.join(' · ') : null;
}
