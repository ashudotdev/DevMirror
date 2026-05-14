"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";

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
  lineStart?: number | null;
  lineEnd?: number | null;
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
type Phase = "input" | "questions" | "analyzing" | "results";

interface QuestionItem {
  id: string;
  question: string;
}

interface GitHubUserInfo {
  id: number;
  login: string;
  avatar_url: string;
  name: string | null;
}

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  updated_at: string;
  private: boolean;
  default_branch: string;
}

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "weaknesses", label: "Gaps", icon: "🔍" },
  { key: "realityCheck", label: "Reality Check", icon: "💡" },
  { key: "roadmap", label: "Roadmap", icon: "🗺️" },
  { key: "tasks", label: "This Week", icon: "✅" },
  { key: "knowledgeMap", label: "Skill Map", icon: "🧠" },
];

const TAB_DESCRIPTIONS: Record<TabKey, string> = {
  weaknesses:
    "Specific gaps and anti-patterns we found in your code. Not insults — just areas where your code (and skills) can improve the fastest.",
  realityCheck:
    "Honest observations about your coding patterns and habits. Recognizing these patterns is the first step to writing better code.",
  roadmap:
    "A prioritized list of what to learn next based on the gaps in your code. Each item includes why it matters and a project to prove you've learned it.",
  tasks:
    "Concrete things to do this week. Not vague advice — real, specific coding tasks and refactors you can start today.",
  knowledgeMap:
    "A map of what you already know, what's missing, and how topics connect — all based on what your code reveals.",
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
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // ─── Scroll-to-line helper ────────────────────────────────────────
  const scrollToLine = useCallback((lineStart: number, lineEnd?: number | null) => {
    // Switch to input view on mobile
    setMobileView("input");

    const ta = textareaRef.current;
    if (!ta) return;

    const lines = ta.value.split("\n");
    const start = Math.max(0, lineStart - 1);
    const end = Math.min(lines.length - 1, (lineEnd || lineStart) - 1);

    // Calculate character offsets
    let charStart = 0;
    for (let i = 0; i < start; i++) charStart += lines[i].length + 1;
    let charEnd = charStart;
    for (let i = start; i <= end; i++) charEnd += lines[i].length + 1;
    charEnd -= 1; // don't include trailing newline

    ta.focus();
    ta.setSelectionRange(charStart, charEnd);

    // Scroll the textarea so the selected lines are visible
    const lineHeight = ta.scrollHeight / lines.length;
    ta.scrollTop = Math.max(0, (start - 2) * lineHeight);
  }, []);

  // ─── Compute line count for gutter display ────────────────────────
  const lineCount = useMemo(() => input.split("\n").length, [input]);

  // ─── Phase & questions state ─────────────────────────────────────
  const [phase, setPhase] = useState<Phase>("input");
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [questionsLoading, setQuestionsLoading] = useState(false);

  // ─── GitHub state ───────────────────────────────────────────────
  const [ghUser, setGhUser] = useState<GitHubUserInfo | null>(null);
  const [ghRepos, setGhRepos] = useState<GitHubRepo[]>([]);
  const [showRepoPicker, setShowRepoPicker] = useState(false);
  const [repoSearch, setRepoSearch] = useState("");
  const [reposLoading, setReposLoading] = useState(false);
  const [importLoading, setImportLoading] = useState<string | null>(null);
  const [ghChecked, setGhChecked] = useState(false);
  // Folder picker state
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [folders, setFolders] = useState<{ path: string; codeFileCount: number }[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [totalCodeFiles, setTotalCodeFiles] = useState(0);
  const [rootFileCount, setRootFileCount] = useState(0);

  // Check session on mount
  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => { if (data.user) setGhUser(data.user); })
      .catch(() => { })
      .finally(() => setGhChecked(true));
  }, []);

  // Fetch repos when picker opens
  const fetchRepos = useCallback(async (query = "") => {
    setReposLoading(true);
    try {
      const q = query ? `&q=${encodeURIComponent(query)}` : "";
      const res = await fetch(`/api/github/repos?per_page=20${q}`);
      const data = await res.json();
      setGhRepos(data.repos || []);
    } catch { setGhRepos([]); }
    finally { setReposLoading(false); }
  }, []);

  useEffect(() => {
    if (showRepoPicker) fetchRepos(repoSearch);
  }, [showRepoPicker, fetchRepos, repoSearch]);

  // When user clicks a repo, fetch its folder tree
  const selectRepo = async (repo: GitHubRepo) => {
    setSelectedRepo(repo);
    setFoldersLoading(true);
    setFolders([]);
    try {
      const [owner, name] = repo.full_name.split("/");
      const res = await fetch(
        `/api/github/tree?owner=${owner}&repo=${name}&branch=${repo.default_branch}`
      );
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setFolders(data.folders || []);
      setTotalCodeFiles(data.totalCodeFiles || 0);
      setRootFileCount(data.rootFileCount || 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load folders");
    } finally { setFoldersLoading(false); }
  };

  // Import code from a specific folder (or entire repo)
  const importFromFolder = async (rootPath: string) => {
    if (!selectedRepo) return;
    setImportLoading(rootPath || "__root__");
    try {
      const [owner, name] = selectedRepo.full_name.split("/");
      let url = `/api/github/code?owner=${owner}&repo=${name}&branch=${selectedRepo.default_branch}`;
      if (rootPath) url += `&rootPath=${encodeURIComponent(rootPath)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setInput(data.code);
      setShowRepoPicker(false);
      setSelectedRepo(null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to import repo");
    } finally { setImportLoading(null); }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setGhUser(null);
    setGhRepos([]);
  };

  // Deep analyze — fetch questions first for more personalized feedback
  const analyze = async () => {
    if (!input.trim() || loading || questionsLoading) return;

    setQuestionsLoading(true);
    setError(null);
    setResult(null);
    setRawStream("");
    setProvider(null);
    setQuestions([]);
    setAnswers({});
    setActiveTab("weaknesses");
    setMobileView("output");

    try {
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: input.trim() }),
      });

      if (!res.ok) {
        const err = await res.json();
        if (err.error === "CODE_ONLY") {
          setError(`⛔ ${err.message}`);
          setMobileView("input");
          setQuestionsLoading(false);
          setPhase("input");
          return;
        }
        throw new Error(err.error || "Something went wrong. Please try again.");
      }

      const data = await res.json();
      if (data.questions && data.questions.length > 0) {
        setQuestions(data.questions);
        const emptyAnswers: Record<string, string> = {};
        data.questions.forEach((q: QuestionItem) => { emptyAnswers[q.id] = ""; });
        setAnswers(emptyAnswers);
        setPhase("questions");
      } else {
        await runAnalysis(input.trim(), "");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.startsWith("⛔") || msg.includes("try again") || msg.includes("Please")) {
        setError(msg);
      } else {
        setError("Something went wrong. Please try again.");
      }
      setPhase("input");
    } finally {
      setQuestionsLoading(false);
    }
  };

  // Step 2: Submit answers and run full analysis
  const submitAnswers = async () => {
    // Format answers into context string
    const contextParts = questions.map((q) => {
      const ans = answers[q.id]?.trim() || "(skipped)";
      return `Q: ${q.question}\nA: ${ans}`;
    });
    const context = contextParts.join("\n\n");

    setPhase("analyzing");
    await runAnalysis(input.trim(), context);
  };

  // Core analysis runner (called after questions are answered)
  const runAnalysis = async (code: string, context: string) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setRawStream("");
    setProvider(null);
    setActiveTab("weaknesses");

    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: code, context }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json();
        if (err.error === "CODE_ONLY") {
          setError(`⛔ ${err.message}`);
          setMobileView("input");
          setPhase("input");
          setLoading(false);
          return;
        }
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

      const trimmed = accumulated.trim();
      
      // DeepSeek models output <think>...</think> before JSON.
      // We extract only the actual JSON object to avoid parse errors.
      const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
      let jsonStr = jsonMatch ? jsonMatch[0] : trimmed;
      
      jsonStr = jsonStr
        .replace(/^```json?\s*/, "")
        .replace(/\s*```$/, "");

      // Try to parse the JSON, with repair attempts for common AI output issues
      let parsed;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        // Attempt basic repairs on malformed JSON
        try {
          const repaired = jsonStr
            // Remove trailing commas before } or ]
            .replace(/,\s*([}\]])/g, "$1")
            // Try to close unclosed strings/objects (truncated output)
            .replace(/,?\s*$/, "");

          // Try adding closing braces if truncated
          let fixedJson = repaired;
          const openBraces = (fixedJson.match(/{/g) || []).length;
          const closeBraces = (fixedJson.match(/}/g) || []).length;
          const openBrackets = (fixedJson.match(/\[/g) || []).length;
          const closeBrackets = (fixedJson.match(/]/g) || []).length;

          for (let i = 0; i < openBrackets - closeBrackets; i++) fixedJson += "]";
          for (let i = 0; i < openBraces - closeBraces; i++) fixedJson += "}";

          parsed = JSON.parse(fixedJson);
        } catch {
          // All repair attempts failed — show a friendly message
          throw new Error("PARSE_FAIL");
        }
      }
      setResult(parsed);
      setPhase("results");
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;

      const msg = err instanceof Error ? err.message : String(err);

      if (msg === "PARSE_FAIL" || msg.includes("SyntaxError") || msg.includes("JSON") || msg.includes("Unexpected")) {
        setError("Something went wrong. Please try again.");
      } else if (msg.startsWith("⛔") || msg.includes("try again") || msg.includes("Please")) {
        setError(msg);
      } else {
        setError("Something went wrong. Please try again.");
      }
      setPhase("input");
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

  const hasOutput = loading || error || result || questionsLoading || phase === "questions";

  return (
    <>
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
            {/* GitHub auth */}
            {ghChecked && (
              ghUser ? (
                <div className="flex items-center gap-2">
                  <img
                    src={ghUser.avatar_url}
                    alt={ghUser.login}
                    className="w-6 h-6 rounded-full border border-border"
                  />
                  <span className="text-xs text-foreground/50 hidden sm:inline">{ghUser.login}</span>
                  <button
                    onClick={handleLogout}
                    className="text-[10px] text-foreground/30 hover:text-danger cursor-pointer px-1.5 py-0.5 rounded hover:bg-danger-soft transition-colors"
                  >
                    logout
                  </button>
                </div>
              ) : (
                <a
                  href="/api/auth/github"
                  className="flex items-center gap-1.5 text-xs text-foreground/60 hover:text-foreground-strong px-2.5 py-1.5 bg-surface border border-border rounded-lg hover:border-accent/30 transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" /></svg>
                  Sign in
                </a>
              )
            )}
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
              {/* Import from GitHub button */}
              {ghUser && (
                <button
                  onClick={() => setShowRepoPicker(true)}
                  className="mb-2 w-full py-2.5 flex items-center justify-center gap-2 bg-surface border border-border rounded-lg text-xs text-foreground/60 hover:text-foreground-strong hover:border-accent/30 cursor-pointer transition-colors"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" /></svg>
                  Import from GitHub Repo
                </button>
              )}
              <textarea
                id="main-input"
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Paste your source code here — a function, component, class, module, or entire file. DevMirror only analyzes code."
                className="flex-1 w-full min-h-[200px] lg:min-h-0 bg-surface border border-border rounded-lg p-3 sm:p-4 text-sm text-foreground-strong placeholder:text-foreground/30 font-mono focus:border-accent/40"
                spellCheck={false}
              />
              <button
                id="analyze-btn"
                onClick={analyze}
                disabled={loading || questionsLoading || !input.trim()}
                className="mt-3 w-full py-3 bg-accent/15 border border-accent/30 text-accent text-sm font-bold tracking-wider rounded-lg hover:bg-accent/25 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer active:scale-[0.98] transition-transform"
              >
                {questionsLoading ? "⏳ READING CODE..." : loading ? "⏳ ANALYZING..." : "🔬 ANALYZE"}
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
                  className={`px-3 sm:px-4 py-3 text-[11px] sm:text-xs tracking-wider cursor-pointer border-b-2 flex items-center gap-1 sm:gap-1.5 whitespace-nowrap flex-shrink-0 ${activeTab === tab.key
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
              {/* Questions Loading */}
              {questionsLoading && (
                <div className="flex items-center gap-3 p-4 bg-surface rounded-lg border border-border">
                  <span className="inline-block w-2.5 h-2.5 bg-accent rounded-full animate-pulse" />
                  <div>
                    <span className="text-sm text-foreground-strong">
                      Reading your code...
                    </span>
                    <p className="text-xs text-foreground/40 mt-0.5">
                      Generating a few questions to understand your thinking
                    </p>
                  </div>
                </div>
              )}

              {/* Questions Phase */}
              {phase === "questions" && questions.length > 0 && !loading && !questionsLoading && (
                <div className="space-y-4">
                  <div className="p-4 bg-info-soft rounded-lg border border-info/20">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base">🤔</span>
                      <span className="text-sm text-info font-bold">Before we review...</span>
                    </div>
                    <p className="text-xs text-foreground/50 leading-relaxed">
                      Help us understand your thought process so we can give you more relevant, personalized feedback. Answer what you can — skip is fine too.
                    </p>
                  </div>

                  {questions.map((q, i) => (
                    <div key={q.id} className="border border-border rounded-lg p-4 bg-surface/50">
                      <div className="flex items-start gap-2.5 mb-2.5">
                        <span className="text-accent bg-accent-soft w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <p className="text-sm text-foreground-strong leading-relaxed">
                          {q.question}
                        </p>
                      </div>
                      <textarea
                        value={answers[q.id] || ""}
                        onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                        placeholder="Your answer (optional)..."
                        className="w-full bg-background border border-border rounded-lg p-3 text-sm text-foreground-strong placeholder:text-foreground/25 font-mono focus:border-accent/40 focus:outline-none min-h-[60px]"
                        rows={2}
                      />
                    </div>
                  ))}

                  <div className="flex gap-3">
                    <button
                      onClick={submitAnswers}
                      className="flex-1 py-3 bg-accent/15 border border-accent/30 text-accent text-sm font-bold tracking-wider rounded-lg hover:bg-accent/25 cursor-pointer active:scale-[0.98] transition-transform"
                    >
                      🔬 SUBMIT &amp; ANALYZE
                    </button>
                    <button
                      onClick={() => { setPhase("analyzing"); runAnalysis(input.trim(), ""); }}
                      className="py-3 px-4 bg-surface border border-border text-foreground/50 text-sm tracking-wider rounded-lg hover:text-foreground-strong hover:border-border-active cursor-pointer transition-colors"
                    >
                      Skip →
                    </button>
                  </div>
                </div>
              )}

              {/* Loading (analysis in progress) */}
              {loading && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-surface rounded-lg border border-border">
                    <span className="inline-block w-2.5 h-2.5 bg-accent rounded-full animate-pulse" />
                    <div>
                      <span className="text-sm text-foreground-strong">
                        Analyzing your code with your context...
                      </span>
                      <p className="text-xs text-foreground/40 mt-0.5">
                        This usually takes 10-20 seconds
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
                    <span className="text-base">😕</span>
                    <span className="text-sm text-danger font-bold">
                      Something went wrong
                    </span>
                  </div>
                  <p className="text-sm text-foreground/60 leading-relaxed">
                    {error}
                  </p>
                  <button
                    onClick={() => { setError(null); analyze(); }}
                    disabled={!input.trim()}
                    className="mt-3 px-4 py-2 bg-danger/10 border border-danger/20 text-danger text-xs font-bold rounded-lg hover:bg-danger/20 cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    🔄 Try Again
                  </button>
                </div>
              )}

              {/* Empty State */}
              {!loading && !error && !result && (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center max-w-md px-4">
                    <span className="text-4xl mb-4 block">🪞</span>
                    <p className="text-foreground/40 text-sm leading-relaxed mb-2">
                      <span className="hidden lg:inline">
                        Paste your source code on the left and hit{" "}
                      </span>
                      <span className="lg:hidden">
                        Switch to Input, paste your code, and hit{" "}
                      </span>
                      <span className="text-accent">Analyze</span>.
                    </p>
                    <p className="text-foreground/25 text-xs leading-relaxed">
                      DevMirror reviews your code like a senior engineer — analyzing
                      patterns, habits, and skill gaps from the code you write.
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
                            <p className="text-sm text-warning font-bold flex-1">
                              {r.issue}
                            </p>
                            {r.lineStart && (
                              <button
                                onClick={() => scrollToLine(r.lineStart!, r.lineEnd)}
                                className="flex-shrink-0 flex items-center gap-1 px-2 py-1 text-[10px] font-mono font-bold bg-info-soft text-info border border-info/20 rounded-md hover:bg-info/20 hover:border-info/40 cursor-pointer transition-all active:scale-95"
                                title={r.lineEnd && r.lineEnd !== r.lineStart ? `Go to lines ${r.lineStart}–${r.lineEnd}` : `Go to line ${r.lineStart}`}
                              >
                                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="16 18 22 12 16 6" />
                                  <polyline points="8 6 2 12 8 18" />
                                </svg>
                                {r.lineEnd && r.lineEnd !== r.lineStart
                                  ? `L${r.lineStart}–${r.lineEnd}`
                                  : `L${r.lineStart}`}
                              </button>
                            )}
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
              className={`flex-1 py-3.5 text-xs font-bold tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-colors ${mobileView === "input"
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
              className={`flex-1 py-3.5 text-xs font-bold tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-colors relative ${mobileView === "output"
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

      {/* ─── Repo Picker Modal ─── */}
      {showRepoPicker && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowRepoPicker(false); setSelectedRepo(null); }} />
          <div className="relative bg-background border border-border rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                {selectedRepo && (
                  <button
                    onClick={() => setSelectedRepo(null)}
                    className="text-foreground/40 hover:text-foreground-strong cursor-pointer text-sm mr-1"
                  >
                    ←
                  </button>
                )}
                <span className="text-sm text-foreground-strong font-bold">
                  {selectedRepo ? `${selectedRepo.name} — Choose Root` : "Select a Repository"}
                </span>
              </div>
              <button onClick={() => { setShowRepoPicker(false); setSelectedRepo(null); }} className="text-foreground/40 hover:text-foreground-strong cursor-pointer text-lg">✕</button>
            </div>

            {/* Step 1: Repo list */}
            {!selectedRepo && (
              <>
                <div className="px-4 py-2 border-b border-border">
                  <input
                    type="text"
                    value={repoSearch}
                    onChange={(e) => setRepoSearch(e.target.value)}
                    placeholder="Search your repos..."
                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground-strong placeholder:text-foreground/30 focus:border-accent/40 focus:outline-none"
                  />
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  {reposLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <span className="inline-block w-2.5 h-2.5 bg-accent rounded-full animate-pulse" />
                      <span className="ml-3 text-sm text-foreground/40">Loading repos...</span>
                    </div>
                  ) : ghRepos.length === 0 ? (
                    <p className="text-center text-sm text-foreground/30 py-12">No repos found</p>
                  ) : (
                    ghRepos.map((repo) => (
                      <button
                        key={repo.id}
                        onClick={() => selectRepo(repo)}
                        className="w-full text-left px-3 py-3 rounded-lg hover:bg-surface-hover transition-colors cursor-pointer flex items-start gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-foreground-strong font-bold truncate">{repo.name}</span>
                            {repo.private && (
                              <span className="text-[9px] text-warning/70 bg-warning-soft px-1.5 py-0.5 rounded-full">private</span>
                            )}
                          </div>
                          {repo.description && (
                            <p className="text-xs text-foreground/40 mt-0.5 truncate">{repo.description}</p>
                          )}
                          <div className="flex items-center gap-3 mt-1">
                            {repo.language && (
                              <span className="text-[10px] text-info/70">{repo.language}</span>
                            )}
                            {repo.stargazers_count > 0 && (
                              <span className="text-[10px] text-foreground/30">⭐ {repo.stargazers_count}</span>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-accent/60 flex-shrink-0 mt-1">select →</span>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}

            {/* Step 2: Folder picker */}
            {selectedRepo && (
              <div className="flex-1 overflow-y-auto p-2">
                {foldersLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <span className="inline-block w-2.5 h-2.5 bg-accent rounded-full animate-pulse" />
                    <span className="ml-3 text-sm text-foreground/40">Loading folders...</span>
                  </div>
                ) : (
                  <>
                    {/* Entire repo option */}
                    <button
                      onClick={() => importFromFolder("")}
                      disabled={importLoading === "__root__"}
                      className="w-full text-left px-3 py-3 rounded-lg hover:bg-surface-hover transition-colors cursor-pointer flex items-center gap-3 disabled:opacity-50 border border-accent/20 bg-accent-soft/30 mb-2"
                    >
                      <span className="text-base">📦</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-accent font-bold">Entire Repository</span>
                        <p className="text-[10px] text-foreground/40 mt-0.5">{totalCodeFiles} code files total</p>
                      </div>
                      <span className="text-xs text-accent/60 flex-shrink-0">
                        {importLoading === "__root__" ? "importing..." : "import →"}
                      </span>
                    </button>

                    {rootFileCount > 0 && (
                      <div className="px-3 py-1.5">
                        <span className="text-[10px] text-foreground/30">{rootFileCount} files in root</span>
                      </div>
                    )}

                    {/* Folder list */}
                    <div className="mt-1">
                      <span className="text-[10px] text-foreground/30 uppercase tracking-wider px-3">Folders</span>
                    </div>
                    {folders.length === 0 ? (
                      <p className="text-center text-xs text-foreground/30 py-6">No subfolders found</p>
                    ) : (
                      folders.map((folder) => (
                        <button
                          key={folder.path}
                          onClick={() => importFromFolder(folder.path)}
                          disabled={importLoading === folder.path}
                          className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-surface-hover transition-colors cursor-pointer flex items-center gap-3 disabled:opacity-50"
                        >
                          <span className="text-foreground/40 text-sm">📁</span>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-foreground-strong truncate">{folder.path}/</span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {folder.codeFileCount > 0 && (
                              <span className="text-[10px] text-foreground/30">{folder.codeFileCount} files</span>
                            )}
                            <span className="text-xs text-accent/60">
                              {importLoading === folder.path ? "importing..." : "import →"}
                            </span>
                          </div>
                        </button>
                      ))
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
