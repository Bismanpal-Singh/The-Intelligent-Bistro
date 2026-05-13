export type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image: string;
  tags?: string[];
  popular?: boolean;
  calories?: number;
  allergens?: string[];
};

export type Category = {
  id: string;
  label: string;
  emoji: string;
};

export const CATEGORIES: Category[] = [
  { id: 'all', label: 'All', emoji: '✦' },
  { id: 'starters', label: 'Starters', emoji: '🍃' },
  { id: 'mains', label: 'Mains', emoji: '🍽' },
  { id: 'sides', label: 'Sides', emoji: '🥗' },
  { id: 'drinks', label: 'Drinks', emoji: '🥃' },
  { id: 'desserts', label: 'Desserts', emoji: '🍮' },
];

export const MENU_ITEMS: MenuItem[] = [
  // Starters
  {
    id: 'crispy-calamari',
    name: 'Crispy Calamari',
    description: 'Lightly battered rings with saffron aioli and fresh lemon',
    price: 14.0,
    category: 'starters',
    image: 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&q=80',
    popular: true,
    calories: 320,
    allergens: ['Gluten', 'Eggs', 'Shellfish'],
  },
  {
    id: 'burrata',
    name: 'Burrata & Heritage Tomato',
    description: 'Creamy burrata, heirloom tomatoes, aged balsamic, micro basil',
    price: 16.0,
    category: 'starters',
    image: 'https://images.unsplash.com/photo-1595587870672-c79b47875c6a?w=400&q=80',
    popular: true,
    calories: 280,
    allergens: ['Dairy'],
  },
  {
    id: 'french-onion',
    name: 'French Onion Soup',
    description: 'Slow-caramelised onions, rich beef broth, gruyère croûte',
    price: 12.0,
    category: 'starters',
    image: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&q=80',
    calories: 340,
    allergens: ['Gluten', 'Dairy'],
  },
  {
    id: 'garlic-focaccia',
    name: 'Rosemary Focaccia',
    description: 'House-baked, roasted garlic butter, fleur de sel',
    price: 8.0,
    category: 'starters',
    image: 'https://images.unsplash.com/photo-1619452357216-e88ca8119eeb?w=400&q=80',
    calories: 290,
    allergens: ['Gluten', 'Dairy'],
  },

  // Mains
  {
    id: 'spicy-chicken',
    name: 'Spicy Chicken Sandwich',
    description: 'Buttermilk fried thigh, gochujang glaze, pickled slaw, brioche',
    price: 22.0,
    category: 'mains',
    image: 'https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=400&q=80',
    popular: true,
    tags: ['spicy'],
    calories: 720,
    allergens: ['Gluten', 'Dairy', 'Eggs'],
  },
  {
    id: 'wagyu-burger',
    name: 'Wagyu Beef Burger',
    description: 'Double wagyu smash, aged cheddar, truffle aioli, brioche bun',
    price: 28.0,
    category: 'mains',
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80',
    popular: true,
    calories: 890,
    allergens: ['Gluten', 'Dairy', 'Eggs'],
  },
  {
    id: 'grilled-salmon',
    name: 'Grilled Atlantic Salmon',
    description: 'Pan-seared fillet, lemon beurre blanc, asparagus, capers',
    price: 32.0,
    category: 'mains',
    image: 'https://images.unsplash.com/photo-1519708227418-a8521c6fd13d?w=400&q=80',
    calories: 520,
    allergens: ['Fish', 'Dairy'],
  },
  {
    id: 'veggie-wrap',
    name: 'Roasted Veggie Wrap',
    description: 'Seasonal roasted vegetables, hummus, feta, charred flatbread',
    price: 18.0,
    category: 'mains',
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&q=80',
    tags: ['vegetarian'],
    calories: 440,
    allergens: ['Gluten', 'Dairy', 'Sesame'],
  },
  {
    id: 'steak-frites',
    name: 'Steak Frites',
    description: '250g sirloin, herb compound butter, pommes frites, béarnaise',
    price: 42.0,
    category: 'mains',
    image: 'https://images.unsplash.com/photo-1558030006-c0fc46394d21?w=400&q=80',
    calories: 980,
    allergens: ['Dairy', 'Eggs'],
  },

  // Sides
  {
    id: 'truffle-fries',
    name: 'Truffle Fries',
    description: 'Hand-cut fries, truffle oil, parmesan, fresh chives',
    price: 10.0,
    category: 'sides',
    image: 'https://images.unsplash.com/photo-1573080496219-bb964701bfc8?w=400&q=80',
    popular: true,
    calories: 380,
    allergens: ['Dairy'],
  },
  {
    id: 'onion-rings',
    name: 'Onion Rings',
    description: 'Beer-battered, smoked paprika, chipotle dip',
    price: 9.0,
    category: 'sides',
    image: 'https://images.unsplash.com/photo-1639024471283-03518883512d?w=400&q=80',
    calories: 340,
    allergens: ['Gluten', 'Eggs'],
  },
  {
    id: 'side-salad',
    name: 'Garden Salad',
    description: 'Mixed greens, cucumber, radish, champagne vinaigrette',
    price: 8.0,
    category: 'sides',
    image: 'https://images.unsplash.com/photo-1546793665-c74683f339c1?w=400&q=80',
    tags: ['vegan'],
    calories: 120,
    allergens: [],
  },
  {
    id: 'mac-cheese',
    name: 'Bistro Mac & Cheese',
    description: 'Four-cheese sauce, crispy breadcrumb topping, chives',
    price: 11.0,
    category: 'sides',
    image: 'https://images.unsplash.com/photo-1543339494-b4d7adecf3d8?w=400&q=80',
    calories: 560,
    allergens: ['Gluten', 'Dairy', 'Eggs'],
  },

  // Drinks
  {
    id: 'house-lemonade',
    name: 'House Lemonade',
    description: 'Fresh-squeezed, elderflower, mint, sparkling water',
    price: 6.0,
    category: 'drinks',
    image: 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400&q=80',
    popular: true,
    calories: 95,
    allergens: [],
  },
  {
    id: 'still-water',
    name: 'Still Water',
    description: 'Chilled still mineral water, 500ml',
    price: 3.0,
    category: 'drinks',
    image: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400&q=80',
    calories: 0,
    allergens: [],
  },
  {
    id: 'sparkling-water',
    name: 'Sparkling Water',
    description: 'San Pellegrino, 500ml',
    price: 4.0,
    category: 'drinks',
    image: 'https://images.unsplash.com/photo-1614887065001-06c958a7cddd?w=400&q=80',
    calories: 0,
    allergens: [],
  },
  {
    id: 'coke',
    name: 'Classic Coke',
    description: 'Ice cold, over ice, with fresh lime',
    price: 4.5,
    category: 'drinks',
    image: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400&q=80',
    calories: 140,
    allergens: [],
  },
  {
    id: 'orange-juice',
    name: 'Fresh Orange Juice',
    description: 'Cold-pressed, pulp-free, served chilled',
    price: 7.0,
    category: 'drinks',
    image: 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400&q=80',
    calories: 110,
    allergens: [],
  },
  {
    id: 'bistro-cocktail',
    name: 'Bistro Signature',
    description: 'House mocktail — pomegranate, rosemary, ginger, prosecco',
    price: 12.0,
    category: 'drinks',
    image: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400&q=80',
    popular: true,
    calories: 180,
    allergens: ['Sulphites'],
  },

  // Desserts
  {
    id: 'lava-cake',
    name: 'Chocolate Lava Cake',
    description: 'Warm Valrhona chocolate, vanilla bean ice cream, gold dust',
    price: 14.0,
    category: 'desserts',
    image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=400&q=80',
    popular: true,
    calories: 620,
    allergens: ['Gluten', 'Dairy', 'Eggs', 'Soy'],
  },
  {
    id: 'cheesecake',
    name: 'Burnt Basque Cheesecake',
    description: 'Caramelised top, berry compote, crème fraîche',
    price: 12.0,
    category: 'desserts',
    image: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400&q=80',
    calories: 480,
    allergens: ['Gluten', 'Dairy', 'Eggs'],
  },
  {
    id: 'panna-cotta',
    name: 'Vanilla Panna Cotta',
    description: 'Set cream, passion fruit coulis, toasted coconut',
    price: 11.0,
    category: 'desserts',
    image: 'https://images.unsplash.com/photo-1488477181210-c0a05b4a2df0?w=400&q=80',
    calories: 310,
    allergens: ['Dairy'],
  },
];
