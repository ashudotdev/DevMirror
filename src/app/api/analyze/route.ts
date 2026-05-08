import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest } from "next/server";

// Vercel serverless function config — AI calls can take 30s+
export const maxDuration = 60;

const SYSTEM_PROMPT = `You are a senior engineer and mentor who gives honest, direct feedback.

A developer has shared their code, notes, tutorial transcripts, learning goals, roadmap, project ideas, or debugging attempts with you.

Your job is NOT to fix their code.
Your job is to diagnose HOW they are learning, thinking, planning, and building.

IMPORTANT COMMUNICATION RULES:
- Be honest and direct, but explain things so a beginner can understand.
- When you reference a technical concept, briefly explain what it means.
- Write as if the developer is junior or self-taught — they want truth, not jargon.
- Don't be mean. Be like a tough but fair mentor who genuinely wants them to improve.
- Every observation must be grounded in evidence from the user's input.
- Do not invent weaknesses without evidence.
- Avoid generic filler phrases like "Keep learning" or "Practice makes perfect".
- Be specific and actionable.

Focus on diagnosing:
* how they learn (tutorials vs building vs reading)
* whether they build consistently
* whether they understand concepts deeply or just surface-level
* whether they are overplanning instead of executing
* whether they are collecting technologies instead of building real judgment

Return a valid JSON object with EXACTLY these keys:

{
  "developerArchetype": "",
  "weaknesses": [],
  "realityCheck": [],
  "roadmap": [],
  "tasks": [],
  "knowledgeMap": {}
}

developerArchetype:
A short label describing their developer personality. Examples:
* "Tutorial Collector" — watches/reads a lot but rarely builds
* "Framework Hopper" — keeps switching tools instead of going deep
* "Chaotic Builder" — builds things but without structure or understanding
* "Overplanner" — plans extensively but doesn't execute
* "Builder with Weak Fundamentals" — ships code but lacks core understanding
* "Strong Fundamentals, Weak Execution" — understands theory but doesn't build
Only assign one if clearly supported by their input.

weaknesses:
Array of objects. Each object has:
* "observation" — what gap or problem you noticed (explain it simply)
* "evidence" — what specifically in their input made you think this
* "confidenceScore" — 1 to 10, how sure you are about this observation

Example:
{
  "observation": "You know how to use useState in React, but you're creating extra state variables when you could just calculate the value from existing state. This causes your app to re-render (redraw on screen) more than needed.",
  "evidence": "Your code has a separate 'filteredItems' state that duplicates data already available from 'items' and 'searchTerm'.",
  "confidenceScore": 9
}

realityCheck:
Array of objects. Each has:
* "issue" — the pattern or habit you noticed
* "evidence" — what in their input shows this
* "consequence" — what happens if they keep doing this (explain simply)
* "correction" — a specific, actionable thing to do differently

roadmap:
Array of objects. Each has:
* "topic" — what to learn
* "why" — why this matters for them specifically (in plain language)
* "prerequisite" — what they should know first
* "timeEstimate" — realistic time to learn this
* "buildToProveSkill" — a specific project that proves they actually learned it

tasks:
Array of 3-5 plain strings. Each string is one concrete thing to do this week.
Tasks must be specific, measurable, and involve actually building something.
IMPORTANT: Each task must be a simple string, NOT an object.

Good task: "Build a Todo app with add/delete/filter without watching any tutorial."
Bad task: "Practice React more."

knowledgeMap:
Object with:
* "known" — array of strings: topics they seem to understand
* "missing" — array of strings: topics they need to learn
* "relationships" — array of {from, to} objects showing which topics depend on which (from should be learned before to)

CRITICAL: Return ONLY the raw JSON object. No markdown, no code fences, no explanation before or after. Just the JSON.`;


// ─── Gemini (Primary) ──────────────────────────────────────────────
// ─── Helper: wait ───────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Helper: clean Gemini error ─────────────────────────────────────

function cleanGeminiError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);

  // Extract retry delay if present
  const retryMatch = raw.match(/retryDelay['":\s]*['"]?(\d+)s/);
  const retrySeconds = retryMatch ? retryMatch[1] : null;

  if (raw.includes("429") || raw.includes("Too Many Requests") || raw.includes("quota")) {
    return `Gemini free tier rate limited.${retrySeconds ? ` Try again in ~${retrySeconds} seconds.` : " Wait about a minute and try again."}`;
  }

  if (raw.includes("403") || raw.includes("PERMISSION_DENIED")) {
    return "Gemini API key is invalid or doesn't have permission. Check your PRIMARY_GEMINI_API_KEY.";
  }

  // Truncate very long errors
  if (raw.length > 200) {
    return raw.substring(0, 200) + "...";
  }

  return raw;
}

// ─── Gemini (Primary) ──────────────────────────────────────────────

async function callGemini(input: string, retryCount = 0): Promise<ReadableStream> {
  const apiKey = process.env.PRIMARY_GEMINI_API_KEY;
  if (!apiKey) throw new Error("PRIMARY_GEMINI_API_KEY not configured. Add it to .env.local");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  try {
    const result = await model.generateContentStream({
      systemInstruction: SYSTEM_PROMPT,
      contents: [{ role: "user", parts: [{ text: input }] }],
    });

    const encoder = new TextEncoder();

    return new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
              );
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Gemini stream error";
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`)
          );
          controller.close();
        }
      },
    });
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);

    // Retry once on 429 after a short delay
    if ((raw.includes("429") || raw.includes("Too Many Requests")) && retryCount < 1) {
      console.log("[DevMirror] Gemini 429 — retrying in 10 seconds...");
      await sleep(10000);
      return callGemini(input, retryCount + 1);
    }

    throw new Error(cleanGeminiError(err));
  }
}

// ─── OpenRouter (Fallback) ──────────────────────────────────────────

async function callOpenRouter(input: string): Promise<ReadableStream> {
  const apiKey = process.env.SECONDARY_OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("SECONDARY_OPENROUTER_API_KEY not configured");

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": siteUrl,
      "X-Title": "DevMirror",
    },
    body: JSON.stringify({
      model: "google/gemini-2.0-flash-001",
      stream: true,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: input },
      ],
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter HTTP ${res.status}: ${errText}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No OpenRouter response stream");

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6).trim();
              if (data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data);
                const text = parsed.choices?.[0]?.delta?.content;
                if (text) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
                  );
                }
              } catch {
                // skip malformed chunks
              }
            }
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "OpenRouter stream error";
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`)
        );
        controller.close();
      }
    },
  });
}

// ─── Route Handler ──────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { input } = await request.json();

    if (!input || typeof input !== "string" || input.trim().length === 0) {
      return Response.json({ error: "Input is required" }, { status: 400 });
    }

    let stream: ReadableStream;
    let provider: string;

    // Try Gemini first, fall back to OpenRouter only if key is configured
    try {
      stream = await callGemini(input);
      provider = "gemini";
    } catch (geminiErr) {
      const geminiMsg = geminiErr instanceof Error ? geminiErr.message : "Gemini failed";

      // Only attempt OpenRouter if the key is present (not commented out)
      if (process.env.SECONDARY_OPENROUTER_API_KEY) {
        console.error("[DevMirror] Gemini failed, falling back to OpenRouter:", geminiMsg);
        try {
          stream = await callOpenRouter(input);
          provider = "openrouter";
        } catch (orErr) {
          const orMsg = orErr instanceof Error ? orErr.message : "OpenRouter also failed";
          return Response.json(
            { error: `Gemini: ${geminiMsg} | OpenRouter: ${orMsg}` },
            { status: 502 }
          );
        }
      } else {
        return Response.json(
          { error: geminiMsg },
          { status: 502 }
        );
      }
    }

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Provider": provider!,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
