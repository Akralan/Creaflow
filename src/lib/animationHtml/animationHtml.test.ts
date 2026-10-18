import { describe, expect, it } from "vitest";
import { buildPlayerDocument, PLAYER_CSP } from "./player";
import { MAX_ANIMATION_HTML_BYTES, verifyAnimationHtml } from "./verify";

const GOOD = `<style>
#scene{position:absolute;inset:0;background:#0b1020}
.bar{position:absolute;left:100px;top:900px;height:60px;width:0;background:#31d0aa;animation:grow 1.2s cubic-bezier(.16,1,.3,1) 300ms both}
@keyframes grow{to{width:800px}}
</style>
<div id="scene"><div class="bar"></div>
<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><defs><linearGradient id="g"/></defs><circle cx="50" cy="50" r="40" fill="url(#g)"/></svg></div>`;

describe("verifyAnimationHtml", () => {
  it("accepts CSS keyframes, inline SVG (namespace and #fragment included) and nothing external", () => {
    const report = verifyAnimationHtml(GOOD);
    expect(report.issues).toEqual([]);
    expect(report.ok).toBe(true);
    expect(report.hasMotion).toBe(true);
  });

  it("accepts a seek function and Web Animations as motion", () => {
    expect(verifyAnimationHtml(`<div id="n"></div><script>window.seek=function(ms){document.getElementById('n').textContent=Math.round(ms)}</script>`).ok).toBe(true);
    expect(verifyAnimationHtml(`<div id="a"></div><script>document.getElementById('a').animate([{opacity:0},{opacity:1}],{duration:500,fill:'both'})</script>`).ok).toBe(true);
  });

  it("refuses a page where nothing moves", () => {
    const report = verifyAnimationHtml(`<div style="width:10px">static</div>`);
    expect(report.ok).toBe(false);
    expect(report.issues.join(" ")).toMatch(/nothing moves/);
  });

  it("refuses anything that reaches the network or the outside", () => {
    expect(verifyAnimationHtml(`${GOOD}<img src="https://evil.example/x.png">`).issues.join(" ")).toMatch(/external/);
    expect(verifyAnimationHtml(`${GOOD}<style>@import url(https://fonts.example/a.css);</style>`).issues.join(" ")).toMatch(/external/);
    expect(verifyAnimationHtml(`${GOOD}<div style="background:url(//cdn.example/a.png)"></div>`).issues.join(" ")).toMatch(/external/);
    expect(verifyAnimationHtml(`${GOOD}<script>fetch('/api/x')</script>`).issues.join(" ")).toMatch(/fetch/);
    expect(verifyAnimationHtml(`${GOOD}<script>window.parent.postMessage('x','*')</script>`).issues.join(" ")).toMatch(/parent/);
    expect(verifyAnimationHtml(`${GOOD}<script>document.cookie</script>`).issues.join(" ")).toMatch(/cookies/);
  });

  it("refuses forbidden tags, script src and inline handlers", () => {
    expect(verifyAnimationHtml(`${GOOD}<iframe></iframe>`).issues.join(" ")).toMatch(/<iframe>/);
    expect(verifyAnimationHtml(`${GOOD}<meta http-equiv="refresh" content="0">`).issues.join(" ")).toMatch(/<meta>/);
    expect(verifyAnimationHtml(`${GOOD}<script src="x.js"></script>`).issues.join(" ")).toMatch(/script src/);
    expect(verifyAnimationHtml(`${GOOD}<div onclick="go()"></div>`).issues.join(" ")).toMatch(/handlers/);
  });

  it("refuses what breaks the time contract", () => {
    for (const code of ["setTimeout(()=>{},10)", "setInterval(f,10)", "requestAnimationFrame(f)", "Math.random()", "new Date()", "performance.now()"]) {
      const report = verifyAnimationHtml(`${GOOD}<script>${code}</script>`);
      expect(report.ok, code).toBe(false);
    }
  });

  it("refuses a page that is too big, and an empty one", () => {
    expect(verifyAnimationHtml(`${GOOD}<!--${"x".repeat(MAX_ANIMATION_HTML_BYTES)}-->`).issues.join(" ")).toMatch(/KB/);
    expect(verifyAnimationHtml("   ").issues.join(" ")).toMatch(/empty/);
  });
});

describe("buildPlayerDocument", () => {
  const doc = buildPlayerDocument(`${GOOD}<img src="{{IMG:p1}}">`, { width: 1080, height: 1920, durationMs: 8000, images: { p1: "data:image/png;base64,AAAA" }, fonts: [{ family: "Inter", dataUri: "data:font/woff2;base64,BBBB" }] });

  it("puts the security policy before anything the model wrote", () => {
    expect(doc.indexOf(PLAYER_CSP)).toBeGreaterThan(-1);
    expect(doc.indexOf("Content-Security-Policy")).toBeLessThan(doc.indexOf('id="stage"'));
    expect(PLAYER_CSP).toContain("default-src 'none'");
    expect(PLAYER_CSP).not.toMatch(/https?:/);
  });

  it("sizes the stage, inlines photos and fonts, and ends with the player", () => {
    expect(doc).toContain("width:1080px;height:1920px");
    expect(doc).toContain('src="data:image/png;base64,AAAA"');
    expect(doc).not.toContain("{{IMG:p1}}");
    expect(doc).toContain("@font-face{font-family:'Inter'");
    expect(doc).toContain("window.__player=");
    expect(doc).toContain("var D=8000");
    expect(doc.indexOf("window.__player=")).toBeGreaterThan(doc.indexOf(GOOD.slice(0, 30)));
  });
});

describe("the player runtime", () => {
  it("is valid JavaScript (a syntax slip would silently disable the whole player)", () => {
    const doc = buildPlayerDocument("<div></div>", { width: 100, height: 100, durationMs: 5000 });
    const script = doc.slice(doc.lastIndexOf("<script>") + 8, doc.lastIndexOf("</script>"));
    expect(() => new Function(script)).not.toThrow();
    expect(script).toContain("__player.probe");
  });
});
