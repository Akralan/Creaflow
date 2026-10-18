"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useHeroFocus } from "@/components/landing/tellovo/HeroFocus";
import { RepoIcon } from "@/components/landing/tellovo/icons";

export default function HeroForm() {
  const router = useRouter();
  const { fieldRef, inputRef, nudge } = useHeroFocus();
  const [repo, setRepo] = useState("");

  // The repository field is a placeholder for now: the onboarding takes over from here.
  const submit = () => router.push("/onboarding");

  return (
    <div className="hero-form">
      <label className="sr" htmlFor="tv-repo">
        GitHub repository
      </label>
      <div id="tv-field" ref={fieldRef} className={`field${nudge ? (nudge % 2 ? " nudge-a" : " nudge-b") : ""}`}>
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
          onChange={(e) => setRepo(e.target.value)}
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
    </div>
  );
}
