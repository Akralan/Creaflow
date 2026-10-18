/**
 * Outils du banc d'essai de l'animation (docs/SPEC_ANIMATION_HTML_LIBRE.md) : un navigateur qui joue la page dans un
 * iframe enfermé et la regarde (troisième couche du contrôle), une planche d'images et une page de démonstration.
 * Partagé par scripts/animation-bench.ts et scripts/mykine-animations.ts.
 */
import { chromium, type Browser, type Frame, type Page } from "playwright-core";
import type { RenderOutcome } from "@/lib/llm/animationHtml";
import { PLAYER_IFRAME_SANDBOX } from "@/lib/animationHtml/player";
import { foreignNumbers } from "@/lib/animationHtml/numbers";

export const WIDTH = 1080;
export const HEIGHT = 1920;
export const DURATION_MS = 8000;
export const SCALE = 0.5;
// Instants of the frames kept for the review and the sheet.
const FRAME_TIMES = [0, 500, 1800, 3500, 5500, 7900];
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";

/** Page hôte : l'animation dans un iframe enfermé, mise à l'échelle pour tenir dans le navigateur. */
export function hostPage(doc: string, scale: number): string {
  const srcdoc = doc.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  return `<!doctype html><html><body style="margin:0;background:#222">
<iframe id="f" sandbox="${PLAYER_IFRAME_SANDBOX}" srcdoc="${srcdoc}" style="width:${WIDTH}px;height:${HEIGHT}px;border:0;transform:scale(${scale});transform-origin:0 0;display:block"></iframe>
</body></html>`;
}


export class Bench {
  private constructor(
    private browser: Browser,
    private page: Page,
    private util: Page
  ) {}

  static async open(): Promise<Bench> {
    const browser = await chromium.launch({ executablePath: CHROME, headless: true });
    const scale = SCALE;
    const page = await browser.newPage({ viewport: { width: Math.round(WIDTH * scale), height: Math.round(HEIGHT * scale) } });
    const util = await browser.newPage();
    await util.setContent("<canvas id=c></canvas>");
    return new Bench(browser, page, util);
  }

  async close() {
    await this.browser.close();
  }

  private frame(): Frame {
    const f = this.page.frames().find((fr) => fr !== this.page.mainFrame());
    if (!f) throw new Error("iframe not found");
    return f;
  }

  async load(doc: string) {
    await this.page.setContent(hostPage(doc, SCALE));
    await this.page.waitForTimeout(600);
  }

  async info() {
    return this.frame().evaluate(() => (window as unknown as { __player: { info: () => { animations: number; finite: number; infinite: number; maxEndMs: number; hasSeek: boolean; errors: string[] } } }).__player.info());
  }

  async shot(ms: number): Promise<Buffer> {
    await this.frame().evaluate((t) => (window as unknown as { __player: { seek: (t: number) => void } }).__player.seek(t), ms);
    await this.page.waitForTimeout(120);
    return this.page.screenshot();
  }

  /** Part des pixels qui diffèrent entre deux images, et nombre de couleurs distinctes de la première. */
  async compare(a: Buffer, b: Buffer): Promise<{ diff: number; colors: number; content: number }> {
    // Written as a string: tsx would wrap the functions of a closure with a helper the page does not have.
    const source = `(async function(x, y){
      function load(b64){ return new Promise(function(resolve){ var img = new Image(); img.onload = function(){ resolve(img); }; img.src = 'data:image/png;base64,' + b64; }); }
      var ims = await Promise.all([load(x), load(y)]);
      var c = document.getElementById('c');
      c.width = ims[0].width; c.height = ims[0].height;
      var ctx = c.getContext('2d');
      ctx.drawImage(ims[0], 0, 0);
      var da = ctx.getImageData(0, 0, c.width, c.height).data;
      ctx.drawImage(ims[1], 0, 0);
      var db = ctx.getImageData(0, 0, c.width, c.height).data;
      var changed = 0, seen = {}, n = 0, top = 0;
      for (var i = 0; i < da.length; i += 4) {
        if (Math.abs(da[i]-db[i]) + Math.abs(da[i+1]-db[i+1]) + Math.abs(da[i+2]-db[i+2]) > 24) changed++;
        var k = ((da[i] >> 4) << 8) | ((da[i+1] >> 4) << 4) | (da[i+2] >> 4);
        if (!seen[k]) { seen[k] = 0; n++; }
        seen[k]++; if (seen[k] > top) top = seen[k];
      }
      return { diff: changed / (da.length / 4), colors: n, content: 1 - top / (da.length / 4) };
    })(${JSON.stringify(a.toString("base64"))}, ${JSON.stringify(b.toString("base64"))})`;
    return this.util.evaluate(source) as Promise<{ diff: number; colors: number; content: number }>;
  }

  /** Troisième couche du contrôle : on joue la page, on la regarde, et on garde des images pour la revue du modèle. */
  async render(doc: string, postText: string): Promise<RenderOutcome> {
    const issues: string[] = [];
    await this.load(doc);
    const info = await this.info();
    if (info.errors.length > 0) issues.push(`script error: ${info.errors.slice(0, 2).join(" | ")}`);
    if (info.animations === 0 && !info.hasSeek) issues.push("no animation was found when the page was played");
    if (info.maxEndMs > DURATION_MS + 300) issues.push(`an animation ends at ${Math.round(info.maxEndMs)} ms, after the ${DURATION_MS} ms duration: shorten it`);
    const times = FRAME_TIMES;
    const shots: Buffer[] = [];
    let screenText = "";
    for (const t of times) {
      shots.push(await this.shot(t));
      screenText += `\n${await this.frame().evaluate(() => (document.getElementById("stage") as HTMLElement).innerText)}`;
    }
    // Layout, looked at by the page itself every 800 ms (the same probe the application runs in the iframe).
    const probeTimes = Array.from({ length: Math.floor(DURATION_MS / 800) }, (_, i) => i * 800);
    const probed = (await this.frame().evaluate(`window.__player.probe(${JSON.stringify(probeTimes)})`)) as { issues: string[] };
    for (const f of probed.issues) if (issues.length < 6) issues.push(f);
    const invented = foreignNumbers(screenText, postText);
    if (invented.length > 0) issues.push(`the screen shows the number ${invented.join(", ")}, which the post does not state: show only figures copied from the post`);
    const first = shots[0];
    const nearEnd = await this.shot(DURATION_MS - 1500);
    const end = shots[shots.length - 1];
    const start = await this.compare(first, first);
    if (start.colors < 4) issues.push("the first frame is empty (a single flat color): the subject must be visible at 0 ms");
    else if (start.content < 0.01) issues.push("the first frame is almost empty: the main subject must already be drawn and visible at 0 ms");
    let moved = 0;
    for (const other of [...shots.slice(1), nearEnd]) moved = Math.max(moved, (await this.compare(first, other)).diff);
    if (moved < 0.002) issues.push("nothing visibly changes over the animation: something must move, grow, draw or count");
    const hold = await this.compare(nearEnd, end);
    if (hold.diff > 0.03 && info.infinite === 0) issues.push("the end is not held: the last 1.5 seconds must stay still on the key message");
    return { issues, times: [...times], frames: shots.map((b) => `data:image/png;base64,${b.toString("base64")}`) };
  }

  async sheet(outcome: RenderOutcome, outFile: string) {
    const w = Math.round(WIDTH * SCALE * 0.8);
    const h = Math.round(HEIGHT * SCALE * 0.8);
    const page = await this.browser.newPage({ viewport: { width: w * outcome.frames.length + 20 * (outcome.frames.length + 1), height: h + 70 } });
    await page.setContent(
      `<body style="margin:0;background:#111;font:14px system-ui;color:#bbb;padding:20px"><div style="display:flex;gap:20px">${outcome.frames
        .map((s, i) => `<div><img src="${s}" style="width:${w}px;height:${h}px;display:block"><div style="margin-top:6px">${(outcome.times[i] / 1000).toFixed(1)} s</div></div>`)
        .join("")}</div></body>`
    );
    await page.screenshot({ path: outFile });
    await page.close();
  }
}

export function demoPage(doc: string, title: string): string {
  const srcdoc = doc.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>html,body{margin:0;height:100%;background:#16161a;display:grid;place-items:center;font:13px system-ui;color:#9a9aa5}
#wrap{height:min(94vh,calc(94vw*16/9));aspect-ratio:9/16;position:relative}
iframe{width:${WIDTH}px;height:${HEIGHT}px;border:0;transform-origin:0 0;position:absolute;left:0;top:0}
p{position:fixed;bottom:6px;margin:0}</style></head>
<body><div id="wrap"><iframe id="f" sandbox="${PLAYER_IFRAME_SANDBOX}" srcdoc="${srcdoc}"></iframe></div><p>${title} — lecture en boucle (iframe enfermé)</p>
<script>
const wrap=document.getElementById('wrap'),f=document.getElementById('f');
function fit(){const s=wrap.clientWidth/${WIDTH};f.style.transform='scale('+s+')'}
addEventListener('resize',fit);fit();
f.addEventListener('load',()=>{try{f.contentWindow.__player.play()}catch(e){}});
</script></body></html>`;
}

