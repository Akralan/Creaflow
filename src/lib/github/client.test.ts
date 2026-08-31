import { beforeEach, describe, expect, it, vi } from "vitest";
import { exchangeCode, fetchViewer, listPublicRepos, fetchTree, listCommits, GithubRateLimitError } from "./client";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  process.env.GITHUB_CLIENT_ID = "test-client-id";
  process.env.GITHUB_CLIENT_SECRET = "test-client-secret";
  process.env.GITHUB_OAUTH_REDIRECT_URI = "http://localhost:3000/api/auth/github/callback";
});

function jsonOk(body: unknown) {
  return { ok: true, status: 200, headers: new Headers(), json: async () => body, text: async () => "" };
}

describe("exchangeCode", () => {
  it("échange le code contre un access token et renvoie le scope accordé", async () => {
    fetchMock.mockResolvedValue(jsonOk({ access_token: "gho_x", scope: "read:user,user:email" }));

    const result = await exchangeCode("auth-code");

    expect(result.accessToken).toBe("gho_x");
    expect(result.scope).toBe("read:user,user:email");
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://github.com/login/oauth/access_token");
    expect(options.headers.Accept).toBe("application/json");
  });

  it("lève une erreur explicite quand GitHub renvoie une erreur au lieu d'un token", async () => {
    // GitHub répond 200 sur un code invalide : sans garde, on stockerait `undefined` comme token.
    fetchMock.mockResolvedValue(jsonOk({ error: "bad_verification_code" }));
    await expect(exchangeCode("stale")).rejects.toThrow("bad_verification_code");
  });
});

describe("fetchViewer", () => {
  it("ne renvoie l'email que s'il est primaire ET vérifié", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonOk({ id: 42, login: "alix", name: "Alix", bio: "dev", avatar_url: "http://a" }))
      .mockResolvedValueOnce(
        jsonOk([
          { email: "old@example.com", primary: false, verified: true },
          { email: "alix@example.com", primary: true, verified: true },
        ])
      );

    const viewer = await fetchViewer("tok");

    expect(viewer.githubUserId).toBe("42");
    expect(viewer.login).toBe("alix");
    expect(viewer.email).toBe("alix@example.com");
  });

  it("renvoie email null quand l'email primaire n'est pas vérifié", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonOk({ id: 42, login: "alix", name: null, bio: null, avatar_url: null }))
      .mockResolvedValueOnce(jsonOk([{ email: "alix@example.com", primary: true, verified: false }]));

    const viewer = await fetchViewer("tok");

    expect(viewer.email).toBeNull();
  });
});

describe("listPublicRepos", () => {
  it("demande explicitement les dépôts publics dont l'utilisateur est propriétaire, triés par push", async () => {
    fetchMock.mockResolvedValue(
      jsonOk([
        {
          id: 7,
          full_name: "alix/creaflow",
          name: "creaflow",
          description: "un truc",
          default_branch: "main",
          language: "TypeScript",
          pushed_at: "2026-08-30T10:00:00Z",
        },
      ])
    );

    const repos = await listPublicRepos("tok");

    expect(repos).toEqual([
      {
        externalId: "7",
        fullName: "alix/creaflow",
        name: "creaflow",
        description: "un truc",
        defaultBranch: "main",
        language: "TypeScript",
        pushedAt: "2026-08-30T10:00:00Z",
      },
    ]);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("visibility=public");
    expect(url).toContain("affiliation=owner");
    expect(url).toContain("sort=pushed");
  });
});

describe("fetchTree", () => {
  it("remonte les entrées et le drapeau truncated", async () => {
    fetchMock.mockResolvedValue(
      jsonOk({ truncated: true, tree: [{ path: "README.md", type: "blob", sha: "abc", size: 120 }] })
    );

    const result = await fetchTree("tok", "alix/creaflow", "main");

    expect(result.truncated).toBe(true);
    expect(result.entries[0].path).toBe("README.md");
    expect(fetchMock.mock.calls[0][0]).toContain("recursive=1");
  });
});

describe("listCommits", () => {
  it("aplatit la forme imbriquée de l'API en { sha, message, authorName, date }", async () => {
    fetchMock.mockResolvedValue(
      jsonOk([
        {
          sha: "deadbeef",
          commit: { message: "feat: un truc\n\nParce que.", author: { name: "Alix", date: "2026-08-29T09:00:00Z" } },
        },
      ])
    );

    const commits = await listCommits("tok", "alix/creaflow", "main");

    expect(commits).toEqual([
      { sha: "deadbeef", message: "feat: un truc\n\nParce que.", authorName: "Alix", date: "2026-08-29T09:00:00Z" },
    ]);
  });
});

describe("quota", () => {
  it("traduit un 403 avec x-ratelimit-remaining à 0 en GithubRateLimitError daté", async () => {
    const reset = Math.floor(Date.now() / 1000) + 600; // dans 10 minutes
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      headers: new Headers({ "x-ratelimit-remaining": "0", "x-ratelimit-reset": String(reset) }),
      json: async () => ({}),
      text: async () => "rate limited",
    });

    await expect(listPublicRepos("tok")).rejects.toBeInstanceOf(GithubRateLimitError);
  });

  it("laisse passer un 403 ordinaire comme erreur générique", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      headers: new Headers({ "x-ratelimit-remaining": "4999" }),
      json: async () => ({}),
      text: async () => "forbidden",
    });

    await expect(listPublicRepos("tok")).rejects.not.toBeInstanceOf(GithubRateLimitError);
  });
});
