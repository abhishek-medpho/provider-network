"use client";

/**
 * After a failed submit, the page re-renders with red-bordered field blocks
 * (marked via data-field-error="true"). This component runs once on mount
 * and scrolls the page to the first such block so the user immediately sees
 * what they need to fix — rather than scanning a long form for red boxes.
 */

import { useEffect } from "react";

export function ScrollToFirstError() {
  useEffect(() => {
    const target = document.querySelector<HTMLElement>(
      '[data-field-error="true"]',
    );
    if (!target) return;
    // Delay one frame so the browser has finished layout before scrolling.
    requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      // Try to focus the first input inside, so mobile keyboards open.
      const input = target.querySelector<HTMLElement>(
        "input, select, textarea, button",
      );
      input?.focus({ preventScroll: true });
    });
  }, []);

  return null;
}
