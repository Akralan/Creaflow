import { describe, expect, it } from "vitest";
import { parseRepoUrl } from "./repoUrl";

describe("parseRepoUrl", () => {
  it.each([
    ["github.com/akralan/creaflow", "akralan/creaflow"],
    ["https://github.com/akralan/creaflow", "akralan/creaflow"],
    ["https://www.github.com/akralan/creaflow.git", "akralan/creaflow"],
    ["github.com/akralan/creaflow/tree/main/src", "akralan/creaflow"],
    ["  akralan/creaflow ", "akralan/creaflow"],
    ["github.com/a/b?tab=readme", "a/b"],
  ])("lit %s", (input, expected) => {
    expect(parseRepoUrl(input)?.fullName).toBe(expected);
  });

  it.each(["", "github.com", "github.com/akralan", "gitlab.com/a/b", "https://example.com/a/b", "a b/c", "-bad/repo", "a/b c"])(
    "refuse %j",
    (input) => {
      expect(parseRepoUrl(input)).toBeNull();
    }
  );
});
