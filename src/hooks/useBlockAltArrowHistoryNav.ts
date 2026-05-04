import { useEffect } from "react";

const TEXT_EDITING_SELECTOR = [
  "textarea",
  "select",
  'input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"]):not([type="hidden"]):not([type="image"])',
  "[contenteditable]",
  '[role="textbox"]',
  ".MuiInputBase-input",
  ".MuiSelect-nativeInput",
].join(", ");

/**
 * True when the event target is inside a control where Option/Alt+Arrow should move the
 * caret (word jump) or otherwise belong to text editing — we must not intercept those.
 */
function isEditableTextTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const el = target.closest<HTMLElement>(TEXT_EDITING_SELECTOR);
  if (!el) return false;
  if (el instanceof HTMLInputElement) {
    const t = (el.type || "text").toLowerCase();
    const nonText = ["button", "submit", "reset", "checkbox", "radio", "range", "color", "file", "hidden", "image"];
    if (nonText.includes(t)) return false;
  }
  return true;
}

/**
 * Browsers treat Alt/Option + ArrowLeft/ArrowRight as history Back/Forward. That hijacks
 * the same keys macOS uses for word-by-word caret movement when focus is outside a text
 * field, or conflicts with normal editing expectations. We block history navigation whenever
 * focus is not inside a text-editing control.
 */
export function useBlockAltArrowHistoryNav(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const alt = e.altKey || (typeof e.getModifierState === "function" && e.getModifierState("Alt"));
      if (!alt) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (isEditableTextTarget(e.target)) return;

      e.preventDefault();
      e.stopPropagation();
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);
}
