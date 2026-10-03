"use client";

import { useSyncExternalStore } from "react";

/**
 * Emails that have signed in successfully on this device, newest first. Stored only in this browser (never sent
 * anywhere), so a shared shop phone can offer "pick your account" without exposing staff emails to anyone else.
 */
const KEY = "bb-recent-accounts";
const MAX = 6;
const listeners = new Set<() => void>();

function read(): string {
  try {
    return localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function write(emails: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(emails.slice(0, MAX)));
  } catch {
    // Private mode or storage blocked: the dropdown just won't remember.
  }
  listeners.forEach((l) => l());
}

function parse(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((e): e is string => typeof e === "string") : [];
  } catch {
    return [];
  }
}

export function rememberAccount(email: string) {
  const e = email.trim().toLowerCase();
  write([e, ...parse(read()).filter((x) => x !== e)]);
}

export function forgetAccount(email: string) {
  write(parse(read()).filter((x) => x !== email));
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  window.addEventListener("storage", l);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", l);
  };
};

export function useRecentAccounts(): string[] {
  // Raw string snapshot keeps it stable between renders; the server renders with none.
  const raw = useSyncExternalStore(subscribe, read, () => "[]");
  return parse(raw);
}
