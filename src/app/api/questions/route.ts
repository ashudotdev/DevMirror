import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest } from "next/server";

export const maxDuration = 30;

const QUESTIONS_PROMPT = `You are a senior engineering mentor. A developer has shared their source code with you.

Before giving any feedback, you want to understand their THOUGHT PROCESS. You need to ask 3 to 5 short, specific questions that help you understand:
- What were they trying to build and why?
- What decisions did they make and why?
- What parts they feel confident about vs unsure about?
- How they approached the problem (planned it out, followed a tutorial, winged it, etc.)
- What their experience level is with the tools/language they used

RULES:
- Ask exactly 3 to 5 questions. No more, no less.
- Keep each question SHORT (1-2 sentences max).
- Make them SPECIFIC to the code they shared — reference actual things you see in their code.
- Don't ask generic questions. Reference specific patterns, libraries, or decisions visible in the code.
- Be friendly and curious, not interrogative.
- Questions should help you give better, more contextual feedback later.

Return a valid JSON object with EXACTLY this structure:
{
  "questions": [
    { "id": "q1", "question": "your question here" },
    { "id": "q2", "question": "your question here" },
    { "id": "q3", "question": "your question here" }
  ]
}

CRITICAL: Return ONLY the raw JSON object. No markdown, no code fences, no explanation.`;

// ─── Helper: sleep ─────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Groq (Primary) — llama-3.3-70b-versatile ─────────────────────

async function callGroq(input: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not configured");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: QUESTIONS_PROMPT },
        { role: "user", content: input },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

// ─── Gemini (Fallback 1) ───────────────────────────────────────────

async function callGemini(input: string): Promise<string> {
  const apiKey = process.env.PRIMARY_GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini API key not configured");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  // Try up to 2 times with a retry on 429
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await model.generateContent({
        systemInstruction: QUESTIONS_PROMPT,
        contents: [{ role: "user", parts: [{ text: input }] }],
      });
      return result.response.text();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("429") && attempt === 0) {
        const match = msg.match(/retry\s+in\s+([\d.]+)/i);
        const delay = match ? Math.min(parseFloat(match[1]), 15) : 10;
        console.error(`[DevMirror] Questions: Gemini 429 — retrying in ${delay}s...`);
        await sleep(delay * 1000);
        continue;
      }
      throw new Error(msg.includes("429")
        ? `Gemini rate limited`
        : msg
      );
    }
  }
  throw new Error("Gemini: max retries exceeded");
}

// ─── OpenRouter (Fallback 2) ───────────────────────────────────────

async function callOpenRouter(input: string): Promise<string> {
  const apiKey = process.env.SECONDARY_OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OpenRouter API key not configured");

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.0-flash-001",
      messages: [
        { role: "system", content: QUESTIONS_PROMPT },
        { role: "user", content: input },
      ],
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

// ─── Route Handler ──────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { input } = await request.json();

    if (!input || typeof input !== "string" || input.trim().length === 0) {
      return Response.json({ error: "Input is required" }, { status: 400 });
    }

    let text: string;
    let provider = "unknown";

    // Provider chain: Groq → Gemini → OpenRouter
    const providers: { name: string; call: (i: string) => Promise<string>; available: boolean }[] = [
      { name: "groq", call: callGroq, available: !!process.env.GROQ_API_KEY },
      { name: "gemini", call: callGemini, available: !!process.env.PRIMARY_GEMINI_API_KEY },
      { name: "openrouter", call: callOpenRouter, available: !!process.env.SECONDARY_OPENROUTER_API_KEY },
    ];

    let lastError = "";
    let success = false;

    for (const p of providers) {
      if (!p.available) continue;
      try {
        text = await p.call(input);
        provider = p.name;
        success = true;
        break;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        console.error(`[DevMirror] Questions: ${p.name} failed:`, lastError);
      }
    }

    if (!success) {
      console.error("[DevMirror] All providers failed. Last error:", lastError);
      return Response.json(
        { error: "Our AI servers are busy right now. Please try again in a moment." },
        { status: 502 }
      );
    }

    console.log(`[DevMirror] Questions generated via ${provider}`);

    const cleaned = text
      .trim()
      .replace(/^```json?\s*/, "")
      .replace(/\s*```$/, "");

    // Try to parse, with repair for common AI output issues
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      try {
        const repaired = cleaned
          .replace(/,\s*([}\]])/g, "$1")
          .replace(/,?\s*$/, "");
        let fixedJson = repaired;
        const ob = (fixedJson.match(/{/g) || []).length;
        const cb = (fixedJson.match(/}/g) || []).length;
        const obr = (fixedJson.match(/\[/g) || []).length;
        const cbr = (fixedJson.match(/]/g) || []).length;
        for (let i = 0; i < obr - cbr; i++) fixedJson += "]";
        for (let i = 0; i < ob - cb; i++) fixedJson += "}";
        parsed = JSON.parse(fixedJson);
      } catch {
        console.error("[DevMirror] Questions JSON parse failed after repair attempt");
        return Response.json(
          { error: "Something went wrong while processing your code. Please try again." },
          { status: 500 }
        );
      }
    }

    return Response.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[DevMirror] Questions generation error:", message);
    return Response.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
