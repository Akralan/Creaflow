/**
 * The document around a free HTML animation (docs/SPEC_ANIMATION_HTML_LIBRE.md §2). The model writes the inside of
 * the stage; we write everything else — the security policy first, the fonts, then our player, which places every
 * animation of the page at any instant (CSS animations, Web Animations, and the model's own `window.seek(ms)`).
 * The same document serves the preview, the rendering test and the video export.
 */

export interface PlayerFont {
  /** The `font-family` name the model writes. */
  family: string;
  /** `data:font/woff2;base64,…` */
  dataUri: string;
  weight?: string;
  style?: string;
}

export interface PlayerOptions {
  width: number;
  height: number;
  durationMs: number;
  fonts?: PlayerFont[];
  /** `{{IMG:p1}}` → `data:image/…` */
  images?: Record<string, string>;
}

/** Nothing loads from the network; only what is inside the page runs. A second policy written by the model can only tighten this one. */
export const PLAYER_CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; media-src 'none'; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'";

/** Attributes of the iframe that holds the page: scripts only, no same-origin, no navigation, no popup, no form. */
export const PLAYER_IFRAME_SANDBOX = "allow-scripts";

function fontFaces(fonts: PlayerFont[]): string {
  return fonts
    .map((f) => `@font-face{font-family:'${f.family.replace(/'/g, "")}';src:url(${f.dataUri}) format('woff2');font-weight:${f.weight ?? "400"};font-style:${f.style ?? "normal"};font-display:block}`)
    .join("\n");
}

/** Our player, injected after the model's content. Kept small and dependency-free: it also runs inside the sealed iframe. */
export function playerRuntime(durationMs: number): string {
  return `(function(){
var D=${Math.round(durationMs)};
var errors=[];
window.addEventListener('error',function(e){errors.push(String(e.message||e))});
function list(){return document.getAnimations?document.getAnimations():[]}
function seek(ms){
  var t=Math.max(0,Math.min(D,ms));
  list().forEach(function(a){try{a.pause();a.currentTime=t}catch(e){errors.push(String(e))}});
  if(typeof window.seek==='function'){try{window.seek(t)}catch(e){errors.push('seek: '+e)}}
}
var timer=null,startedAt=0;
function frame(now){
  if(!startedAt)startedAt=now;
  seek((now-startedAt)%D);
  timer=requestAnimationFrame(frame);
}
window.__player={
  duration:D,
  seek:seek,
  play:function(){if(timer===null){startedAt=0;timer=requestAnimationFrame(frame)}},
  pause:function(){if(timer!==null){cancelAnimationFrame(timer);timer=null}},
  info:function(){
    var finite=0,infinite=0,maxEnd=0;
    list().forEach(function(a){
      var t=a.effect&&a.effect.getComputedTiming?a.effect.getComputedTiming():null;
      if(!t)return;
      if(t.endTime===Infinity){infinite++}else{finite++;if(t.endTime>maxEnd)maxEnd=t.endTime}
    });
    return {animations:finite+infinite,finite:finite,infinite:infinite,maxEndMs:maxEnd,hasSeek:typeof window.seek==='function',errors:errors.slice()};
  }
};
function box(X){return 'x '+Math.round(X.x)+', y '+Math.round(X.y)+', '+Math.round(X.w)+'x'+Math.round(X.h)+' px'}
function layoutIssues(){
  var stage=document.getElementById('stage');
  var W=stage.clientWidth,H=stage.clientHeight,sr=stage.getBoundingClientRect();
  var boxes=[],all=stage.querySelectorAll('*');
  for(var i=0;i<all.length;i++){
    var el=all[i];
    if(el.closest('script,style'))continue;
    var own='';
    for(var k=0;k<el.childNodes.length;k++)if(el.childNodes[k].nodeType===3)own+=el.childNodes[k].textContent;
    own=own.trim();
    if(!own)continue;
    var op=1,hidden=false;
    for(var e=el;e&&e!==stage.parentNode;e=e.parentElement){
      var cs=getComputedStyle(e);
      op*=parseFloat(cs.opacity);
      if(cs.visibility==='hidden'||cs.display==='none')hidden=true;
    }
    if(hidden||op<0.35)continue;
    var r=el.getBoundingClientRect();
    if(r.width<1||r.height<1)continue;
    boxes.push({el:el,t:own.slice(0,32),x:r.left-sr.left,y:r.top-sr.top,w:r.width,h:r.height,fs:parseFloat(getComputedStyle(el).fontSize)||0});
  }
  var out=[];
  for(var a=0;a<boxes.length;a++){
    var A=boxes[a];
    if(A.x<-2||A.y<-2||A.x+A.w>W+2||A.y+A.h>H+2)out.push('the text "'+A.t+'" ('+box(A)+') is cut by the edge of the canvas');
    if(A.fs<26)out.push('the text "'+A.t+'" is too small ('+Math.round(A.fs)+' px): nothing under 26 px is readable on a phone');
    if(A.fs>=40){
      var cy=A.y+A.h/2;
      if(cy<H*0.10||cy>H*0.74)out.push('the large text "'+A.t+'" ('+box(A)+') sits outside the safe area: keep it between y '+Math.round(H*0.10)+' and y '+Math.round(H*0.74));
    }
    for(var b=a+1;b<boxes.length;b++){
      var B=boxes[b];
      if(A.el.contains(B.el)||B.el.contains(A.el))continue;
      var ix=Math.min(A.x+A.w,B.x+B.w)-Math.max(A.x,B.x);
      var iy=Math.min(A.y+A.h,B.y+B.h)-Math.max(A.y,B.y);
      if(ix>0&&iy>0&&(ix*iy)/Math.min(A.w*A.h,B.w*B.h)>0.25)out.push('the texts "'+A.t+'" ('+box(A)+') and "'+B.t+'" ('+box(B)+') overlap: move one of them, and set line-height:1 on large numerals (their line box is taller than the glyphs)');
    }
  }
  return out;
}
/* The rendering test (docs/SPEC_ANIMATION_HTML_LIBRE.md A5): the page looks at itself at the given instants. */
function probe(times){
  var playing=timer!==null;
  if(playing){cancelAnimationFrame(timer);timer=null}
  var issues=[],seen={},text='';
  for(var i=0;i<times.length;i++){
    seek(times[i]);
    var found=layoutIssues();
    for(var j=0;j<found.length;j++){
      if(!seen[found[j]]){seen[found[j]]=1;issues.push('at '+(times[i]/1000).toFixed(1)+' s, '+found[j])}
    }
    text+='\\n'+document.getElementById('stage').innerText;
  }
  seek(0);
  if(playing){startedAt=0;timer=requestAnimationFrame(frame)}
  return {issues:issues.slice(0,6),text:text,errors:errors.slice(),info:window.__player.info()};
}
window.__player.probe=probe;
window.addEventListener('message',function(e){
  var d=e.data;
  if(d&&d.type==='cf-play'){window.__player.play()}
  if(d&&d.type==='cf-pause'){window.__player.pause()}
  if(d&&d.type==='cf-seek'){window.__player.pause();seek(Number(d.ms)||0)}
  if(d&&d.type==='cf-probe'&&e.source){
    var r=probe(d.times&&d.times.length?d.times:[0,800,1600,2400,3200,4000,4800,5600,6400,7200]);
    e.source.postMessage({type:'cf-probe-result',id:d.id,issues:r.issues,text:r.text,errors:r.errors,info:r.info},'*');
  }
});
seek(0);
})();`;
}

/** The whole document, ready for `iframe.srcdoc`. `modelHtml` is the model's fragment: styles, elements, an optional script. */
export function buildPlayerDocument(modelHtml: string, options: PlayerOptions): string {
  let body = modelHtml;
  for (const [ref, dataUri] of Object.entries(options.images ?? {})) body = body.split(`{{IMG:${ref}}}`).join(dataUri);
  return `<!doctype html>
<html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${PLAYER_CSP}">
<style>
${fontFaces(options.fonts ?? [])}
html,body{margin:0;padding:0;background:#000;overflow:hidden}
#stage{position:relative;width:${options.width}px;height:${options.height}px;overflow:hidden;background:#000}
</style></head>
<body><div id="stage">
${body}
</div>
<script>${playerRuntime(options.durationMs)}</script>
</body></html>`;
}
