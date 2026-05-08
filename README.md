# DevMirror — AI Mentor for Developers

Brutally honest AI mentor that diagnoses how you learn and think as a developer. Paste your code, notes, or roadmap and get real feedback.

## Features

- 🔬 **Developer Archetype Detection** — Identifies your developer personality (Tutorial Collector, Framework Hopper, etc.)
- 🔍 **Gap Analysis** — Pinpoints specific knowledge gaps with evidence
- 💡 **Reality Check** — Honest observations about learning habits
- 🗺️ **Personalized Roadmap** — Prioritized learning path with build-to-prove projects
- ✅ **Weekly Tasks** — Concrete, actionable tasks for this week
- 🧠 **Skill Map** — Visual map of known vs missing knowledge with dependency relationships

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **AI**: Google Gemini 2.0 Flash (primary), OpenRouter (fallback)
- **Styling**: Tailwind CSS 4
- **Language**: TypeScript

## Getting Started

### Prerequisites

- Node.js 18+
- A Gemini API key ([get one free](https://aistudio.google.com/apikey))

### Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env.local` and add your API keys:
   ```bash
   cp .env.example .env.local
   ```
4. Start the dev server:
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000) to use DevMirror.

## Deployment on Vercel

1. Push to GitHub
2. Import the repo on [Vercel](https://vercel.com/new)
3. Add these environment variables in Vercel dashboard:
   - `PRIMARY_GEMINI_API_KEY` (required)
   - `SECONDARY_OPENROUTER_API_KEY` (optional fallback)
4. Deploy!

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PRIMARY_GEMINI_API_KEY` | ✅ | Google Gemini API key |
| `SECONDARY_OPENROUTER_API_KEY` | ❌ | OpenRouter fallback key |
| `NEXT_PUBLIC_SITE_URL` | ❌ | Custom site URL (auto-detected on Vercel) |

## License

MIT
