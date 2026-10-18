"use client";

import { useEffect, useRef, useState } from "react";
import NetworkLogo from "@/components/app/NetworkLogo";
import { api, ApiClientError } from "@/lib/apiClient";
import type { ConnectionState } from "@/lib/performance/overview";
import { NETWORKS, type Network } from "@/lib/weekPosts";
import { platformLabel } from "@/lib/social/types";

/**
 * Connecting a network without leaving the Performance screen (docs/SPEC_PERFORMANCE.md §4, §6): LinkedIn opens
 * its sign-in, X asks for the handle in a small panel (its public numbers are what gets read). `header` is the
 * row of the networks still to connect, at the level of the page title; `card` is the same choice laid out in the
 * middle of the page, for when nothing is connected yet.
 */

const RETURN_TO = encodeURIComponent("/performance");

/** A network the screen can still do something about: not connected, expired, or X waiting for its handle. */
export function networksToConnect(connections: Record<Network, ConnectionState>): Network[] {
  return NETWORKS.filter((n) => connections[n] !== "ok");
}

function HandlePanel({ onSaved, onCancel, inline }: { onSaved: () => void; onCancel?: () => void; inline?: boolean }) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!value.trim()) return;
    // Checked here first so the message says what is wrong, instead of a generic « Invalid request ».
    if (!/^@?[A-Za-z0-9_]{1,15}$/.test(value.trim())) {
      setError("Enter your X handle like @yourname: letters, digits and underscores, up to 15.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.setXHandle(value);
      onSaved();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "The handle could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={`pf-handle${inline ? " inline" : ""}`} onSubmit={submit}>
      <label htmlFor="pf-x-handle">Your X handle</label>
      <div className="line">
        <input
          id="pf-x-handle"
          ref={input}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="@yourname"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          maxLength={20}
        />
        <button className="btn btn-ink btn-sm" type="submit" disabled={saving || !value.trim()}>
          {saving ? "Connecting…" : "Connect"}
        </button>
        {onCancel && (
          <button className="btn btn-quiet btn-sm" type="button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
      <p className="help">Only the public numbers of your posts are read: views, likes, replies and reposts.</p>
      {error && (
        <p className="err" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

export default function PerformanceConnect({
  connections,
  xMethod,
  variant,
  onConnected,
}: {
  connections: Record<Network, ConnectionState>;
  xMethod: "handle" | "oauth";
  variant: "header" | "card";
  onConnected: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const remaining = networksToConnect(connections);

  // The panel closes on a click outside it or on Escape, like the account menu.
  useEffect(() => {
    if (!open || variant !== "header") return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, variant]);

  if (remaining.length === 0) return null;

  const oauthHref = (network: Network) => `/api/auth/${network}/connect?returnTo=${RETURN_TO}`;
  const xByHandle = xMethod === "handle";
  const label = (network: Network) =>
    connections[network] === "needs_reconnect" ? `Reconnect ${platformLabel(network)}` : platformLabel(network);

  if (variant === "card") {
    return (
      <div className="pf-card pf-empty">
        <h2>Connect a network to see how your posts do.</h2>
        <p>Pick one to start — you can add the other later. The numbers of every post you publish show up here.</p>
        <div className="pf-options">
          {remaining.map((network) => (
            <div className="pf-option" key={network}>
              <span className="who">
                <NetworkLogo network={network} />
                <b>{platformLabel(network)}</b>
              </span>
              {network === "x" && xByHandle ? (
                <HandlePanel inline onSaved={onConnected} />
              ) : (
                <a className="btn btn-ink btn-sm" href={oauthHref(network)}>
                  {connections[network] === "needs_reconnect" ? "Reconnect" : "Connect"}
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="pf-connect" ref={rootRef}>
      <span className="k">
        {remaining.every((n) => connections[n] === "needs_reconnect")
          ? "Connection expired"
          : remaining.length === NETWORKS.length
            ? "Connect"
            : "Still to connect"}
      </span>
      {remaining.map((network) =>
        network === "x" && xByHandle ? (
          <button
            key={network}
            type="button"
            className="pf-conn"
            aria-expanded={open}
            aria-haspopup="dialog"
            title="Connect X"
            onClick={() => setOpen((v) => !v)}
          >
            <NetworkLogo network={network} />
            <span>{label(network)}</span>
          </button>
        ) : (
          <a key={network} className="pf-conn" href={oauthHref(network)} title={`Connect ${platformLabel(network)}`}>
            <NetworkLogo network={network} />
            <span>{label(network)}</span>
          </a>
        )
      )}
      {open && (
        <div className="pf-pop" role="dialog" aria-label="Connect X">
          <HandlePanel
            onSaved={() => {
              setOpen(false);
              onConnected();
            }}
            onCancel={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
