"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { toRenderableHtml } from "@/components/DesignEditor/designDom";
import type { WeekEntry } from "@/lib/apiClient";

export type MockupPreview = NonNullable<NonNullable<WeekEntry["script"]>["preview"]>;

/** First slide of the mockup, scaled to its frame — the image of a visual post inside the post pane. */
export default function DesignPreview({ scriptId, preview, hasLogo }: { scriptId: string; preview: MockupPreview; hasLogo: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scale = box ? Math.min(box.w / preview.width, box.h / preview.height) : 0;
  const html = toRenderableHtml(preview.html, {
    images: Object.fromEntries(
      preview.images.map((img) => [img.ref, `/api/scripts/${scriptId}/design/images/${img.ref}?v=${img.assetId}:${img.variant}`])
    ),
    logoUrl: hasLogo ? `/api/scripts/${scriptId}/design/logo` : null,
  });

  return (
    <div ref={hostRef} style={{ position: "relative", width: "100%", aspectRatio: `${preview.width} / ${preview.height}`, overflow: "hidden", background: "#f3f1ec" }}>
      {box && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            width: preview.width,
            height: preview.height,
            left: (box.w - preview.width * scale) / 2,
            top: (box.h - preview.height * scale) / 2,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            pointerEvents: "none",
            background: "#fff",
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </div>
  );
}
