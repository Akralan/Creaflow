"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useHeroFocus } from "@/components/landing/tellovo/HeroFocus";
import { RepoIcon } from "@/components/landing/tellovo/icons";
import { parseRepoUrl } from "@/lib/github/repoUrl";

export default function HeroForm() {
  const router = useRouter();
  const { fieldRef, inputRef, nudge } = useHeroFocus();
  const [repo, setRepo] = useState("");

  const [error, setError] = useState("");

  // The link goes to /start, which reads the repository (docs/SPEC_ENTREE_PAR_LE_REPO.md §2).
  const submit = () => {
    const parsed = parseRepoUrl(repo);
    if (!parsed) {
      setError("Paste the link of a public GitHub repo, like github.com/you/your-saas.");
      inputRef.current?.focus();
      return;
    }
    router.push(`/start?repo=${encodeURIComponent(parsed.fullName)}`);
  };

  return (
    <div className="hero-form">
      <label className="sr" htmlFor="tv-repo">
        GitHub repository
      </label>
      <div
        id="tv-field"
        ref={fieldRef}
        className={`field${nudge ? (nudge % 2 ? " nudge-a" : " nudge-b") : ""}`}
      >
        <RepoIcon className="ico" aria-hidden="true" />
        <input
          id="tv-repo"
          ref={inputRef}
          type="text"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="github.com/you/your-saas"
          value={repo}
          onChange={(e) => {
            setRepo(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          enterKeyHint="go"
        />
        <button className="btn btn-ink" type="button" onClick={submit}>
          Generate my week <span className="arr">→</span>
        </button>
      </div>
      {error && (
        <p role="alert" style={{ color: "#b3261e", fontSize: 14, marginTop: 10 }}>
          {error}
        </p>
      )}
    </div>
  );
}
