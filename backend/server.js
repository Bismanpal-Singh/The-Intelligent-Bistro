import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import http from 'http';
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '.env') });

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import Anthropic from '@anthropic-ai/sdk';
import {
  customizationGuideForPrompt,
  formatCustomizationsHuman,
  lineUnitPrice,
} from './customizations.js';
import { transcribeAudioBuffer } from './transcribe.js';
import { attachVoiceRealtime } from './voiceRealtime.js';
import { cartContextString, toolCallToActions } from './agentShared.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
});

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Menu (single source of truth for tool enum + system prompt) ───────────────
const MENU = [
  { id: 'crispy-calamari',  name: 'Crispy Calamari',            price: 14.00, category: 'starters', popular: true  },
  { id: 'burrata',          name: 'Burrata & Heritage Tomato',  price: 16.00, category: 'starters', popular: true  },
  { id: 'french-onion',     name: 'French Onion Soup',          price: 12.00, category: 'starters'                },
  { id: 'garlic-focaccia',  name: 'Rosemary Focaccia',          price:  8.00, category: 'starters'                },
  { id: 'avocado-toast',   name: 'Avocado Toast',              price: 13.00, category: 'starters'                },
  { id: 'caprese-stack',   name: 'Caprese Stack',              price: 14.00, category: 'starters'                },
  { id: 'spicy-chicken',    name: 'Spicy Chicken Sandwich',     price: 22.00, category: 'mains',    popular: true  },
  { id: 'wagyu-burger',     name: 'Wagyu Beef Burger',          price: 28.00, category: 'mains',    popular: true  },
  { id: 'grilled-salmon',   name: 'Grilled Atlantic Salmon',    price: 32.00, category: 'mains'                   },
  { id: 'veggie-wrap',      name: 'Roasted Veggie Wrap',        price: 18.00, category: 'mains'                   },
  { id: 'steak-frites',     name: 'Steak Frites',               price: 42.00, category: 'mains'                   },
  { id: 'mushroom-risotto', name: 'Wild Mushroom Risotto',      price: 24.00, category: 'mains',    popular: true  },
  { id: 'cauliflower-steak',name: 'Roasted Cauliflower Steak',  price: 21.00, category: 'mains'                   },
  { id: 'truffle-fries',    name: 'Truffle Fries',              price: 10.00, category: 'sides',    popular: true  },
  { id: 'onion-rings',      name: 'Onion Rings',                price:  9.00, category: 'sides'                   },
  { id: 'side-salad',       name: 'Garden Salad',               price:  8.00, category: 'sides'                   },
  { id: 'mac-cheese',       name: 'Bistro Mac & Cheese',        price: 11.00, category: 'sides'                   },
  { id: 'halloumi-fries',  name: 'Halloumi Fries',             price: 12.00, category: 'sides',    popular: true  },
  { id: 'house-lemonade',   name: 'House Lemonade',             price:  6.00, category: 'drinks',   popular: true  },
  { id: 'still-water',      name: 'Still Water',                price:  3.00, category: 'drinks'                  },
  { id: 'sparkling-water',  name: 'Sparkling Water',            price:  4.00, category: 'drinks'                  },
  { id: 'coke',             name: 'Classic Coke',               price:  4.50, category: 'drinks'                  },
  { id: 'orange-juice',     name: 'Fresh Orange Juice',         price:  7.00, category: 'drinks'                  },
  { id: 'bistro-cocktail',  name: 'Bistro Signature',           price: 12.00, category: 'drinks',   popular: true  },
  { id: 'lava-cake',        name: 'Chocolate Lava Cake',        price: 14.00, category: 'desserts', popular: true  },
  { id: 'cheesecake',       name: 'Burnt Basque Cheesecake',    price: 12.00, category: 'desserts'                },
  { id: 'panna-cotta',      name: 'Vanilla Panna Cotta',        price: 11.00, category: 'desserts'                },
  { id: 'mango-sorbet',    name: 'Mango Sorbet',               price:  9.00, category: 'desserts'                },
];

const MENU_IDS = MENU.map((m) => m.id);

const menuText = MENU.map((m) =>
  `- ${m.name} (${m.id}) — $${m.price.toFixed(2)} [${m.category}]${m.popular ? ' ★ popular' : ''}`
).join('\n');

const SYSTEM_PROMPT = `You are Bistro, an elegant and attentive AI dining assistant for The Intelligent Bistro — a premium restaurant. Your personality is warm, knowledgeable, and refined without being stuffy.

You can browse the menu, answer questions about dishes, and manage the guest's order using the tools provided. Always confirm what you've done after taking an action (e.g. "I've added two Wagyu Burgers to your order").

When a guest asks what's popular, refer to items marked ★. If a guest is vague (e.g. "the burger"), use cart context to pick the right cartLineId.

Customization rules (important):
- Adding a NEW dish with changes → add_to_cart with customizations (full object).
- Changing an item ALREADY in the cart (e.g. "remove onions from my burger", "add extra cheese to my burger") → update_customizations with a patch on that line's cartLineId. Do NOT use remove_from_cart for ingredient requests.
- Removing the whole dish from the order → remove_from_cart.
- Each cart line shows cartLineId, human-readable customizations, and option ids — use them to target the correct line.
- If exactly one line matches the dish (e.g. only one wagyu-burger), you may pass itemId instead of cartLineId for update_customizations.

Customization catalog:
${customizationGuideForPrompt()}

Never invent items that aren't on the menu. If asked for something not available, suggest the closest alternative with flair.

Current Menu:
${menuText}

Respond naturally and concisely — this is a chat interface, not an essay. One or two sentences is usually ideal. Do not use markdown formatting such as **bold**, *italics*, or # headers. Plain text only.`;

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
        customizations: {
          type: 'object',
          description: 'Optional customizations for customizable items',
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
    description: 'Remove item(s) from the cart. Use cartLineId for a specific line; itemId removes all lines of that dish.',
    input_schema: {
      type: 'object',
      properties: {
        cartLineId: {
          type: 'string',
          description: 'Specific cart line id from cart context',
        },
        itemId: {
          type: 'string',
          enum: MENU_IDS,
          description: 'Remove all cart lines for this menu item',
        },
      },
    },
  },
  {
    name: 'update_customizations',
    description:
      'Modify customizations on an existing cart line. Use when the guest wants to change how an item already in their order is prepared (e.g. no onion, extra cheese, hold the tomato). Use patch fields to add or undo specific options.',
    input_schema: {
      type: 'object',
      properties: {
        cartLineId: {
          type: 'string',
          description: 'Cart line id from cart context',
        },
        itemId: {
          type: 'string',
          enum: MENU_IDS,
          description: 'Use when only one cart line exists for this menu item',
        },
        patch: {
          type: 'object',
          description: 'Changes to apply on top of existing customizations',
          properties: {
            addRemovals: {
              type: 'array',
              items: { type: 'string' },
              description: 'Ingredient removal option ids to add (e.g. no-onion)',
            },
            removeRemovals: {
              type: 'array',
              items: { type: 'string' },
              description: 'Undo a removal (guest wants ingredient back)',
            },
            addAddOns: { type: 'array', items: { type: 'string' } },
            removeAddOns: { type: 'array', items: { type: 'string' } },
            addSubstitutions: { type: 'array', items: { type: 'string' } },
            removeSubstitutions: { type: 'array', items: { type: 'string' } },
            notes: { type: 'string' },
          },
        },
        customizations: {
          type: 'object',
          description: 'Optional: replace entire customizations object (prefer patch for small changes)',
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
    description: 'Set quantity for a cart line. Prefer cartLineId when multiple lines exist for the same dish.',
    input_schema: {
      type: 'object',
      properties: {
        cartLineId: {
          type: 'string',
          description: 'Specific cart line id from cart context',
        },
        itemId: {
          type: 'string',
          enum: MENU_IDS,
          description: 'Use only when a single line exists for this item',
        },
        quantity: {
          type: 'integer',
          minimum: 1,
          description: 'The new quantity',
        },
      },
      required: ['quantity'],
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

function buildMessages(history, cartContext, message) {
  return [
    ...history,
    { role: 'user', content: `[Cart context — this is the live state of the cart, trust it over anything in history: ${cartContext}]\n\n${message}` },
  ];
}

function customizationSummary(itemId, customizations = {}) {
  const human = formatCustomizationsHuman(itemId, customizations);
  const ids = [];
  if (customizations.removals?.length) ids.push(`removalIds: [${customizations.removals.join(', ')}]`);
  if (customizations.addOns?.length) ids.push(`addOnIds: [${customizations.addOns.join(', ')}]`);
  if (customizations.substitutions?.length) ids.push(`substitutionIds: [${customizations.substitutions.join(', ')}]`);
  if (customizations.notes) ids.push(`note: ${customizations.notes}`);
  const idPart = ids.length ? ` | ${ids.join(' | ')}` : '';
  return human ? ` | ${human}${idPart}` : idPart;
}

function extractActions(toolBlocks) {
  const actions = [];
  for (const block of toolBlocks) {
    actions.push(...toolCallToActions(block.name, block.input));
  }
  return actions;
}

// ─── Streaming chat endpoint ───────────────────────────────────────────────────
app.post('/api/chat/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const { message, cartItems = [], history = [] } = req.body;
  if (!message) { res.end(); return; }

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    const actions = [];
    let currentMessages = buildMessages(history, cartContextString(cartItems), message);

    for (let turn = 0; turn < 5; turn++) {
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages: currentMessages,
      });

      const toolBlocks = response.content.filter((b) => b.type === 'tool_use');
      actions.push(...extractActions(toolBlocks));

      if (response.stop_reason !== 'tool_use' || toolBlocks.length === 0) break;

      const toolResults = toolBlocks.map((b) => ({ type: 'tool_result', tool_use_id: b.id, content: 'Done.' }));
      currentMessages = [
        ...currentMessages,
        { role: 'assistant', content: response.content },
        { role: 'user', content: toolResults },
      ];
    }

    send({ type: 'actions', actions });

    const stream = client.messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      tool_choice: { type: 'none' },
      messages: currentMessages,
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        send({ type: 'delta', text: chunk.delta.text });
      }
    }

    send({ type: 'done' });
    res.end();
  } catch (err) {
    console.error('Stream error:', err.message);
    send({ type: 'error' });
    res.end();
  }
});

app.post('/api/speech/transcribe', upload.single('audio'), async (req, res) => {
  if (!req.file?.buffer?.length) {
    return res.status(400).json({ error: 'No audio received.' });
  }

  try {
    const text = await transcribeAudioBuffer(
      req.file.buffer,
      req.file.mimetype || 'audio/m4a'
    );
    if (!text) {
      return res.status(400).json({ error: 'No speech detected. Try again.' });
    }
    res.json({ text });
  } catch (err) {
    console.error('Transcribe error:', err.message);
    res.status(500).json({
      error: 'Transcription failed. First run may download the speech model — keep backend online.',
    });
  }
});

app.get('/health', (_, res) =>
  res.json({
    status: 'ok',
    voice: true,
    voiceEngine: process.env.OPENAI_API_KEY ? 'openai-realtime' : 'local-whisper',
    realtimeModel: process.env.OPENAI_REALTIME_MODEL ?? 'gpt-4o-mini-realtime-preview-2024-12-17',
  })
);

const PORT = process.env.PORT ?? 3000;
const httpServer = http.createServer(app);
attachVoiceRealtime(httpServer);

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Bistro backend running on http://0.0.0.0:${PORT}`);
  console.log(`Voice WebSocket: ws://0.0.0.0:${PORT}/voice/realtime`);
});
