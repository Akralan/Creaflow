"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { PLAYER_IFRAME_SANDBOX } from "@/lib/animationHtml/player";
import AppIcon from "@/components/app/AppIcon";

/**
 * Plays the animation of a post in a sealed iframe (docs/SPEC_ANIMATION_HTML_LIBRE.md A2): scripts only, no access to
 * the application, nothing loaded from the network. The page is driven from here by messages (`cf-play`, `cf-pause`,
 * `cf-probe`) because the iframe's origin is opaque: the application cannot reach into it.
 */

export interface ProbeResult {
  issues: string[];
  /** Every text shown at the probed instants, for the check of the numbers. */
  text: string;
  errors: string[];
}

export interface AnimationPlayerHandle {
  /** The rendering test: the page looks at itself at several instants and reports what is wrong. */
  probe: (times?: number[]) => Promise<ProbeResult>;
}

interface Props {
  document: string;
  width: number;
  height: number;
  /** Where the sealed page is told not to cover (the apps' interface): shown as a hint only. */
  label?: string;
}

const AnimationPlayer = forwardRef<AnimationPlayerHandle, Props>(function AnimationPlayer({ document: html, width, height, label }, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const loaded = useRef<Promise<void> | null>(null);
  const [scale, setScale] = useState(0.3);
  const [playing, setPlaying] = useState(true);

  useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const measure = () => setScale(el.clientWidth / width);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [width]);

  const send = useCallback((message: Record<string, unknown>) => frameRef.current?.contentWindow?.postMessage(message, "*"), []);

  // A new page: wait for it to load, then play it in a loop.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    loaded.current = new Promise<void>((resolve) => {
      const onLoad = () => {
        send({ type: "cf-play" });
        setPlaying(true);
        resolve();
      };
      frame.addEventListener("load", onLoad, { once: true });
    });
  }, [html, send]);

  useImperativeHandle(
    ref,
    () => ({
      probe: async (times) => {
        await loaded.current;
        const frame = frameRef.current;
        if (!frame?.contentWindow) throw new Error("The animation is not on screen.");
        const id = Math.random().toString(36).slice(2);
        return new Promise<ProbeResult>((resolve, reject) => {
          const timeout = setTimeout(() => {
            window.removeEventListener("message", onMessage);
            reject(new Error("The animation did not answer the rendering test."));
          }, 10_000);
          function onMessage(event: MessageEvent) {
            if (event.source !== frame!.contentWindow || event.data?.type !== "cf-probe-result" || event.data.id !== id) return;
            clearTimeout(timeout);
            window.removeEventListener("message", onMessage);
            resolve({ issues: event.data.issues ?? [], text: event.data.text ?? "", errors: event.data.errors ?? [] });
          }
          window.addEventListener("message", onMessage);
          frame.contentWindow!.postMessage({ type: "cf-probe", id, times }, "*");
        });
      },
    }),
    []
  );

  function toggle() {
    send({ type: playing ? "cf-pause" : "cf-play" });
    setPlaying(!playing);
  }

  return (
    <div className="anim" ref={hostRef} style={{ aspectRatio: `${width} / ${height}` }}>
      <iframe
        ref={frameRef}
        title={label ?? "Animation"}
        sandbox={PLAYER_IFRAME_SANDBOX}
        srcDoc={html}
        style={{ width, height, transform: `scale(${scale})` }}
      />
      <button className="anim-toggle" type="button" onClick={toggle} aria-label={playing ? "Pause the animation" : "Play the animation"}>
        <AppIcon name={playing ? "pause" : "play"} />
      </button>
    </div>
  );
});

export default AnimationPlayer;
