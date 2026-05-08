"use client";

import { useState, useRef } from "react";

// ─── Types ──────────────────────────────────────────────────────────

interface Weakness {
  observation: string;
  evidence: string;
  confidenceScore: number;
}

interface RealityCheckItem {
  issue: string;
  evidence: string;
  consequence: string;
  correction: string;
}

interface RoadmapItem {
  topic: string;
  why: string;
  prerequisite: string;
  timeEstimate: string;
  buildToProveSkill: string;
}

interface Relationship {
  from: string;
  to: string;
}

interface KnowledgeMap {
  known: string[];
  missing: string[];
  relationships: Relationship[];
}

interface AnalysisResult {
  developerArchetype: string;
  weaknesses: Weakness[];
  realityCheck: RealityCheckItem[];
  roadmap: RoadmapItem[];
  tasks: (string | Record<string, unknown>)[];
  knowledgeMap: KnowledgeMap;
}

type TabKey =
  | "weaknesses"
  | "realityCheck"
  | "roadmap"
  | "tasks"
  | "knowledgeMap";

type MobileView = "input" | "output";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "weaknesses", label: "Gaps", icon: "🔍" },
  { key: "realityCheck", label: "Reality Check", icon: "💡" },
  { key: "roadmap", label: "Roadmap", icon: "🗺️" },
  { key: "tasks", label: "This Week", icon: "✅" },
  { key: "knowledgeMap", label: "Skill Map", icon: "🧠" },
];

const TAB_DESCRIPTIONS: Record<TabKey, string> = {
  weaknesses:
    "These are specific gaps in your understanding that we spotted from what you shared. Not insults — just areas where you can grow the fastest.",
  realityCheck:
    "Honest observations about your learning habits. These can feel uncomfortable, but recognizing patterns is the first step to fixing them.",
  roadmap:
    "A prioritized list of what to learn next, in order. Each item includes why it matters and a project to prove you've learned it.",
  tasks:
    "Concrete things to do this week. Not vague advice — real, measurable actions you can start today.",
  knowledgeMap:
    "A map of what you already know, what's missing, and how topics connect to each other.",
};

// ─── Confidence Indicator ───────────────────────────────────────────

function ConfidenceBar({ score }: { score: number }) {
  const clamped = Math.max(1, Math.min(10, score));
  const pct = clamped * 10;
  const color =
    clamped >= 8
      ? "bg-rose-400"
      : clamped >= 5
        ? "bg-amber-400"
        : "bg-emerald-400";
  const label =
    clamped >= 8
      ? "High confidence"
      : clamped >= 5
        ? "Medium confidence"
        : "Low confidence";
  return (
    <div className="flex items-center gap-2 mt-2">
      <span className="text-[10px] text-foreground/40 w-28">{label}</span>
      <div className="flex-1 h-1.5 bg-border/50 rounded-full overflow-hidden max-w-28">
        <div
          className={`h-full ${color} rounded-full`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-foreground/40">{clamped}/10</span>
    </div>
  );
}

// ─── Knowledge Map Renderer ─────────────────────────────────────────

function KnowledgeMapVisual({ km }: { km: KnowledgeMap }) {
  return (
    <div className="space-y-6">
      {/* Known */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">✅</span>
          <span className="text-sm text-foreground-strong font-bold">
            What you already know
          </span>
        </div>
        {km.known.length === 0 ? (
          <p className="text-xs text-foreground/30 pl-7">
            Nothing detected from your input
          </p>
        ) : (
          <div className="flex flex-wrap gap-2 pl-7">
            {km.known.map((item, i) => (
              <span
                key={i}
                className="px-3 py-1.5 text-xs bg-accent-soft border border-accent/20 text-accent rounded-full"
              >
                {item}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Missing */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">🚧</span>
          <span className="text-sm text-foreground-strong font-bold">
            What you need to learn
          </span>
        </div>
        {km.missing.length === 0 ? (
          <p className="text-xs text-foreground/30 pl-7">
            Nothing detected from your input
          </p>
        ) : (
          <div className="flex flex-wrap gap-2 pl-7">
            {km.missing.map((item, i) => (
              <span
                key={i}
                className="px-3 py-1.5 text-xs bg-danger-soft border border-danger/20 text-danger rounded-full"
              >
                {item}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Connections */}
      {km.relationships.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">🔗</span>
            <span className="text-sm text-foreground-strong font-bold">
              How topics connect
            </span>
            <span className="text-[10px] text-foreground/30 ml-1 hidden sm:inline">
              (learn the left side before the right)
            </span>
          </div>
          <div className="space-y-1.5 pl-7">
            {km.relationships.map((rel, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="text-info px-2 py-1 bg-info-soft rounded">
                  {rel.from}
                </span>
                <span className="text-foreground/30">→</span>
                <span className="text-foreground-strong px-2 py-1 bg-surface rounded">
                  {rel.to}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────

export default function Home() {
  const [input, setInput] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("weaknesses");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawStream, setRawStream] = useState("");
  const [provider, setProvider] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<MobileView>("input");
  const abortRef = useRef<AbortController | null>(null);

  const analyze = async () => {
    if (!input.trim() || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setRawStream("");
    setProvider(null);
    setActiveTab("weaknesses");
    // Auto-switch to output view on mobile when analyzing
    setMobileView("output");

    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: input.trim() }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      setProvider(res.headers.get("X-Provider") || "unknown");

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.error) throw new Error(parsed.error);
              if (parsed.text) {
                accumulated += parsed.text;
                setRawStream(accumulated);
              }
            } catch (e) {
              if (e instanceof SyntaxError) continue;
              throw e;
            }
          }
        }
      }

      // Parse the complete JSON
      const trimmed = accumulated.trim();
      const jsonStr = trimmed
        .replace(/^```json?\s*/, "")
        .replace(/\s*```$/, "");
      const parsed = JSON.parse(jsonStr);
      setResult(parsed);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      analyze();
    }
  };

  const hasOutput = loading || error || result;

  return (
    <div className="h-dvh flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-border px-4 sm:px-6 py-3 sm:py-3.5 flex items-center justify-between bg-surface/50">
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="text-accent font-bold text-sm tracking-wider">
            DEVMIRROR
          </span>
          <span className="text-foreground/40 text-xs hidden sm:inline">
            your ai coding mentor
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {provider && (
            <span className="text-accent/50 text-[10px] uppercase tracking-wider px-2 py-0.5 bg-accent-soft rounded">
              via {provider}
            </span>
          )}
          <span className="text-foreground/25 text-xs hidden sm:inline">gemini-2.0-flash</span>
        </div>
      </header>

      {/* Main Content — stacks vertically below lg, side-by-side at lg+ */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Left Panel — Input */}
        <div
          className={`
            w-full lg:w-[420px] flex-shrink-0
            lg:border-r border-border flex flex-col
            ${mobileView !== "input" ? "hidden lg:flex" : "flex"}
          `}
        >
          <div className="px-4 py-3 border-b border-border bg-surface/30 flex items-center justify-between">
            <span className="text-xs text-foreground/50 uppercase tracking-wider">
              Your Input
            </span>
            {/* Mobile: quick link to results when available */}
            {hasOutput && (
              <button
                onClick={() => setMobileView("output")}
                className="lg:hidden text-[10px] text-accent uppercase tracking-wider px-2.5 py-1 bg-accent-soft rounded-full border border-accent/20 cursor-pointer"
              >
                View Results →
              </button>
            )}
          </div>
          <div className="flex-1 p-3 sm:p-4 flex flex-col min-h-0">
            <textarea
              id="main-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Paste your code, notes, tutorial transcripts, learning goals, errors, or roadmap. Dump everything."
              className="flex-1 w-full min-h-[200px] lg:min-h-0 bg-surface border border-border rounded-lg p-3 sm:p-4 text-sm text-foreground-strong placeholder:text-foreground/30 font-mono focus:border-accent/40"
              spellCheck={false}
            />
            <button
              id="analyze-btn"
              onClick={analyze}
              disabled={loading || !input.trim()}
              className="mt-3 w-full py-3 bg-accent/15 border border-accent/30 text-accent text-sm font-bold tracking-wider rounded-lg hover:bg-accent/25 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer active:scale-[0.98] transition-transform"
            >
              {loading ? "⏳ DIAGNOSING..." : "🔬 ANALYZE"}
            </button>
            <span className="mt-2 text-[10px] text-foreground/25 text-center hidden sm:block">
              Ctrl+Enter to submit
            </span>
          </div>
        </div>

        {/* Right Panel — Output */}
        <div
          className={`
            flex-1 flex flex-col min-h-0
            ${mobileView !== "output" ? "hidden lg:flex" : "flex"}
          `}
        >
          {/* Archetype Banner */}
          {result && !loading && result.developerArchetype && (
            <div className="flex-shrink-0 border-b border-border px-4 sm:px-6 py-3 bg-warning-soft flex items-center gap-3">
              <span className="text-base">🏷️</span>
              <div className="min-w-0">
                <span className="text-[10px] text-foreground/40 uppercase tracking-wider mr-2 hidden sm:inline">
                  Your developer profile:
                </span>
                <span className="text-sm text-warning font-bold">
                  {result.developerArchetype}
                </span>
              </div>
            </div>
          )}

          {/* Tabs — scrollable on small screens */}
          <div className="flex-shrink-0 border-b border-border flex overflow-x-auto bg-surface/30 scrollbar-none">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                id={`tab-${tab.key}`}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 sm:px-4 py-3 text-[11px] sm:text-xs tracking-wider cursor-pointer border-b-2 flex items-center gap-1 sm:gap-1.5 whitespace-nowrap flex-shrink-0 ${
                  activeTab === tab.key
                    ? "text-accent border-accent bg-accent-soft"
                    : "text-foreground/40 border-transparent hover:text-foreground/60 hover:bg-surface/50"
                }`}
              >
                <span className="text-sm">{tab.icon}</span>
                {tab.label.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Tab Content — extra bottom padding on mobile for the nav bar */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-20 lg:pb-6">
            {/* Loading */}
            {loading && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-surface rounded-lg border border-border">
                  <span className="inline-block w-2.5 h-2.5 bg-accent rounded-full animate-pulse" />
                  <div>
                    <span className="text-sm text-foreground-strong">
                      Analyzing your input...
                    </span>
                    <p className="text-xs text-foreground/40 mt-0.5">
                      This usually takes 5-15 seconds
                    </p>
                  </div>
                </div>
                {rawStream && (
                  <pre className="text-xs text-foreground/25 whitespace-pre-wrap break-words font-mono leading-relaxed p-4 bg-surface/50 rounded-lg border border-border/50">
                    {rawStream}
                  </pre>
                )}
              </div>
            )}

            {/* Error */}
            {error && !loading && (
              <div className="border border-danger/30 rounded-lg p-4 sm:p-5 bg-danger-soft">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">⚠️</span>
                  <span className="text-sm text-danger font-bold">
                    Something went wrong
                  </span>
                </div>
                <pre className="text-sm text-danger/80 whitespace-pre-wrap break-words font-mono">
                  {error}
                </pre>
                <p className="mt-3 text-xs text-foreground/40">
                  Try again in a few seconds. If it keeps failing, the API might
                  be rate-limited.
                </p>
              </div>
            )}

            {/* Empty State */}
            {!loading && !error && !result && (
              <div className="h-full flex items-center justify-center">
                <div className="text-center max-w-md px-4">
                  <span className="text-4xl mb-4 block">🪞</span>
                  <p className="text-foreground/40 text-sm leading-relaxed mb-2">
                    <span className="hidden lg:inline">
                      Paste your code, notes, or learning roadmap on the left and
                      hit{" "}
                    </span>
                    <span className="lg:hidden">
                      Switch to Input, paste your code or notes, and hit{" "}
                    </span>
                    <span className="text-accent">Analyze</span>.
                  </p>
                  <p className="text-foreground/25 text-xs leading-relaxed">
                    DevMirror will analyze how you learn and think — not just
                    what you code. It&apos;s like a mentor reviewing your approach.
                  </p>
                </div>
              </div>
            )}

            {/* ── Results ── */}
            {result && !loading && (
              <>
                {/* Section description */}
                <div className="mb-4 sm:mb-5 p-3 bg-surface/50 rounded-lg border border-border/50">
                  <p className="text-xs text-foreground/50 leading-relaxed">
                    {TAB_DESCRIPTIONS[activeTab]}
                  </p>
                </div>

                {/* Weaknesses */}
                {activeTab === "weaknesses" && (
                  <div className="space-y-3 sm:space-y-4">
                    {result.weaknesses.map((w, i) => (
                      <div
                        key={i}
                        className="border border-border rounded-lg p-3 sm:p-4 bg-danger-soft/50"
                      >
                        <div className="flex items-start gap-2 sm:gap-3">
                          <span className="text-danger/60 text-sm mt-0.5">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground-strong leading-relaxed font-bold">
                              {w.observation}
                            </p>
                            <div className="mt-2 pl-3 border-l-2 border-border">
                              <p className="text-xs text-foreground/50 leading-relaxed">
                                <span className="text-foreground/30 font-bold">
                                  How we spotted this:
                                </span>{" "}
                                {w.evidence}
                              </p>
                            </div>
                            <ConfidenceBar score={w.confidenceScore} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Reality Check */}
                {activeTab === "realityCheck" && (
                  <div className="space-y-3 sm:space-y-4">
                    {result.realityCheck.map((r, i) => (
                      <div
                        key={i}
                        className="border border-border rounded-lg p-3 sm:p-4 bg-warning-soft/50"
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-warning text-sm">💡</span>
                          <p className="text-sm text-warning font-bold">
                            {r.issue}
                          </p>
                        </div>

                        <div className="space-y-2.5 pl-4 sm:pl-7">
                          <div>
                            <span className="text-[10px] text-foreground/30 uppercase tracking-wider">
                              What we noticed
                            </span>
                            <p className="text-xs text-foreground/60 leading-relaxed mt-0.5">
                              {r.evidence}
                            </p>
                          </div>
                          <div>
                            <span className="text-[10px] text-danger/60 uppercase tracking-wider">
                              Why this is a problem
                            </span>
                            <p className="text-xs text-foreground/60 leading-relaxed mt-0.5">
                              {r.consequence}
                            </p>
                          </div>
                          <div className="bg-accent-soft p-2.5 rounded border border-accent/15">
                            <span className="text-[10px] text-accent/60 uppercase tracking-wider">
                              What to do instead
                            </span>
                            <p className="text-xs text-accent leading-relaxed mt-0.5">
                              {r.correction}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Roadmap */}
                {activeTab === "roadmap" && (
                  <div className="space-y-3">
                    {result.roadmap.map((item, i) => (
                      <div
                        key={i}
                        className="border border-border rounded-lg p-3 sm:p-4 bg-surface/50"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2.5">
                              <span className="text-accent bg-accent-soft w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                                {i + 1}
                              </span>
                              <span className="text-sm text-foreground-strong font-bold">
                                {item.topic}
                              </span>
                              {/* Time estimate inline on small screens */}
                              <span className="sm:hidden text-[10px] text-foreground/35 bg-surface border border-border px-2 py-0.5 rounded-full whitespace-nowrap ml-auto">
                                ⏱️ {item.timeEstimate}
                              </span>
                            </div>
                            <p className="mt-2 text-xs text-foreground/50 leading-relaxed pl-10">
                              {item.why}
                            </p>
                            {item.prerequisite && (
                              <p className="mt-1.5 text-[10px] text-foreground/35 pl-10">
                                <span className="text-info/60">
                                  📋 Learn first:
                                </span>{" "}
                                {item.prerequisite}
                              </p>
                            )}
                            {item.buildToProveSkill && (
                              <div className="mt-2.5 ml-10 p-2.5 bg-accent-soft rounded border border-accent/15">
                                <span className="text-[10px] text-accent/60 uppercase tracking-wider">
                                  🛠️ Build this to prove you learned it
                                </span>
                                <p className="text-xs text-accent leading-relaxed mt-0.5">
                                  {item.buildToProveSkill}
                                </p>
                              </div>
                            )}
                          </div>
                          {/* Time estimate badge on the right for larger screens */}
                          <span className="hidden sm:inline text-[10px] text-foreground/35 bg-surface border border-border px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0">
                            ⏱️ {item.timeEstimate}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tasks */}
                {activeTab === "tasks" && (
                  <div className="space-y-3">
                    {result.tasks.map((task, i) => {
                      const taskText =
                        typeof task === "string"
                          ? task
                          : typeof task === "object" && task !== null
                            ? (task as Record<string, unknown>).task as string ||
                              (task as Record<string, unknown>).description as string ||
                              JSON.stringify(task)
                            : String(task);
                      return (
                        <div
                          key={i}
                          className="flex items-start gap-3 p-3 sm:p-4 border border-border rounded-lg bg-surface/50"
                        >
                          <span className="text-accent bg-accent-soft w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                            {i + 1}
                          </span>
                          <p className="text-sm text-foreground-strong leading-relaxed">
                            {taskText}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Knowledge Map */}
                {activeTab === "knowledgeMap" && result.knowledgeMap && (
                  <KnowledgeMapVisual km={result.knowledgeMap} />
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ─── Mobile View Toggle (fixed bottom bar) ─── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-surface/95 backdrop-blur-xl safe-area-pb">
        <div className="flex">
          <button
            onClick={() => setMobileView("input")}
            className={`flex-1 py-3.5 text-xs font-bold tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-colors ${
              mobileView === "input"
                ? "text-accent bg-accent-soft"
                : "text-foreground/40"
            }`}
          >
            <span>✏️</span>
            INPUT
          </button>
          <div className="w-px bg-border" />
          <button
            onClick={() => setMobileView("output")}
            className={`flex-1 py-3.5 text-xs font-bold tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-colors relative ${
              mobileView === "output"
                ? "text-accent bg-accent-soft"
                : "text-foreground/40"
            }`}
          >
            <span>📊</span>
            RESULTS
            {/* Notification dot when results ready and user is on input view */}
            {result && mobileView === "input" && (
              <span className="absolute top-2.5 right-[calc(50%-30px)] w-2 h-2 bg-accent rounded-full animate-pulse" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
