"use client";

import { useState } from "react";
import AssistantChat from "@/components/AssistantChat";
import AssistantProposalsPanel from "@/components/AssistantProposalsPanel";
import { heading1Style } from "@/components/ui/TextField";
import { type AssistantProposal } from "@/lib/apiClient";
import { color } from "@/lib/design/tokens";

export default function AssistantPage() {
  const [proposals, setProposals] = useState<AssistantProposal[]>([]);

  return (
    <div style={{ padding: "32px 36px", height: "100%", display: "flex", flexDirection: "column" }}>
      <h1 style={heading1Style}>Assistant</h1>
      <p style={{ margin: "6px 0 24px", color: color.textMuted, fontSize: 15 }}>
        Talk through updates to your work — the assistant proposes new or edited products and series for you to approve before anything is saved.
      </p>
      <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 20 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <AssistantChat onProposalsChange={setProposals} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <AssistantProposalsPanel proposals={proposals} onProposalsChange={setProposals} />
        </div>
      </div>
    </div>
  );
}
