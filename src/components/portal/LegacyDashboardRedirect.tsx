"use client";

import { useEffect } from "react";

// Preserve links saved when the dashboard was mounted at the domain root.
const legacyKeys = new Set(["jgp", "p", "d", "m", "n", "g", "r", "c", "x", "ax", "t", "hospital", "hv", "peer"]);

export function LegacyDashboardRedirect() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if ([...params.keys()].some((key) => legacyKeys.has(key))) {
      window.location.replace(`/analizy${window.location.search}${window.location.hash}`);
    }
  }, []);
  return null;
}
