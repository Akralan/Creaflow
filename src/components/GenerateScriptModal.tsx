"use client";

import { X } from "lucide-react";
import Modal from "@/components/ui/Modal";
import GenerateForm from "@/components/GenerateForm";
import IconActionButton from "@/components/ui/IconActionButton";
import { type Script } from "@/lib/apiClient";
import { color } from "@/lib/design/tokens";

function formatScheduledDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const label = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(
    new Date(y, m - 1, d)
  );
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default function GenerateScriptModal({
  open,
  onClose,
  scheduledDate,
  onGenerated,
}: {
  open: boolean;
  onClose: () => void;
  scheduledDate?: string;
  onGenerated: (script: Script) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} width={620}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 }}>
        <div>
          <div style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 20 }}>Génération libre</div>
          <p style={{ margin: "6px 0 0", color: color.textMuted, fontSize: 14 }}>
            {scheduledDate
              ? `Ce script sera placé au calendrier le ${formatScheduledDate(scheduledDate)}.`
              : "Un script à la demande, sans passer par un créneau du calendrier."}
          </p>
        </div>
        <IconActionButton icon={X} variant="neutral" title="Fermer" onClick={onClose} size={32} />
      </div>
      <div style={{ marginTop: 18 }}>
        <GenerateForm scheduledDate={scheduledDate} onGenerated={onGenerated} />
      </div>
    </Modal>
  );
}
