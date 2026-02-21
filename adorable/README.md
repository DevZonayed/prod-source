This is an [assistant-ui](https://github.com/Yonom/assistant-ui) project with provider-agnostic backend routing and OpenAI Conversations API persistence.

## Getting Started

### 1. Configure Environment Variables

Create a `.env.local` file in the root directory and add your credentials:

```
# Default provider: OpenAI (persistent conversation state via Conversations API)
LLM_PROVIDER=openai
OPENAI_API_KEY=your-openai-api-key

# Optional: Claude provider support (swap provider without touching UI code)
# LLM_PROVIDER=claude
# ANTHROPIC_API_KEY=your-anthropic-api-key
```

> **Note**: You can copy `.env.example` to `.env.local` and fill in your values.

### 2. Install Dependencies

```bash
npm install
# or
yarn install
# or
pnpm install
# or
bun install
```

### 3. Run the Development Server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Development

You can start customizing the UI by modifying components in the `components/assistant-ui/` directory.

### Key Files

- `app/assistant.tsx` - Renders the chat interface and sets up the assistant runtime
- `app/api/chat/route.ts` - Chat API endpoint
- `lib/llm-provider.ts` - Provider wrapper (OpenAI + Claude) with OpenAI conversation persistence
- `components/assistant-ui/thread.tsx` - Chat thread component
- `components/app-sidebar.tsx` - Sidebar with thread list
