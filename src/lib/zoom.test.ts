import { describe, expect, it, vi } from "vitest";
import { createWheelZoom, FONT_MAX, FONT_MIN, stepFontSize, stepZoom, ZOOM_MAX, ZOOM_MIN } from "./zoom";

function wheel(deltaY: number, ctrlKey: boolean) {
  const event = { deltaY, ctrlKey, preventDefault: vi.fn() };
  return event as unknown as WheelEvent & { preventDefault: ReturnType<typeof vi.fn> };
}

describe("stepZoom", () => {
  it("moves in tenths and stays on the grid", () => {
    expect(stepZoom(1.5, 1)).toBe(1.6);
    expect(stepZoom(1.5, -1)).toBe(1.4);
    expect(stepZoom(2.3, -1)).toBe(2.2);
  });

  it("never zooms out past the whole page, so it always stays inside its margins", () => {
    expect(ZOOM_MIN).toBe(1);
    expect(stepZoom(1.1, -1)).toBe(1);
    expect(stepZoom(1, -1)).toBe(1);
  });

  it("never zooms in past the maximum", () => {
    expect(stepZoom(ZOOM_MAX, 1)).toBe(ZOOM_MAX);
  });
});

describe("stepFontSize", () => {
  it("moves in steps of ten percent and clamps", () => {
    expect(stepFontSize(100, 1)).toBe(110);
    expect(stepFontSize(105, -1)).toBe(100);
    expect(stepFontSize(FONT_MAX, 1)).toBe(FONT_MAX);
    expect(stepFontSize(FONT_MIN, -1)).toBe(FONT_MIN);
  });
});

describe("createWheelZoom", () => {
  it("zooms with the plain wheel when the page does not scroll", () => {
    const onStep = vi.fn();
    const handle = createWheelZoom(onStep);
    handle(wheel(-120, false));
    handle(wheel(120, false));
    expect(onStep.mock.calls).toEqual([[1], [-1]]);
  });

  it("zooms only with Ctrl while the page scrolls, so the wheel can still scroll", () => {
    const onStep = vi.fn();
    const handle = createWheelZoom(onStep, () => true);
    const plain = wheel(-120, false);
    handle(plain);
    expect(onStep).not.toHaveBeenCalled();
    expect(plain.preventDefault).not.toHaveBeenCalled();

    handle(wheel(-120, true));
    expect(onStep).toHaveBeenCalledWith(1);
  });

  it("reads the scrolling mode at each event, so switching flow takes effect at once", () => {
    const onStep = vi.fn();
    let scrolling = false;
    const handle = createWheelZoom(onStep, () => scrolling);
    handle(wheel(-120, false));
    scrolling = true;
    handle(wheel(-120, false));
    expect(onStep.mock.calls).toEqual([[1]]);
  });

  it("waits for enough movement, so trackpads do not zoom on every tiny event", () => {
    const onStep = vi.fn();
    const handle = createWheelZoom(onStep);
    for (let i = 0; i < 5; i++) handle(wheel(-4, false));
    expect(onStep).not.toHaveBeenCalled();
    handle(wheel(-40, false));
    expect(onStep).toHaveBeenCalledWith(1);
  });

  it("stops the browser from zooming or scrolling the page while it zooms", () => {
    const handle = createWheelZoom(() => undefined);
    const event = wheel(-120, false);
    handle(event);
    expect(event.preventDefault).toHaveBeenCalled();
  });
});
