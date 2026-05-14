# The Intelligent Bistro

A premium restaurant ordering app where guests interact with an AI dining assistant named Bistro. Instead of browsing a static menu and tapping "Add to Cart", guests have a natural conversation — "Add two wagyu burgers and a lemonade" — and the AI manages their order in real time.

---

## What it is

The Intelligent Bistro is a full-stack mobile application built with React Native (Expo) on the frontend and Node.js/Express on the backend. The core experience is a chat interface powered by Claude (Anthropic), where the AI understands natural language requests, modifies a live cart, and streams its responses character-by-character for a premium feel.

The menu screen is a separately designed tab with a "Tonight's Menu" featured section, category tabs, and dietary filters — giving guests both the conversational and the browse-and-tap path to ordering.

---

## Architecture

```
┌─────────────────────────────────────┐
│         Expo (React Native)         │
│                                     │
│  ┌────────────┐  ┌───────────────┐  │
│  │  Menu tab  │  │   Chat tab    │  │
│  │ (index.tsx)│  │  (chat.tsx)   │  │
│  └────────────┘  └──────┬────────┘  │
│                         │ XHR SSE   │
└─────────────────────────┼───────────┘
                          │
┌─────────────────────────┼───────────┐
│     Express (server.js) │           │
│                         ▼           │
│  POST /api/chat/stream              │
│                                     │
│  Phase 1: Tool calls only           │
│  ┌─────────────────────────────┐    │
│  │  claude-haiku-4-5           │    │
│  │  + tools: add/remove/update │    │
│  │  → { type: 'actions', ... } │    │
│  └─────────────────────────────┘    │
│                                     │
│  Phase 2: Streamed text reply       │
│  ┌─────────────────────────────┐    │
│  │  claude-haiku-4-5           │    │
│  │  tool_choice: none          │    │
│  │  → { type: 'delta', text }  │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

---

## AI design decisions

### Two-phase streaming

The most important architectural decision is separating tool use from text generation into two sequential Claude calls.

**The problem with a single call:** When Claude uses tools and streams text in one pass, it tends to second-guess itself. After adding items to a cart, it would sometimes say "I've added the burger... actually, let me check your cart" and call tools again mid-response. This created a confusing experience where cart state felt unreliable.

**The solution:** Phase 1 makes a non-streaming call with tools enabled. Claude resolves all cart actions (which may take multiple agentic turns in a loop up to 5). Once actions are complete, those results are sent to the frontend immediately as `{ type: 'actions', actions: [...] }` — the cart updates before the AI even starts talking.

Phase 2 then makes a second streaming call with `tool_choice: { type: 'none' }`. Claude can't call tools anymore, so it just writes a conversational confirmation. This text streams in character-by-character with the typewriter effect.

The result: cart updates are instant and authoritative, and the AI response always reflects what actually happened — not what Claude thinks might have happened.

### Tool design

Each tool maps 1:1 to a cart operation. Item IDs are validated as a strict `enum` in the tool's JSON schema — Claude can only pass IDs that actually exist on the menu. This eliminates hallucinated items entirely without needing any fuzzy matching logic.

```
add_to_cart      → itemId (enum), quantity
remove_from_cart → itemId (enum)
update_quantity  → itemId (enum), quantity
clear_cart       → (no params)
```

### Cart context injection

Every request sends the live cart state as a prefixed note in the user message:

```
[Cart context — this is the live state of the cart, trust it over anything in history: Current cart:
- Wagyu Beef Burger x2 ($56.00)]

Can you remove the burger?
```

This is more reliable than keeping cart state in conversation history, because history can drift from reality (e.g. if the user modified the cart on the menu tab). The cart context always reflects ground truth.

### Typewriter effect

Claude's streaming API sends tokens as they're generated — but tokens arrive in bursts, not one character at a time. Rendering each delta directly would cause the text to jump in 3-8 word chunks.

The solution is a typing queue: incoming deltas are appended to a string buffer (`typingQueue`). A separate interval drains that buffer at 9ms per character. This decouples delivery speed from render speed, giving smooth character-by-character output regardless of how the model batches its tokens.

---

## Frontend structure

```
frontend/
├── app/
│   ├── _layout.tsx          # Font loading, ThemeProvider, Stack navigator
│   └── (tabs)/
│       ├── _layout.tsx      # Tab bar config
│       ├── index.tsx        # Menu screen
│       ├── chat.tsx         # Chat screen
│       └── cart.tsx         # Cart screen
├── components/
│   └── BistroAvatar.tsx     # Animated avatar used in chat header + bubbles
├── constants/
│   └── theme.ts             # Color palettes (dark/light), font names, spacing
├── context/
│   └── ThemeContext.tsx     # Theme provider + useTheme hook
├── data/
│   └── menu.ts              # Single source of truth for all menu items
└── store/
    └── cartStore.ts         # Zustand cart store (add/remove/update/clear)
```

### Menu screen (index.tsx)

Built around a single `FlatList` with a `ListHeaderComponent` that contains:
- **Tonight's Menu** — a horizontal FlatList of popular items as large portrait cards
- **Category tabs** — scrollable tabs (Starters, Mains, Sides, Drinks, Desserts) with a gold underline indicator
- **Dietary filters** — a horizontal `ScrollView` of filter chips (Vegan, Vegetarian, Spicy, Gluten-Free, Dairy-Free, Nut-Free, Low-Cal)

Tab switching is instant (no animation) to avoid the black-flash artifact that appears when animating opacity to 0 on tab change. Individual food cards animate in with a staggered fade on mount instead.

Dietary filters are derived from item data (`allergens` array and `tags` array) rather than hardcoded — so adding `"Gluten"` to a new item's allergens automatically excludes it from the Gluten-Free filter.

### Chat screen (chat.tsx)

Key patterns:

**Keyboard handling** — uses `Keyboard.addListener` (keyboardWillShow / keyboardWillHide on iOS, Did variants on Android) to animate the input bar up with the keyboard. This is done via an `Animated.Value` on `paddingBottom` of the content container rather than using `KeyboardAvoidingView`, which has inconsistent behaviour across Expo SDK versions.

**Streaming** — uses `XMLHttpRequest` with `onprogress` rather than `fetch` with `response.body.getReader()`. The Fetch streaming API returns null in Expo Go's JS runtime; XHR's `onprogress` fires incrementally and works correctly.

**Scroll management** — a single `useEffect` on `[messages.length, loading]` scrolls to end when either changes. `onContentSizeChange` on the FlatList handles scroll during active typing. `flexGrow: 1, justifyContent: 'flex-end'` on `contentContainerStyle` keeps messages pinned to the bottom when the list is short.

### Fonts

| Family | Used for |
|--------|----------|
| Cormorant Garamond 700 Bold | Brand name ("Bistro", "The Intelligent Bistro") |
| Fraunces 700 Bold | Food item names |
| Fraunces 400 Italic | Food item descriptions |
| Playfair Display 400 | Secondary headings |
| DM Sans 400 / 500 / 700 | All UI text (prices, timestamps, body copy) |

Fraunces was chosen for food items specifically because it's an optical serif designed with an "wonky" axis — characters have intentional irregularities that read as handcrafted and artisanal, matching the bistro's premium positioning. Cormorant Garamond handles brand moments where editorial elegance matters more than warmth.

### State management

Cart state lives in a Zustand store (`cartStore.ts`). Zustand was chosen over React Context because cart state is read by three separate screens (Menu, Chat, Cart) and Context re-renders the entire tree on every cart change — noticeable on the menu's FlatList with many items.

---

## Backend structure

```
backend/
├── server.js     # Express server, Claude integration, streaming endpoint
├── package.json
└── .env          # ANTHROPIC_API_KEY (not committed)
```

The backend is intentionally a single file. It has one meaningful endpoint:

**POST /api/chat/stream** — accepts `{ message, cartItems, history }`, runs the two-phase Claude pipeline, and returns an SSE stream with three event types:

| Event | When | Payload |
|-------|------|---------|
| `actions` | After Phase 1 completes | `{ type: 'actions', actions: [...] }` |
| `delta` | During Phase 2 stream | `{ type: 'delta', text: '...' }` |
| `done` | Stream complete | `{ type: 'done' }` |

---

## Running locally

### Prerequisites

- Node.js 18+
- Expo Go app on your phone (or an iOS/Android simulator)
- An Anthropic API key

### Backend

```bash
cd backend
npm install
echo "ANTHROPIC_API_KEY=your_key_here" > .env
node server.js
# Server starts on port 3000
```

### Frontend

```bash
cd frontend
npm install
npx expo start
# Scan the QR code with Expo Go
```

### Connecting frontend to backend

The frontend talks to the backend over your local network. Find your machine's local IP:

```bash
# macOS
ipconfig getifaddr en0

# or
ifconfig | grep "inet " | grep -v 127.0.0.1
```

Then update the constant at the top of `frontend/app/(tabs)/chat.tsx`:

```ts
const API_BASE = 'http://YOUR_LOCAL_IP:3000';
```

Your phone and development machine must be on the same WiFi network.

> If you're running in an iOS Simulator, you can use `http://localhost:3000` instead.

### Environment variables

| Variable | Location | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | `backend/.env` | Your Anthropic API key |
| `PORT` | `backend/.env` (optional) | Backend port, defaults to 3000 |
| `API_BASE` | `frontend/app/(tabs)/chat.tsx` | Backend URL for the frontend |

---

## Menu data

`frontend/data/menu.ts` is the single source of truth for menu items on the frontend. `backend/server.js` maintains its own copy of the menu (used to build the Claude system prompt and validate tool call item IDs). When adding new dishes, update both files and keep the item IDs in sync.

Each menu item has:

```ts
{
  id: string;           // kebab-case, used as cart key and tool enum value
  name: string;         // display name
  price: number;
  category: 'starters' | 'mains' | 'sides' | 'drinks' | 'desserts';
  description?: string;
  imageUrl?: string;    // Unsplash photo URL
  popular?: boolean;    // appears in "Tonight's Menu" featured section
  tags?: string[];      // e.g. ['vegan', 'vegetarian', 'spicy']
  allergens?: string[]; // e.g. ['Gluten', 'Dairy', 'Nuts']
  calories?: number;
}
```

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Mobile framework | React Native via Expo SDK 54 |
| Navigation | expo-router (file-based) |
| State | Zustand |
| AI | Anthropic Claude (claude-haiku-4-5) via @anthropic-ai/sdk |
| Backend | Node.js + Express |
| Streaming | Server-Sent Events (SSE) over XHR |
| Fonts | expo-google-fonts |
| Gradients | expo-linear-gradient |
