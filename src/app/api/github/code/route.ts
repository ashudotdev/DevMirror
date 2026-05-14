import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";

// ─── Config ─────────────────────────────────────────────────────────

// Code file extensions we want to fetch
const CODE_EXTENSIONS = new Set([
  // JS/TS
  ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs",
  // Python
  ".py", ".pyw",
  // Java / Kotlin
  ".java", ".kt", ".kts",
  // C-family
  ".c", ".h", ".cpp", ".hpp", ".cc", ".cxx",
  // C#
  ".cs",
  // Go
  ".go",
  // Rust
  ".rs",
  // Ruby
  ".rb",
  // PHP
  ".php",
  // Swift
  ".swift",
  // Dart
  ".dart",
  // Lua
  ".lua",
  // Shell
  ".sh", ".bash", ".zsh",
  // Config-as-code
  ".vue", ".svelte", ".astro",
  // SQL
  ".sql",
  // Scala
  ".scala",
  // Elixir / Erlang
  ".ex", ".exs", ".erl",
  // R
  ".r", ".R",
]);

// Directories to skip
const SKIP_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".next", "__pycache__",
  "vendor", ".gradle", "target", "bin", "obj", ".idea", ".vscode",
  "coverage", ".cache", ".turbo",
]);

// Max total characters to collect (keep under Gemini's context window)
const MAX_TOTAL_CHARS = 80_000;
// Max files to include
const MAX_FILES = 40;

// ─── Types ──────────────────────────────────────────────────────────

interface TreeItem {
  path: string;
  type: string;
  size?: number;
  sha: string;
}

// ─── Route ──────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const owner = request.nextUrl.searchParams.get("owner");
  const repo = request.nextUrl.searchParams.get("repo");
  const branch = request.nextUrl.searchParams.get("branch") || "main";
  const rootPath = request.nextUrl.searchParams.get("rootPath") || "";

  if (!owner || !repo) {
    return Response.json({ error: "owner and repo are required" }, { status: 400 });
  }

  try {
    // 1. Get the repo tree (recursive)
    const treeRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
      {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          Accept: "application/vnd.github+json",
        },
      }
    );

    if (!treeRes.ok) {
      const errText = await treeRes.text();
      return Response.json(
        { error: `Failed to fetch repo tree: ${treeRes.status} ${errText}` },
        { status: treeRes.status }
      );
    }

    const treeData = await treeRes.json();
    const tree: TreeItem[] = treeData.tree || [];

    // 2. Filter to code files only
    const codeFiles = tree.filter((item) => {
      if (item.type !== "blob") return false;

      // If rootPath is set, only include files under that path
      if (rootPath && !item.path.startsWith(rootPath + "/")) return false;

      // Skip files in excluded directories
      const parts = item.path.split("/");
      for (const part of parts.slice(0, -1)) {
        if (SKIP_DIRS.has(part)) return false;
      }

      // Check extension
      const ext = "." + item.path.split(".").pop()?.toLowerCase();
      if (!CODE_EXTENSIONS.has(ext)) return false;

      // Skip very large files (> 100KB)
      if (item.size && item.size > 100_000) return false;

      return true;
    });

    // 3. Sort by path (so output is predictable) and limit
    codeFiles.sort((a, b) => a.path.localeCompare(b.path));
    const filesToFetch = codeFiles.slice(0, MAX_FILES);

    // 4. Fetch file contents in parallel (batched)
    let totalChars = 0;
    const fileContents: { path: string; content: string }[] = [];

    // Fetch in batches of 10 to avoid hammering GitHub
    for (let i = 0; i < filesToFetch.length; i += 10) {
      if (totalChars >= MAX_TOTAL_CHARS) break;

      const batch = filesToFetch.slice(i, i + 10);
      const results = await Promise.all(
        batch.map(async (file) => {
          try {
            const res = await fetch(
              `https://api.github.com/repos/${owner}/${repo}/contents/${file.path}?ref=${branch}`,
              {
                headers: {
                  Authorization: `Bearer ${session.accessToken}`,
                  Accept: "application/vnd.github.raw+json",
                },
              }
            );
            if (!res.ok) return null;
            const text = await res.text();
            return { path: file.path, content: text };
          } catch {
            return null;
          }
        })
      );

      for (const r of results) {
        if (!r) continue;
        if (totalChars + r.content.length > MAX_TOTAL_CHARS) break;
        fileContents.push(r);
        totalChars += r.content.length;
      }
    }

    // 5. Format into a single string the user can send to analyze
    const combined = fileContents
      .map((f) => `// ── ${f.path} ──\n${f.content}`)
      .join("\n\n");

    return Response.json({
      fileCount: fileContents.length,
      totalFiles: codeFiles.length,
      totalChars,
      truncated: codeFiles.length > fileContents.length || totalChars >= MAX_TOTAL_CHARS,
      files: fileContents.map((f) => f.path),
      code: combined,
    });
  } catch (err) {
    console.error("[DevMirror] Repo code fetch error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to fetch repo code" },
      { status: 500 }
    );
  }
}
