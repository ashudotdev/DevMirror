import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";

// List the authenticated user's repos (paginated, sorted by recent push)
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const page = request.nextUrl.searchParams.get("page") || "1";
  const perPage = request.nextUrl.searchParams.get("per_page") || "30";
  const search = request.nextUrl.searchParams.get("q") || "";

  let url = `https://api.github.com/user/repos?sort=pushed&direction=desc&per_page=${perPage}&page=${page}&type=all`;

  // If there's a search query, use GitHub search API instead
  if (search.trim()) {
    url = `https://api.github.com/search/repositories?q=${encodeURIComponent(search)}+user:${session.login}&sort=updated&per_page=${perPage}&page=${page}`;
  }

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      Accept: "application/vnd.github+json",
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    return Response.json(
      { error: `GitHub API error: ${res.status} ${errText}` },
      { status: res.status }
    );
  }

  const data = await res.json();

  // Normalize response (search API wraps results in items[])
  const repos = search.trim() ? data.items : data;

  // Return only what the frontend needs
  const simplified = repos.map((repo: Record<string, unknown>) => ({
    id: repo.id,
    name: repo.name,
    full_name: repo.full_name,
    description: repo.description,
    language: repo.language,
    stargazers_count: repo.stargazers_count,
    updated_at: repo.updated_at,
    private: repo.private,
    default_branch: repo.default_branch,
  }));

  return Response.json({ repos: simplified });
}
