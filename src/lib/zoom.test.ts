import { describe, expect, it, vi } from "vitest";
import { createWheelZoom, FONT_MAX, FONT_MIN, stepFontSize, stepZoom, ZOOM_MAX, ZOOM_MIN } from "./zoom";

function wheel(deltaY: number, ctrlKey: boolean) {
  const event = { deltaY, ctrlKey, preventDefault: vi.fn() };
  return event as unknown as WheelEvent & { preventDefault: ReturnType<typeof vi.fn> };
}

describe("stepZoom", () => {
  it("moves in tenths and stays on the grid", () => {
    expect(stepZoom(1, 1)).toBe(1.1);
    expect(stepZoom(1.1, -1)).toBe(1);
    expect(stepZoom(0.7, -1)).toBe(0.6);
  });

  it("never leaves the zoom range", () => {
    expect(stepZoom(ZOOM_MAX, 1)).toBe(ZOOM_MAX);
    expect(stepZoom(ZOOM_MIN, -1)).toBe(ZOOM_MIN);
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
  it("ignores the wheel without Ctrl so scrolling and page turns keep working", () => {
    const onStep = vi.fn();
    const handle = createWheelZoom(onStep);
    const event = wheel(120, false);
    handle(event);
    expect(onStep).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it("zooms in when the wheel moves up and out when it moves down, with Ctrl held", () => {
    const onStep = vi.fn();
    const handle = createWheelZoom(onStep);
    handle(wheel(-120, true));
    handle(wheel(120, true));
    expect(onStep.mock.calls).toEqual([[1], [-1]]);
  });

  it("waits for enough movement, so trackpads do not zoom on every tiny event", () => {
    const onStep = vi.fn();
    const handle = createWheelZoom(onStep);
    for (let i = 0; i < 5; i++) handle(wheel(-4, true));
    expect(onStep).not.toHaveBeenCalled();
    handle(wheel(-40, true));
    expect(onStep).toHaveBeenCalledWith(1);
  });

  it("stops the browser from zooming the whole window", () => {
    const handle = createWheelZoom(() => undefined);
    const event = wheel(-120, true);
    handle(event);
    expect(event.preventDefault).toHaveBeenCalled();
  });
});
