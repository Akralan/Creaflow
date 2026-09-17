import { describe, expect, it } from "vitest";
import { DesignValidationError, MAX_LAYERS_PER_SLIDE, parseStyle, sanitizeSlideHtml, slidePlainText } from "./htmlSanitizer";
import { resolveDesignFont, toRenderableFontFamily } from "./fonts";
import { defaultFormatForPlatform, DESIGN_FORMATS } from "./formats";

const opts = { width: 1080, height: 1350, hasLogo: false };

const validSlide = `
<div style="position:relative;width:1080px;height:1350px;overflow:hidden;background:#111">
  <div data-layer="bg" data-type="image" style="position:absolute;top:0;left:0;width:1080px;height:1350px">
    <img src="{{BASE_IMAGE}}" alt="" style="width:100%;height:100%;object-fit:cover">
  </div>
  <div data-layer="title" data-type="text" style="position:absolute;top:80px;left:60px;width:960px;font-family:'Playfair Display', serif;font-size:72px;color:#fff">
    Une bougie, <strong>trois</strong> soirs
  </div>
</div>`;

function issuesOf(fn: () => unknown): string[] {
  try {
    fn();
  } catch (err) {
    if (err instanceof DesignValidationError) return err.issues;
    throw err;
  }
  return [];
}

describe("sanitizeSlideHtml — HTML valide", () => {
  it("normalise une slide correcte sans la refuser", () => {
    const result = sanitizeSlideHtml(validSlide, opts);
    expect(result.layerCount).toBe(2);
    expect(result.usesBaseImage).toBe(true);
    expect(result.html.startsWith('<div style="position:relative;width:1080px;height:1350px;overflow:hidden;background:#111">')).toBe(true);
    expect(result.html).toContain('<div data-layer="bg" data-type="image" style="position:absolute;');
    expect(result.html).toContain("font-family:Playfair Display;");
    expect(result.html).toContain("<strong>trois</strong>");
  });

  it("impose la taille du canevas sur la racine et position:absolute sur les calques", () => {
    const html = `<div style="width:10px;height:10px;transform:scale(2)"><p style="position:static;top:4px">Salut</p></div>`;
    const { html: out } = sanitizeSlideHtml(html, { ...opts, width: 500, height: 400 });
    expect(out).toContain("width:500px;height:400px;overflow:hidden");
    expect(out).not.toContain("transform:scale(2)");
    expect(out).toContain('<p data-layer="l1" data-type="text" style="position:absolute;top:4px">Salut</p>');
  });

  it("attribue des identifiants uniques et devine le type des calques", () => {
    const html = `<div><div data-layer="a">Texte</div><div data-layer="a"><img src="{{BASE_IMAGE}}"></div><div style="background:#f00;width:10px;height:10px"></div></div>`;
    const { html: out } = sanitizeSlideHtml(html, opts);
    expect(out).toContain('data-layer="a" data-type="text"');
    expect(out).toContain('data-layer="l2" data-type="image"');
    expect(out).toContain('data-layer="l3" data-type="shape"');
  });

  it("est idempotent : resanitiser la sortie ne change rien", () => {
    const once = sanitizeSlideHtml(validSlide, opts).html;
    const twice = sanitizeSlideHtml(once, opts).html;
    expect(twice).toBe(once);
  });

  it("encode le texte et décode les entités", () => {
    const { html } = sanitizeSlideHtml(`<div><div>Tom &amp; Jerry &lt;3 &#233;t&eacute;</div></div>`, opts);
    expect(html).toContain("Tom &amp; Jerry &lt;3 été");
  });
});

describe("sanitizeSlideHtml — refus", () => {
  it("refuse les balises hors liste, y compris script et iframe", () => {
    expect(issuesOf(() => sanitizeSlideHtml(`<div><script>alert(1)</script><div>ok</div></div>`, opts))).toEqual(
      expect.arrayContaining([expect.stringContaining("balise <script> interdite")])
    );
    expect(issuesOf(() => sanitizeSlideHtml(`<div><iframe src="x"></iframe></div>`, opts))).toEqual(
      expect.arrayContaining([expect.stringContaining("balise <iframe> interdite")])
    );
  });

  it("refuse les attributs d'événement et les src externes", () => {
    const issues = issuesOf(() => sanitizeSlideHtml(`<div><div onclick="x()"><img src="https://evil/x.png"></div></div>`, opts));
    expect(issues).toEqual(
      expect.arrayContaining([expect.stringContaining("attribut « onclick » interdit"), expect.stringContaining("src d'image interdit")])
    );
  });

  it("refuse url(), expression() et les propriétés hors liste", () => {
    const issues = issuesOf(() =>
      sanitizeSlideHtml(`<div><div style="background:url(http://x/y.png);cursor:pointer;width:expression(1)">a</div></div>`, opts)
    );
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining("valeur interdite pour « background »"),
        expect.stringContaining("propriété « cursor » interdite"),
        expect.stringContaining("valeur interdite pour « width »"),
      ])
    );
  });

  it("refuse une police hors liste et le logo quand il n'y en a pas", () => {
    const issues = issuesOf(() =>
      sanitizeSlideHtml(`<div><div style="font-family:Comic Sans">a</div><div><img src="{{LOGO}}"></div></div>`, opts)
    );
    expect(issues).toEqual(expect.arrayContaining([expect.stringContaining("police « Comic Sans » hors liste"), expect.stringContaining("{{LOGO}}")]));
    expect(() => sanitizeSlideHtml(`<div><div><img src="{{LOGO}}"></div></div>`, { ...opts, hasLogo: true })).not.toThrow();
  });

  it("refuse plusieurs racines, une racine non-div, et le texte nu sous la racine", () => {
    expect(issuesOf(() => sanitizeSlideHtml(`<div></div><div></div>`, opts))).toEqual(expect.arrayContaining([expect.stringContaining("un seul élément racine")]));
    expect(issuesOf(() => sanitizeSlideHtml(`<p></p>`, opts))).toEqual(expect.arrayContaining([expect.stringContaining("la racine doit être un <div>")]));
    expect(issuesOf(() => sanitizeSlideHtml(`<div>texte<div>a</div></div>`, opts))).toEqual(expect.arrayContaining([expect.stringContaining("texte nu sous la racine")]));
  });

  it("refuse au-delà du plafond de calques", () => {
    const layers = Array.from({ length: MAX_LAYERS_PER_SLIDE + 1 }, (_, i) => `<div>${i}</div>`).join("");
    expect(issuesOf(() => sanitizeSlideHtml(`<div>${layers}</div>`, opts))).toEqual(expect.arrayContaining([expect.stringContaining("calques, 12 maximum")]));
  });

  it("refuse un HTML mal formé", () => {
    expect(issuesOf(() => sanitizeSlideHtml(`<div><div>a</span></div>`, opts)).length).toBeGreaterThan(0);
    expect(issuesOf(() => sanitizeSlideHtml(`<div><div>a`, opts))).toEqual(expect.arrayContaining([expect.stringContaining("jamais fermé")]));
  });

  it("refuse un HTML trop volumineux", () => {
    const big = `<div><div>${"a".repeat(30 * 1024)}</div></div>`;
    expect(issuesOf(() => sanitizeSlideHtml(big, opts))).toEqual(expect.arrayContaining([expect.stringContaining("trop volumineux")]));
  });
});

describe("parseStyle", () => {
  it("respecte les parenthèses dans les valeurs et normalise la police", () => {
    const issues: string[] = [];
    const style = parseStyle("background-image: linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,.8)); font-family: \"inter\", sans-serif", issues, "t");
    expect(issues).toEqual([]);
    expect(style["background-image"]).toBe("linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,.8))");
    expect(style["font-family"]).toBe("Inter");
  });
});

describe("polices et formats", () => {
  it("résout une police connue quelle que soit la casse", () => {
    expect(resolveDesignFont("'JETBRAINS MONO', monospace")?.name).toBe("JetBrains Mono");
    expect(resolveDesignFont("Arial")).toBeNull();
    expect(toRenderableFontFamily("Inter")).toBe("var(--font-design-inter), system-ui, sans-serif");
  });

  it("choisit un format par plateforme", () => {
    expect(defaultFormatForPlatform("tiktok")).toBe("story");
    expect(defaultFormatForPlatform("instagram")).toBe("portrait");
    expect(defaultFormatForPlatform("newsletter")).toBe("square");
    expect(DESIGN_FORMATS.portrait).toMatchObject({ width: 1080, height: 1350 });
  });
});

describe("slidePlainText", () => {
  it("extrait le texte visible", () => {
    expect(slidePlainText(sanitizeSlideHtml(validSlide, opts).html)).toBe("Une bougie, trois soirs");
  });
});
