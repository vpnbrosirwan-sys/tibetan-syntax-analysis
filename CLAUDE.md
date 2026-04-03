@AGENTS.md

# Tibetan Syntax Analysis — Project Guide

## What This App Does

A web app for analyzing Tibetan (བོད་ཡིག) text. Users upload images of Tibetan script or paste text directly, and receive color-coded syntax analysis with Traditional Chinese (繁體中文) translations.

**Pipeline:** Image → Google Cloud Vision OCR → DeepSeek V3 syntax analysis (batched) → Gemini 2.5 Flash translation QA → User

## Tech Stack

- **Framework:** Next.js 16 (App Router, TypeScript, Tailwind CSS)
- **UI:** Custom chat-based interface with framer-motion animations, optimized for iPad
- **OCR:** Google Cloud Vision API (REST, `DOCUMENT_TEXT_DETECTION`, language hint `bo`)
- **Syntax Analysis:** DeepSeek V3 (`deepseek-chat` model) via OpenAI SDK
- **Translation QA:** Gemini 2.5 Flash verifies DeepSeek's Chinese translations
- **PDF Export:** html2canvas-pro + jsPDF (captures artifact DOM as image)
- **Storage:** localStorage for persistent conversations and bookmarks
- **Deployment:** Vercel (auto-deploys from GitHub `main` branch)

## Architecture

```
src/
├── app/
│   ├── page.tsx                 # Entry point — dynamically imports Analyzer (ssr: false)
│   ├── layout.tsx               # Root layout with iPad meta tags
│   ├── globals.css              # Tailwind + Tibetan/Chinese font classes
│   └── api/
│       ├── ocr/route.ts         # POST: image → Cloud Vision → extracted text
│       ├── analyze/route.ts     # POST: text → DeepSeek (batched SSE) → Gemini verify → results
│       └── pipeline/route.ts    # POST: combined OCR+analysis (SSE, not currently used by UI)
├── components/
│   ├── analyzer.tsx             # Main orchestrator: sessions, messages, API calls, state
│   └── chat/
│       ├── chat-input.tsx       # Multimodal input: text, file upload, camera capture
│       ├── message-bubble.tsx   # User/assistant message rendering
│       ├── sidebar.tsx          # Conversation history sidebar (create/delete sessions)
│       └── syntax-artifact.tsx  # Color-coded POS display + PDF export + bookmarks
└── lib/
    ├── types.ts                 # TibetanPOS, AnalyzedWord, AnalyzedSentence types
    ├── gemini.ts                # Cloud Vision OCR (NOT Gemini LLM — uses Vision REST API)
    ├── deepseek.ts              # DeepSeek client: batching, JSON parsing, retry logic
    ├── verify.ts                # Gemini 2.5 Flash translation verification loop
    ├── prompts.ts               # System prompts for OCR and syntax analysis
    ├── tibetan-pos.ts           # POS → color mapping (not used by UI directly, reference only)
    ├── storage.ts               # localStorage helpers for sessions, messages, bookmarks
    └── utils.ts                 # cn() utility (tailwind-merge)
```

## Environment Variables (in .env.local and Vercel)

- `GEMINI_API_KEY` — Google AI API key (used for Gemini 2.5 Flash translation QA)
- `DEEPSEEK_API_KEY` — DeepSeek API key (syntax analysis)
- `GOOGLE_VISION_API_KEY` — Separate Google Cloud API key with Vision API enabled (OCR)

## Key Design Decisions

### OCR
- **Google Cloud Vision** (not Gemini) — Gemini LLM repeatedly misread Tibetan characters. Cloud Vision's dedicated OCR engine with `languageHints: ["bo"]` is far more accurate.
- The file is named `gemini.ts` for historical reasons but calls the Vision REST API.

### Syntax Analysis Batching
- Tibetan text is split by shad (།) punctuation into batches of max 3 sentences each
- Each batch is sent to DeepSeek separately to avoid timeouts
- Progress is streamed to the client via SSE (`event: progress`)
- `deepseek-chat` model (not `deepseek-reasoner`) — reasoner kept timing out

### Translation Verification
- After DeepSeek returns analysis, results go to Gemini 2.5 Flash
- Gemini checks each word's `chineseTranslation` against the Tibetan original
- If errors found, Gemini corrects them directly (up to 2 rounds)
- Only verified results reach the user

### All output text must be in Traditional Chinese (繁體中文)
- POS labels: 名詞, 動詞, 形容詞, etc.
- Translations, grammar notes, structure descriptions — all 繁體中文
- UI labels are also in Traditional Chinese

### PDF Export
- Uses `html2canvas-pro` to screenshot the artifact DOM element
- Then `jsPDF` to paginate into A4 PDF
- Preserves all colors, Tibetan fonts, and layout exactly as on screen

## Commands

```bash
npm run dev     # Local dev server at localhost:3000
npm run build   # Production build
```

## Deployment

Push to `main` → Vercel auto-deploys. Or manually:
```bash
vercel --prod --yes
```

Cache headers set to `no-store` in `next.config.ts` to prevent stale content.

## Common Tasks

### Modify the analysis prompt
Edit `src/lib/prompts.ts` → `ANALYSIS_SYSTEM_PROMPT`. The prompt instructs DeepSeek to output JSON matching the `AnalyzedSentence` schema in `src/lib/types.ts`.

### Change POS colors
Edit the `POS_COLORS` object in `src/components/chat/syntax-artifact.tsx`. Also update the PDF export `posColors` in `src/components/analyzer.tsx` if HTML export is ever restored.

### Add a new POS tag
1. Add to `TibetanPOS` type in `src/lib/types.ts`
2. Add color entry in `syntax-artifact.tsx`
3. Add to the prompt example in `prompts.ts`

### Change OCR provider
Replace the `extractTibetanText` function in `src/lib/gemini.ts`. It accepts `ImageInput[]` and returns a string. The rest of the app doesn't care how OCR works.

### Change analysis provider
Replace `analyzeBatch` in `src/lib/deepseek.ts`. Must return `AnalyzedSentence[]`.

### Adjust batch size
Change `maxSentencesPerBatch` parameter in `splitIntoBatches()` in `src/lib/deepseek.ts` (default: 3).

## Known Limitations

- localStorage is per-device — conversations don't sync between iPad and Mac
- Image thumbnails in user messages are not persisted (too large for localStorage)
- Ume (དབུ་མེད) cursive handwritten Tibetan may still have OCR accuracy issues
- `maxDuration` on API routes: OCR=300s, Analyze=300s (Vercel free tier may cap at 60s)
