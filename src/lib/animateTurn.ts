import { PAGE_TURN_MS, resolvePageTurn } from "./reading";
import type { PageTurn } from "./types";

export type TurnDirection = "next" | "previous";

const HALF = PAGE_TURN_MS / 2;

function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Runs a page change wrapped in a short exit and entrance on the page element.
 * Slide moves the page a few percent in the reading direction; fade only changes
 * opacity. Turns queue behind each other so fast taps never tear the page apart,
 * and a failed change never blocks the turns that come after it.
 */
export function createTurnRunner(element: () => HTMLElement | null, preference: () => PageTurn) {
  let queue: Promise<void> = Promise.resolve();

  const run = async (direction: TurnDirection, change: () => Promise<void> | void) => {
    const el = element();
    const mode = resolvePageTurn(preference(), reducedMotion());

    if (!el || mode === "none" || typeof el.animate !== "function") {
      await change();
      return;
    }

    const sign = direction === "next" ? -1 : 1;
    const offset = mode === "slide" ? 4 : 0;

    const exit = el.animate(
      [
        { opacity: 1, transform: "translateX(0)" },
        { opacity: 0, transform: `translateX(${sign * offset}%)` },
      ],
      { duration: HALF, easing: "cubic-bezier(0.4, 0, 1, 1)", fill: "forwards" },
    );
    await exit.finished;

    try {
      await change();
    } finally {
      exit.cancel();
    }

    const enter = el.animate(
      [
        { opacity: 0, transform: `translateX(${-sign * offset}%)` },
        { opacity: 1, transform: "translateX(0)" },
      ],
      { duration: HALF, easing: "cubic-bezier(0, 0, 0.2, 1)" },
    );
    await enter.finished;
  };

  return (direction: TurnDirection, change: () => Promise<void> | void): Promise<void> => {
    const task = queue.then(() => run(direction, change));
    queue = task.catch(() => undefined);
    return task;
  };
}
