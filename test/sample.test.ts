import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OnPlayerDeployed } from '../mods/Script';
import { setupBfPortalMock, type BfPortalModMock, createFake } from "../test-support/bfportal-vitest-mock.generated";

import stringkeys from "../dist/Strings.json";

export let modMock: BfPortalModMock;

type TestVector = { x: number; y: number; z: number };

let panel: mod.UIWidget;
let accent: mod.UIWidget;
let title: mod.UIWidget;

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

    panel = fakeWidget();
    accent = fakeWidget();
    title = fakeWidget();

    modMock = setupBfPortalMock({
        GetObjId: () => 100,
        Wait: async () => undefined,
        CreateVector: (x: number, y: number, z: number) => vector(x, y, z),
        XComponentOf: (value: mod.Vector) => vectorData(value).x,
        YComponentOf: (value: mod.Vector) => vectorData(value).y,
        ZComponentOf: (value: mod.Vector) => vectorData(value).z,
        GetUIRoot: () => fakeWidget(),
        HasUIWidgetWithName: () => false,
        FindUIWidgetWithName: (name: string) => {
            if (name === "deploy-panel-100") return panel;
            if (name === "deploy-accent-100") return accent;
            return title;
        },
        GetUIWidgetPosition: (widget: mod.UIWidget) => widget === panel ? vector(-420, 120, 0) : vector(0, 0, 0),
        GetUIWidgetSize: (widget: mod.UIWidget) => {
            if (widget === panel) return vector(380, 96, 0);
            if (widget === accent) return vector(0, 6, 0);
            return vector(344, 80, 0);
        },
        GetUIWidgetBgAlpha: () => 0,
        GetUIWidgetBgColor: () => vector(0.1, 0.12, 0.16),
        GetUIWidgetPadding: () => 8,
        GetUITextAlpha: () => 0,
        GetUITextColor: () => vector(1, 1, 1),
        GetUITextSize: () => 20,
        Message(
            msg: string | number | mod.Player,
            msgArg0?: string | number | mod.Player,
            msgArg1?: string | number | mod.Player,
            msgArg2?: string | number | mod.Player,
        ): mod.Message {
            return {
                __test: true,
                msg,
                args: [msgArg0, msgArg1, msgArg2],
            } as unknown as mod.Message;
        },
    }, {
        stringkeys,
        UIAnchor: {
            Center: 3,
            TopLeft: 7,
            TopRight: 8,
        } as typeof mod.UIAnchor,
        UIBgFill: {
            Blur: 0,
            None: 5,
            Solid: 8,
        } as typeof mod.UIBgFill,
    });
});

describe('OnPlayerDeployed', () => {
    it('When a player deploys, shows an animated UI message', async () => {
        await OnPlayerDeployed(createFake<mod.Player>());

        expect(modMock.AddUIContainer).toHaveBeenCalledWith(
            "deploy-panel-100",
            { x: -420, y: 120, z: 0 },
            { x: 380, y: 96, z: 0 },
            8,
            expect.anything(),
            false,
            8,
            { x: 0.02, y: 0.06, z: 0.12 },
            0,
            8,
            expect.anything(),
        );
        expect(modMock.AddUIText).toHaveBeenCalled();
        expect(modMock.SetUIWidgetVisible).toHaveBeenCalledWith(panel, true);
        expect(modMock.SetUIWidgetVisible).toHaveBeenCalledWith(accent, true);
        expect(modMock.SetUIWidgetSize).toHaveBeenCalledWith(accent, { x: 380, y: 6, z: 0 });
        expect(modMock.SetUITextAlpha).toHaveBeenCalledWith(title, 1);
        expect(modMock.SetUIWidgetVisible).toHaveBeenCalledWith(panel, false);
    });
});
