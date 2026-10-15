"use client";

import { useSyncExternalStore } from "react";
import { personas, type Persona } from "@/components/landing/personas";
import styles from "@/components/landing/landing.module.css";

/**
 * Horloge unique pour tous les exemples de la landing : toutes les PERIOD_MS, tout ce qui
 * dépend du profil s'efface (phase "out"), puis le profil suivant apparaît (phase "in").
 * Un seul store module-level pour que le hero et les fonctionnalités changent ensemble.
 */
const PERIOD_MS = 7000;
const FADE_OUT_MS = 380;

type State = { index: number; phase: "in" | "out" };

const SERVER_STATE: State = { index: 0, phase: "in" };
let state: State = SERVER_STATE;
const listeners = new Set<() => void>();
let periodTimer: number | undefined;
let fadeTimer: number | undefined;
let running = false;
let paused = false;

function emit(next: State) {
  state = next;
  listeners.forEach((listener) => listener());
}

function tick() {
  periodTimer = window.setTimeout(() => {
    if (paused) {
      tick();
      return;
    }
    emit({ ...state, phase: "out" });
    fadeTimer = window.setTimeout(() => {
      emit({ index: (state.index + 1) % personas.length, phase: "in" });
      tick();
    }, FADE_OUT_MS);
  }, PERIOD_MS);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!running) {
    running = true;
    tick();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.clearTimeout(periodTimer);
      window.clearTimeout(fadeTimer);
      running = false;
    }
  };
}

/** Suspend la rotation (survol de la démo, par exemple) sans la réinitialiser. */
export function pausePersonaRotation(value: boolean) {
  paused = value;
}

export function usePersona(): { persona: Persona; fadeClass: string } {
  const current = useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER_STATE
  );
  return {
    persona: personas[current.index],
    fadeClass: current.phase === "out" ? styles.swapOut : styles.swapIn,
  };
}
