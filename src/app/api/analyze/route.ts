import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest } from "next/server";

// Vercel serverless function config — AI calls can take 30s+
export const maxDuration = 60;

// ─── Code Detection Heuristic ───────────────────────────────────────
// Uses pattern matching to determine if input is actual source code.
// Returns { isCode: boolean, confidence: number, reason: string }

function detectCode(input: string): { isCode: boolean; confidence: number; reason: string } {
  const trimmed = input.trim();
  const lines = trimmed.split("\n");
  const totalLines = lines.length;

  // Reject extremely short input — likely not code
  if (trimmed.length < 15) {
    return { isCode: false, confidence: 95, reason: "Input is too short to be meaningful code." };
  }

  let score = 0;
  const maxScore = 100;

  // ── Strong code signals (high weight) ──

  // Import / require / include statements
  const importPattern = /^\s*(import\s+|from\s+['"]|require\s*\(|#include|using\s+|package\s+)/m;
  if (importPattern.test(trimmed)) score += 20;

  // Function / method declarations
  const funcPattern = /(function\s+\w+|const\s+\w+\s*=\s*(\(|async)|def\s+\w+|fn\s+\w+|func\s+\w+|public\s+(static\s+)?\w+\s+\w+\s*\(|private\s+\w+\s*\(|=>\s*[{(])/m;
  if (funcPattern.test(trimmed)) score += 15;

  // Variable declarations
  const varPattern = /(\b(const|let|var|int|float|double|string|bool|char|auto)\s+\w+\s*[=;])/m;
  if (varPattern.test(trimmed)) score += 12;

  // Class / interface / struct / enum declarations
  const classPattern = /\b(class|interface|struct|enum|trait|type)\s+\w+/m;
  if (classPattern.test(trimmed)) score += 10;

  // Control flow
  const controlPattern = /\b(if\s*\(|else\s*{|for\s*\(|while\s*\(|switch\s*\(|try\s*{|catch\s*\(|match\s+|case\s+)/m;
  if (controlPattern.test(trimmed)) score += 10;

  // ── Medium code signals ──

  // Curly braces (opening + closing)
  const braceCount = (trimmed.match(/[{}]/g) || []).length;
  if (braceCount >= 4) score += 8;
  else if (braceCount >= 2) score += 4;

  // Semicolons at end of lines (C-family languages)
  const semiLines = lines.filter((l) => l.trim().endsWith(";")).length;
  if (semiLines >= 3) score += 8;
  else if (semiLines >= 1) score += 3;

  // Parentheses density (function calls, conditions)
  const parenCount = (trimmed.match(/[()]/g) || []).length;
  if (parenCount >= 6) score += 6;

  // Dot notation / method chaining
  const dotChain = (trimmed.match(/\w+\.\w+\s*\(/g) || []).length;
  if (dotChain >= 2) score += 6;

  // Arrows / lambda syntax
  if (/=>|->|lambda\s/.test(trimmed)) score += 5;

  // Assignment operators (=, +=, -=, etc.)
  const assignments = (trimmed.match(/\w+\s*[+\-*\/]?=\s*[^=]/g) || []).length;
  if (assignments >= 2) score += 5;

  // ── Weak signals ──

  // Indentation consistency (code tends to be indented)
  const indentedLines = lines.filter((l) => /^\s{2,}/.test(l)).length;
  const indentRatio = totalLines > 0 ? indentedLines / totalLines : 0;
  if (indentRatio > 0.3) score += 4;

  // Comments (// or /* or # at start of line)
  const commentPattern = /^\s*(\/\/|\/\*|#(?!include)|<!--)/m;
  if (commentPattern.test(trimmed)) score += 3;

  // String literals
  if (/['"`].*['"`]/.test(trimmed)) score += 2;

  // ── Negative signals (penalize non-code) ──

  // Very long lines of pure prose (no special chars)
  const proseLines = lines.filter((l) => {
    const t = l.trim();
    return t.length > 40 && !/[{}();=<>\[\]]/.test(t) && /^[a-zA-Z\s,.'"!?-]+$/.test(t);
  }).length;
  const proseRatio = totalLines > 0 ? proseLines / totalLines : 0;
  if (proseRatio > 0.6) score -= 20;
  else if (proseRatio > 0.3) score -= 10;

  // Bullet points / numbered lists (roadmap/notes pattern)
  const bulletLines = lines.filter((l) => /^\s*([-*•]|\d+[.)]) /.test(l)).length;
  const bulletRatio = totalLines > 0 ? bulletLines / totalLines : 0;
  if (bulletRatio > 0.4) score -= 15;

  // "I want to", "My goal is", "I'm learning" — planning language
  const planningPhrases = /\b(i want to|my goal|i('m| am) learning|i('m| am) planning|roadmap|learning path|my plan|i need to learn|goals for|step\s*\d+)\b/i;
  if (planningPhrases.test(trimmed)) score -= 12;

  // Clamp
  const clamped = Math.max(0, Math.min(maxScore, score));
  const threshold = 20;

  if (clamped >= threshold) {
    return { isCode: true, confidence: clamped, reason: "Input appears to be source code." };
  }

  return {
    isCode: false,
    confidence: 100 - clamped,
    reason: "Input does not appear to be source code. Please paste actual code (e.g. a function, component, class, script, or file).",
  };
}

// ─── System Prompt (Code-Only) ──────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior engineer and code reviewer who gives honest, direct feedback on source code.

A developer has shared their source code with you.

Your job is NOT to fix their code.
Your job is to diagnose their coding patterns, habits, skill level, and areas for improvement based on the code AND the developer's own explanation of their thought process.

You will receive:
1. The developer's source code
2. The developer's answers to questions about their thought process, goals, and experience

Use BOTH to give deeply personalized, contextual feedback. Their answers help you understand WHY they coded things a certain way, so your feedback can address the root cause, not just the symptoms.

IMPORTANT RULES:
- ONLY analyze source code. If the input somehow doesn't look like code, respond with an error.
- Be honest and direct, but explain things so a beginner can understand.
- When you reference a technical concept, briefly explain what it means.
- Write as if the developer is junior or self-taught — they want truth, not jargon.
- Don't be mean. Be like a tough but fair mentor who genuinely wants them to improve.
- Every observation must be grounded in evidence from the actual code.
- Do not invent weaknesses without evidence from the code.
- Avoid generic filler phrases like "Keep learning" or "Practice makes perfect".
- Be specific and actionable.

Focus on diagnosing from the CODE:
* code quality and readability
* proper use of language features and idioms
* error handling patterns
* naming conventions and consistency
* architecture and structure decisions
* whether they understand concepts deeply or just surface-level copy-paste
* performance anti-patterns
* security concerns if applicable

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
A short label describing their coding style based on the code. Examples:
* "Copy-Paste Coder" — code looks stitched together from tutorials without real understanding
* "Chaotic Builder" — functional but messy, no structure or patterns
* "Framework-Dependent" — can use frameworks but doesn't understand what's underneath
* "Solid Fundamentals" — clean, well-structured code with good patterns
* "Over-Engineer" — code is overly complex for what it does
* "Quick & Dirty" — gets it working but cuts every corner
Only assign one if clearly supported by the code.

weaknesses:
Array of objects. Each object has:
* "observation" — what gap or problem you noticed in the code (explain it simply)
* "evidence" — the specific line, pattern, or snippet from their code that shows this
* "confidenceScore" — 1 to 10, how sure you are about this observation

Example:
{
  "observation": "You know how to use useState in React, but you're creating extra state variables when you could just calculate the value from existing state. This causes your app to re-render (redraw on screen) more than needed.",
  "evidence": "Your code has a separate 'filteredItems' state that duplicates data already available from 'items' and 'searchTerm'.",
  "confidenceScore": 9
}

realityCheck:
Array of objects. Each has:
* "issue" — the coding pattern or habit you noticed
* "evidence" — what in their code shows this
* "consequence" — what happens if they keep coding this way (explain simply)
* "correction" — a specific, actionable thing to do differently in their code
* "lineStart" — the starting line number in the code where this issue occurs (use the line numbers provided in the code). Use null if it's a general pattern not tied to specific lines.
* "lineEnd" — the ending line number (inclusive). Use null if not applicable.

roadmap:
Array of objects. Each has:
* "topic" — what to learn next based on the gaps visible in their code
* "why" — why this matters for them specifically (in plain language)
* "prerequisite" — what they should know first
* "timeEstimate" — realistic time to learn this
* "buildToProveSkill" — a specific project that proves they actually learned it

tasks:
Array of 3-5 plain strings. Each string is one concrete thing to do this week.
Tasks must be specific, measurable, and involve actually building or refactoring code.
IMPORTANT: Each task must be a simple string, NOT an object.

Good task: "Refactor your component to derive filteredItems from existing state instead of storing it separately."
Bad task: "Practice React more."

knowledgeMap:
Object with:
* "known" — array of strings: topics they seem to understand based on the code
* "missing" — array of strings: topics they need to learn based on gaps in the code
* "relationships" — array of {from, to} objects showing which topics depend on which (from should be learned before to)

CRITICAL: Return ONLY the raw JSON object. No markdown, no code fences, no explanation before or after. Just the JSON.`;

// ─── Helper: wait ───────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Helper: Convert OpenAI-style SSE stream to DevMirror format ────

function convertOpenAIStream(response: Response): ReadableStream {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response stream");

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
                let text = parsed.choices?.[0]?.delta?.content;
                if (text) {
                  // Fix raw BPE tokens that some DeepSeek/Qwen endpoints leak
                  text = text.replace(/Ċ/g, '\n').replace(/Ġ/g, ' ');
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
        const msg = err instanceof Error ? err.message : "Stream error";
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`)
        );
        controller.close();
      }
    },
  });
}

// ─── Groq (Primary) — llama-3.3-70b-versatile ──────────────────────────

async function callGroq(input: string): Promise<ReadableStream> {
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
      stream: true,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: input },
      ],
      max_tokens: 8192,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq ${res.status}: ${errText}`);
  }

  return convertOpenAIStream(res);
}

// ─── Gemini (Fallback 1) ───────────────────────────────────────────

async function callGemini(input: string, retryCount = 0): Promise<ReadableStream> {
  const apiKey = process.env.PRIMARY_GEMINI_API_KEY;
  if (!apiKey) throw new Error("PRIMARY_GEMINI_API_KEY not configured");

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

    throw new Error(`Gemini failed: ${raw.substring(0, 100)}`);
  }
}

// ─── OpenRouter (Fallback 2) ────────────────────────────────────────

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
      model: "deepseek/deepseek-r1-distill-qwen-32b",
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
    throw new Error(`OpenRouter ${res.status}: ${errText}`);
  }

  return convertOpenAIStream(res);
}

// ─── Route Handler ──────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { input, context } = await request.json();

    if (!input || typeof input !== "string" || input.trim().length === 0) {
      return Response.json({ error: "Input is required" }, { status: 400 });
    }

    // ── Code-only gate: reject non-code input before it reaches the AI ──
    const codeCheck = detectCode(input);
    if (!codeCheck.isCode) {
      return Response.json(
        {
          error: "CODE_ONLY",
          message: "Please paste actual source code only. DevMirror analyzes code — not notes, roadmaps, transcriptions, or plain text.",
          detail: codeCheck.reason,
        },
        { status: 422 }
      );
    }

    // Build the prompt: code + developer context (answers to questions)
    // Prepend line numbers to each line so the AI can reference them
    const numberedCode = input
      .split("\n")
      .map((line, i) => `${i + 1}: ${line}`)
      .join("\n");

    let userPrompt = numberedCode;
    if (context && typeof context === "string" && context.trim().length > 0) {
      userPrompt = `=== SOURCE CODE (with line numbers) ===\n${numberedCode}\n\n=== DEVELOPER'S THOUGHT PROCESS ===\n${context}`;
    }

    // Provider chain: OpenRouter (DeepSeek R1) → Groq (Llama 3.3) → Gemini
    const providers: { name: string; call: (i: string) => Promise<ReadableStream>; available: boolean }[] = [
      { name: "openrouter", call: callOpenRouter, available: !!process.env.SECONDARY_OPENROUTER_API_KEY },
      { name: "groq", call: callGroq, available: !!process.env.GROQ_API_KEY },
      { name: "gemini", call: callGemini, available: !!process.env.PRIMARY_GEMINI_API_KEY },
    ];

    let stream: ReadableStream | null = null;
    let provider = "unknown";
    let lastError = "";

    for (const p of providers) {
      if (!p.available) continue;
      try {
        stream = await p.call(userPrompt);
        provider = p.name;
        break;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        console.error(`[DevMirror] Analyze: ${p.name} failed:`, lastError);
      }
    }

    if (!stream) {
      console.error("[DevMirror] All providers failed. Last error:", lastError);
      return Response.json(
        { error: "Our AI servers are busy right now. Please try again in a moment." },
        { status: 502 }
      );
    }

    console.log(`[DevMirror] Analysis streaming via ${provider}`);

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Provider": provider,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[DevMirror] Analyze error:", message);
    return Response.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
