import { beforeEach, describe, expect, it, vi } from "vitest";
import { animate, timeline } from "../mods/bf6-ui-anime";
import { setupBfPortalMock, type BfPortalModMock } from "../test-support/bfportal-vitest-mock.generated";

type TestVector = { x: number; y: number; z: number };

let modMock: BfPortalModMock;
let widget: mod.UIWidget;
let secondWidget: mod.UIWidget;

function fakeWidget(): mod.UIWidget {
    return { __test: true } as unknown as mod.UIWidget;
}

function vector(x: number, y: number, z = 0): mod.Vector {
    return { x, y, z } as unknown as mod.Vector;
}

function vectorData(value: mod.Vector): TestVector {
    return value as unknown as TestVector;
}

beforeEach(() => {
    vi.resetAllMocks();

    widget = fakeWidget();
    secondWidget = fakeWidget();

    modMock = setupBfPortalMock({
        Wait: async () => undefined,
        CreateVector: (x: number, y: number, z: number) => vector(x, y, z),
        XComponentOf: (value: mod.Vector) => vectorData(value).x,
        YComponentOf: (value: mod.Vector) => vectorData(value).y,
        ZComponentOf: (value: mod.Vector) => vectorData(value).z,
        GetUIWidgetPosition: (target: mod.UIWidget) => target === secondWidget ? vector(50, 60, 0) : vector(10, 20, 30),
        GetUIWidgetSize: () => vector(100, 40, 0),
        GetUIWidgetBgAlpha: () => 0.1,
        GetUIWidgetBgColor: () => vector(0, 0, 0),
        GetUIWidgetPadding: () => 4,
        GetUITextAlpha: () => 0,
        GetUITextColor: () => vector(0.25, 0.25, 0.25),
        GetUITextSize: () => 16,
        GetUIImageAlpha: () => 0.2,
        GetUIImageColor: () => vector(0, 0, 0),
        GetUIButtonAlphaBase: () => 0.1,
        GetUIButtonAlphaDisabled: () => 0.2,
        GetUIButtonAlphaPressed: () => 0.3,
        GetUIButtonAlphaHover: () => 0.4,
        GetUIButtonAlphaFocused: () => 0.5,
        GetUIButtonColorBase: () => vector(0, 0, 0),
        GetUIButtonColorDisabled: () => vector(0, 0, 0),
        GetUIButtonColorPressed: () => vector(0, 0, 0),
        GetUIButtonColorHover: () => vector(0, 0, 0),
        GetUIButtonColorFocused: () => vector(0, 0, 0),
    });
});

describe("timeline", () => {
    it("runs to, wait, and to steps in order", async () => {
        const order: string[] = [];
        modMock.SetUIWidgetBgAlpha.mockImplementation(() => order.push("first"));
        modMock.Wait.mockImplementation(async (seconds: number) => {
            if (seconds === 0.2) order.push("wait");
        });
        modMock.SetUITextAlpha.mockImplementation(() => order.push("second"));

        await timeline()
            .to(widget, { bgAlpha: 1 }, { duration: 0 })
            .wait(0.2)
            .to(secondWidget, { textAlpha: 1 }, { duration: 0 })
            .play();

        expect(order).toEqual(["first", "wait", "second"]);
    });

    it("keeps unspecified vector components for position and size shorthands", async () => {
        await animate(widget).to({ x: 80, y: 120, width: 220 }, { duration: 0 });

        expect(vectorData(modMock.SetUIWidgetPosition.mock.calls[0][1])).toEqual({ x: 80, y: 120, z: 30 });
        expect(vectorData(modMock.SetUIWidgetSize.mock.calls[0][1])).toEqual({ x: 220, y: 40, z: 0 });
    });

    it("routes alpha properties to the matching Portal setters", async () => {
        await animate(widget).to({
            bgAlpha: 0.8,
            textAlpha: 0.7,
            imageAlpha: 0.6,
            buttonAlphaBase: 0.5,
            buttonAlphaDisabled: 0.4,
            buttonAlphaPressed: 0.3,
            buttonAlphaHover: 0.2,
            buttonAlphaFocused: 0.1,
        }, { duration: 0 });

        expect(modMock.SetUIWidgetBgAlpha).toHaveBeenCalledWith(widget, 0.8);
        expect(modMock.SetUITextAlpha).toHaveBeenCalledWith(widget, 0.7);
        expect(modMock.SetUIImageAlpha).toHaveBeenCalledWith(widget, 0.6);
        expect(modMock.SetUIButtonAlphaBase).toHaveBeenCalledWith(widget, 0.5);
        expect(modMock.SetUIButtonAlphaDisabled).toHaveBeenCalledWith(widget, 0.4);
        expect(modMock.SetUIButtonAlphaPressed).toHaveBeenCalledWith(widget, 0.3);
        expect(modMock.SetUIButtonAlphaHover).toHaveBeenCalledWith(widget, 0.2);
        expect(modMock.SetUIButtonAlphaFocused.mock.calls[0][1]).toBeCloseTo(0.1);
    });

    it("interpolates vector color properties", async () => {
        await animate(widget).to({
            bgColor: [1, 0.5, 0.25],
            textColor: [0.9, 0.8, 0.7],
            imageColor: [0.6, 0.5, 0.4],
            buttonColorBase: [0.3, 0.2, 0.1],
        }, { duration: 0 });

        expect(vectorData(modMock.SetUIWidgetBgColor.mock.calls[0][1])).toEqual({ x: 1, y: 0.5, z: 0.25 });
        expect(vectorData(modMock.SetUITextColor.mock.calls[0][1])).toEqual({ x: 0.9, y: 0.8, z: 0.7 });
        expect(vectorData(modMock.SetUIImageColor.mock.calls[0][1])).toEqual({ x: 0.6, y: 0.5, z: 0.4 });
        expect(vectorData(modMock.SetUIButtonColorBase.mock.calls[0][1])).toEqual({ x: 0.3, y: 0.2, z: 0.1 });
    });

    it("shows widgets at the start and hides widgets at the end", async () => {
        await animate(widget).to({ visible: true, bgAlpha: 1 }, { duration: 0 });
        await animate(secondWidget).to({ visible: false, bgAlpha: 0 }, { duration: 0 });

        expect(modMock.SetUIWidgetVisible.mock.calls[0]).toEqual([widget, true]);
        expect(modMock.SetUIWidgetVisible.mock.calls[modMock.SetUIWidgetVisible.mock.calls.length - 1]).toEqual([secondWidget, false]);
    });

    it("applies duration zero without waiting", async () => {
        await animate(widget).to({ textSize: 32 }, { duration: 0 });

        expect(modMock.Wait).not.toHaveBeenCalled();
        expect(modMock.SetUITextSize).toHaveBeenCalledWith(widget, 32);
    });

    it("stops before running remaining steps", async () => {
        const tl = timeline();
        tl
            .to(widget, { bgAlpha: 1 }, { duration: 0 })
            .call(() => tl.stop())
            .to(secondWidget, { bgAlpha: 1 }, { duration: 0 });

        await tl.play();

        expect(modMock.SetUIWidgetBgAlpha).toHaveBeenCalledTimes(1);
        expect(modMock.SetUIWidgetBgAlpha).toHaveBeenCalledWith(widget, 1);
    });
});
