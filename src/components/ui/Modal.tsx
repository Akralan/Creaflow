"use client";

import { useEffect, type CSSProperties, type ReactNode } from "react";
import Card from "@/components/ui/Card";

export default function Modal({
  open,
  onClose,
  children,
  width = 460,
  closeOnOverlayClick = true,
  cardStyle,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: number;
  closeOnOverlayClick?: boolean;
  cardStyle?: CSSProperties;
}) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={() => closeOnOverlayClick && onClose()}
      className="modal-overlay"
      style={{ position: "fixed", inset: 0, background: "rgba(28,25,23,0.4)", display: "grid", placeItems: "center", zIndex: 50 }}
    >
      <Card
        onClick={(e) => e.stopPropagation()}
        className="modal-card"
        style={{ padding: 26, width, maxWidth: "90vw", maxHeight: "88vh", overflowY: "auto", ...cardStyle }}
      >
        {children}
      </Card>
    </div>
  );
}
