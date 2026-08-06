"use client";

import { useRef, useState } from "react";
import { color } from "@/lib/design/tokens";

export default function UploadDropzone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
        if (files.length > 0) onFiles(files);
      }}
      style={{
        border: `1.5px dashed ${dragOver ? "oklch(0.55 0.2 292)" : color.dashedBorder}`,
        borderRadius: 12,
        padding: "20px 16px",
        textAlign: "center",
        cursor: "pointer",
        fontSize: 13,
        color: color.textMuted,
        background: dragOver ? "oklch(0.55 0.2 292 / 0.05)" : "transparent",
      }}
    >
      Glisse des photos ici, ou clique pour en choisir depuis ton ordinateur.
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length > 0) onFiles(files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
