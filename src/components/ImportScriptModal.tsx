"use client";

import { X } from "lucide-react";
import Modal from "@/components/ui/Modal";
import ImportScriptForm from "@/components/ImportScriptForm";
import IconActionButton from "@/components/ui/IconActionButton";
import { type Script } from "@/lib/apiClient";
import { color } from "@/lib/design/tokens";

export default function ImportScriptModal({
  open,
  onClose,
  scheduledDate,
  calendarEntryId,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  scheduledDate?: string;
  calendarEntryId?: string;
  onImported: (script: Script) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} width={620}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 }}>
        <div>
          <div style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 20 }}>Importer un script</div>
          <p style={{ margin: "6px 0 0", color: color.textMuted, fontSize: 14 }}>
            Un texte déjà écrit ailleurs — CreaFlow en assure juste le suivi.
          </p>
        </div>
        <IconActionButton icon={X} variant="neutral" title="Fermer" onClick={onClose} size={32} />
      </div>
      <div style={{ marginTop: 18 }}>
        <ImportScriptForm scheduledDate={scheduledDate} calendarEntryId={calendarEntryId} onImported={onImported} />
      </div>
    </Modal>
  );
}
