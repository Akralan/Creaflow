"use client";

import { useSyncExternalStore } from "react";
import { personas as allPersonas, type Persona } from "@/components/landing/personas";
import { ACTIVE_PERSONA_IDS } from "@/components/landing/flags";
import styles from "@/components/landing/landing.module.css";

/**
 * Single clock for all the landing examples: every PERIOD_MS, everything that
 * depends on the profile fades out (phase "out"), then the next profile appears (phase "in").
 * One module-level store so the hero and the features change together.
 */
const PERIOD_MS = 7000;

/** Profiles shown (see ACTIVE_PERSONA_IDS). Empty list or unknown ids: all profiles. */
const activePersonas = allPersonas.filter((p) => ACTIVE_PERSONA_IDS.includes(p.id));
const personas = activePersonas.length > 0 ? activePersonas : allPersonas;
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
  // Single profile: nothing to rotate.
  if (!running && personas.length > 1) {
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

/** Pauses the rotation (demo hover, for example) without resetting it. */
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
