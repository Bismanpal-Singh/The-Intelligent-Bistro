import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '.env') });

import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';

const app = express();
app.use(cors());
app.use(express.json());

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Menu (single source of truth for tool enum + system prompt) ───────────────
const MENU = [
  { id: 'crispy-calamari',  name: 'Crispy Calamari',            price: 14.00, category: 'starters', popular: true  },
  { id: 'burrata',          name: 'Burrata & Heritage Tomato',  price: 16.00, category: 'starters', popular: true  },
  { id: 'french-onion',     name: 'French Onion Soup',          price: 12.00, category: 'starters'                },
  { id: 'garlic-focaccia',  name: 'Rosemary Focaccia',          price:  8.00, category: 'starters'                },
  { id: 'spicy-chicken',    name: 'Spicy Chicken Sandwich',     price: 22.00, category: 'mains',    popular: true  },
  { id: 'wagyu-burger',     name: 'Wagyu Beef Burger',          price: 28.00, category: 'mains',    popular: true  },
  { id: 'grilled-salmon',   name: 'Grilled Atlantic Salmon',    price: 32.00, category: 'mains'                   },
  { id: 'veggie-wrap',      name: 'Roasted Veggie Wrap',        price: 18.00, category: 'mains'                   },
  { id: 'steak-frites',     name: 'Steak Frites',               price: 42.00, category: 'mains'                   },
  { id: 'truffle-fries',    name: 'Truffle Fries',              price: 10.00, category: 'sides',    popular: true  },
  { id: 'onion-rings',      name: 'Onion Rings',                price:  9.00, category: 'sides'                   },
  { id: 'side-salad',       name: 'Garden Salad',               price:  8.00, category: 'sides'                   },
  { id: 'mac-cheese',       name: 'Bistro Mac & Cheese',        price: 11.00, category: 'sides'                   },
  { id: 'house-lemonade',   name: 'House Lemonade',             price:  6.00, category: 'drinks',   popular: true  },
  { id: 'still-water',      name: 'Still Water',                price:  3.00, category: 'drinks'                  },
  { id: 'sparkling-water',  name: 'Sparkling Water',            price:  4.00, category: 'drinks'                  },
  { id: 'coke',             name: 'Classic Coke',               price:  4.50, category: 'drinks'                  },
  { id: 'orange-juice',     name: 'Fresh Orange Juice',         price:  7.00, category: 'drinks'                  },
  { id: 'bistro-cocktail',  name: 'Bistro Signature',           price: 12.00, category: 'drinks',   popular: true  },
  { id: 'lava-cake',        name: 'Chocolate Lava Cake',        price: 14.00, category: 'desserts', popular: true  },
  { id: 'cheesecake',       name: 'Burnt Basque Cheesecake',    price: 12.00, category: 'desserts'                },
  { id: 'panna-cotta',      name: 'Vanilla Panna Cotta',        price: 11.00, category: 'desserts'                },
];

const MENU_IDS = MENU.map((m) => m.id);

const menuText = MENU.map((m) =>
  `- ${m.name} (${m.id}) — $${m.price.toFixed(2)} [${m.category}]${m.popular ? ' ★ popular' : ''}`
).join('\n');

const SYSTEM_PROMPT = `You are Bistro, an elegant and attentive AI dining assistant for The Intelligent Bistro — a premium restaurant. Your personality is warm, knowledgeable, and refined without being stuffy.

You can browse the menu, answer questions about dishes, and manage the guest's order using the tools provided. Always confirm what you've done after taking an action (e.g. "I've added two Wagyu Burgers to your order").

When a guest asks what's popular, refer to items marked ★. When removing items, always confirm the item name before calling the tool. If a guest is vague (e.g. "the burger"), check the cart context they provided and clarify if there's ambiguity.

Never invent items that aren't on the menu. If asked for something not available, suggest the closest alternative with flair.

Current Menu:
${menuText}

Respond naturally and concisely — this is a chat interface, not an essay. One or two sentences is usually ideal.`;

// ─── Tool definitions ──────────────────────────────────────────────────────────
const TOOLS = [
  {
    name: 'add_to_cart',
    description: 'Add a menu item to the guest\'s order. Use this when the guest asks to add, order, or get an item.',
    input_schema: {
      type: 'object',
      properties: {
        itemId: {
          type: 'string',
          enum: MENU_IDS,
          description: 'The item id from the menu',
        },
        quantity: {
          type: 'integer',
          minimum: 1,
          description: 'How many to add (default 1)',
        },
      },
      required: ['itemId', 'quantity'],
    },
  },
  {
    name: 'remove_from_cart',
    description: 'Remove a menu item from the guest\'s order entirely.',
    input_schema: {
      type: 'object',
      properties: {
        itemId: {
          type: 'string',
          enum: MENU_IDS,
          description: 'The item id to remove',
        },
      },
      required: ['itemId'],
    },
  },
  {
    name: 'update_quantity',
    description: 'Set the quantity of an item already in the cart to a specific number.',
    input_schema: {
      type: 'object',
      properties: {
        itemId: {
          type: 'string',
          enum: MENU_IDS,
          description: 'The item id to update',
        },
        quantity: {
          type: 'integer',
          minimum: 1,
          description: 'The new quantity',
        },
      },
      required: ['itemId', 'quantity'],
    },
  },
  {
    name: 'clear_cart',
    description: 'Remove all items from the cart. Only use this when the guest explicitly asks to clear or start over.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
];

// ─── Chat endpoint ─────────────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { message, cartItems = [], history = [] } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message is required' });
  }

  // Build cart context string to inject into the user turn
  const cartContext = cartItems.length === 0
    ? 'The cart is currently empty.'
    : 'Current cart:\n' + cartItems.map((i) => `- ${i.name} x${i.quantity} ($${(i.price * i.quantity).toFixed(2)})`).join('\n');

  // Reconstruct message history — prior turns come first, then current message
  const messages = [
    ...history,
    {
      role: 'user',
      content: `[Cart context: ${cartContext}]\n\n${message}`,
    },
  ];

  try {
    const actions = [];
    let currentMessages = messages;
    let reply = '';

    // Agentic loop: keep going while Claude wants to use tools
    for (let turn = 0; turn < 5; turn++) {
      const response = await client.messages.create({
        model: 'claude-opus-4-7',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages: currentMessages,
      });

      const toolUseBlocks = [];

      for (const block of response.content) {
        if (block.type === 'text') {
          reply += block.text;
        } else if (block.type === 'tool_use') {
          toolUseBlocks.push(block);
          const { name, input } = block;

          if (name !== 'clear_cart' && !MENU_IDS.includes(input.itemId)) continue;

          if (name === 'add_to_cart') {
            actions.push({ action: 'add', itemId: input.itemId, quantity: input.quantity ?? 1 });
          } else if (name === 'remove_from_cart') {
            actions.push({ action: 'remove', itemId: input.itemId });
          } else if (name === 'update_quantity') {
            actions.push({ action: 'update', itemId: input.itemId, quantity: input.quantity });
          } else if (name === 'clear_cart') {
            actions.push({ action: 'clear' });
          }
        }
      }

      // If Claude is done with tools, we have our final reply
      if (response.stop_reason !== 'tool_use' || toolUseBlocks.length === 0) break;

      // Otherwise feed tool results back so Claude can respond naturally
      const toolResults = toolUseBlocks.map((b) => ({
        type: 'tool_result',
        tool_use_id: b.id,
        content: 'Done.',
      }));

      currentMessages = [
        ...currentMessages,
        { role: 'assistant', content: response.content },
        { role: 'user', content: toolResults },
      ];
    }

    res.json({ reply: reply.trim(), actions });
  } catch (err) {
    console.error('Anthropic error:', err.message);
    res.status(500).json({ error: 'Failed to get response from AI' });
  }
});

// ─── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => console.log(`Bistro backend running on port ${PORT}`));
