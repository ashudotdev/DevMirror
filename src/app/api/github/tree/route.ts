import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";

// Returns the directory structure of a repo (folders only, one level deep from a given path)
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const owner = request.nextUrl.searchParams.get("owner");
  const repo = request.nextUrl.searchParams.get("repo");
  const branch = request.nextUrl.searchParams.get("branch") || "main";

  if (!owner || !repo) {
    return Response.json({ error: "owner and repo are required" }, { status: 400 });
  }

  try {
    // Get the full recursive tree
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
        { error: `Failed to fetch tree: ${treeRes.status} ${errText}` },
        { status: treeRes.status }
      );
    }

    const treeData = await treeRes.json();
    const items: { path: string; type: string }[] = treeData.tree || [];

    // Extract unique directories (only "tree" type entries)
    const SKIP = new Set([
      "node_modules", ".git", "dist", "build", ".next", "__pycache__",
      "vendor", ".gradle", "target", "bin", "obj", ".idea", ".vscode",
      "coverage", ".cache", ".turbo",
    ]);

    const folders = items
      .filter((item) => {
        if (item.type !== "tree") return false;
        // Skip hidden/build dirs
        const parts = item.path.split("/");
        for (const part of parts) {
          if (SKIP.has(part)) return false;
        }
        return true;
      })
      .map((item) => item.path)
      .sort();

    // Count code files per folder (for display)
    const CODE_EXT = new Set([
      ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".py", ".java",
      ".kt", ".c", ".h", ".cpp", ".cs", ".go", ".rs", ".rb", ".php",
      ".swift", ".dart", ".lua", ".sh", ".vue", ".svelte", ".astro",
      ".scala", ".ex", ".sql",
    ]);

    const codeFiles = items.filter((item) => {
      if (item.type !== "blob") return false;
      const ext = "." + item.path.split(".").pop()?.toLowerCase();
      return CODE_EXT.has(ext);
    });

    // Build folder info with file counts
    const folderInfo = folders.map((folder) => {
      const count = codeFiles.filter((f) => f.path.startsWith(folder + "/")).length;
      return { path: folder, codeFileCount: count };
    });

    // Also count root-level code files (not in any subfolder)
    const rootFileCount = codeFiles.filter((f) => !f.path.includes("/")).length;

    return Response.json({
      folders: folderInfo,
      totalCodeFiles: codeFiles.length,
      rootFileCount,
    });
  } catch (err) {
    console.error("[DevMirror] Tree fetch error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to fetch tree" },
      { status: 500 }
    );
  }
}
