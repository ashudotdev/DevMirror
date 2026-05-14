<div align="center">
  <h1>🪞 DevMirror AI Mentor</h1>
  <p><strong>A brutally honest, highly-structured AI mentor that diagnoses how you learn and think as a developer.</strong></p>
  
  [![Next.js](https://img.shields.io/badge/Next.js-16.2-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
  [![Gemini 2.0](https://img.shields.io/badge/Gemini_2.0_Flash-AI-8E75B2?style=for-the-badge&logo=google)](https://aistudio.google.com/)
</div>

<br />

## 🌟 Overview

**DevMirror** is an interactive, dark-themed AI mentor application built with Next.js and powered by the Gemini API. Instead of just giving answers, DevMirror analyzes your coding habits, notes, or learning roadmaps and provides a structured diagnosis of your developer persona. 

Designed for developers of all levels, DevMirror identifies your learning anti-patterns (like "Tutorial Hell" or "Framework Hopping") and offers a personalized, actionable roadmap to fix them.

## ✨ Key Features

- 🔬 **Developer Archetype Detection**: Instantly identifies your specific developer personality (e.g., Tutorial Collector, Framework Hopper, Documentation Skimmer).
- 🔍 **Gap Analysis**: Pinpoints exact knowledge gaps with concrete evidence extracted from your input.
- 💡 **Reality Check**: Delivers honest, constructive observations about your learning habits.
- 🗺️ **Personalized Roadmap**: Generates a prioritized learning path focused on "build-to-prove" projects rather than just reading.
- ✅ **Weekly Tasks**: Breaks down your roadmap into concrete, actionable tasks for the current week.
- 🧠 **Visual Skill Map**: Renders a text-based visual map of your known vs. missing knowledge, showing dependency relationships.
- 📱 **Fully Responsive**: A beautiful, minimalist two-column interface that collapses perfectly on mobile devices.

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **AI Models**: Google Gemini 2.0 Flash (Primary), OpenRouter (Fallback API support)
- **Deployment**: Vercel

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ installed on your local machine
- A Gemini API key (Get one for free at [Google AI Studio](https://aistudio.google.com/apikey))

### Local Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/devmirror.git
   cd devmirror
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   Copy the example environment file and add your API keys:
   ```bash
   cp .env.example .env.local
   ```
   Open `.env.local` and add your Gemini API Key:
   ```env
   PRIMARY_GEMINI_API_KEY=your_gemini_api_key_here
   ```

4. **Start the Development Server**
   ```bash
   npm run dev
   ```

5. **Open the App**
   Visit [http://localhost:3000](http://localhost:3000) in your browser to start using DevMirror.

## 🌐 Deployment

DevMirror is optimized for serverless deployment on Vercel.

1. Push your code to your GitHub repository.
2. Import the repository in your [Vercel Dashboard](https://vercel.com/new).
3. Add the following environment variables in Vercel:
   - `PRIMARY_GEMINI_API_KEY` (Required)
   - `SECONDARY_OPENROUTER_API_KEY` (Optional fallback)
4. Click **Deploy**. Vercel will automatically configure the build settings for Next.js.

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PRIMARY_GEMINI_API_KEY` | ✅ | Your Google Gemini API key. |
| `SECONDARY_OPENROUTER_API_KEY` | ❌ | OpenRouter fallback key (if using a fallback LLM). |
| `NEXT_PUBLIC_SITE_URL` | ❌ | Custom site URL (automatically detected if deploying on Vercel). |

## 🏗️ Project Structure

- `src/app/page.tsx` - Main frontend interface containing the UI, state management, and API integration.
- `src/app/api/analyze/route.ts` - Next.js Route Handler that processes user input, formats the prompt, and communicates with the Gemini API.
- `src/app/globals.css` - Global CSS styles and Tailwind imports.

## 📄 License

This project is licensed under the MIT License.
