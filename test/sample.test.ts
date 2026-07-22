import { beforeEach, describe, expect, it, vi } from "vitest";
import { OngoingPlayer, OnPlayerDeployed, OnPlayerDied, OnPlayerJoinGame, OnPlayerUIButtonEvent, OnPlayerUndeploy } from "../mods/Script";
import { sampleObjectFloatPhysics, sampleRuntimeObjectHingedBoards, sampleUiGaugeAnimation, type SampleAnimationControl } from "../mods/Samples";
import { createFake, setupBfPortalMock, type BfPortalModMock } from "../test-support/bfportal-vitest-mock.generated";

import stringkeys from "../dist/Strings.json";

export let modMock: BfPortalModMock;
let soldierIsCrouching: boolean;

type TestVector = { x: number; y: number; z: number };
type TestWidget = { __test: true; name: string };

const widgets = new Map<string, mod.UIWidget>();

function fakeWidget(name: string): mod.UIWidget {
    return { __test: true, name } as unknown as mod.UIWidget;
}

function fakeObject(name: string): mod.Object {
    return { __test: true, name } as unknown as mod.Object;
}

function widgetData(widget: mod.UIWidget): TestWidget {
    return widget as unknown as TestWidget;
}

function widgetNamed(name: string): mod.UIWidget {
    const existing = widgets.get(name);
    if (existing) return existing;

    const widget = fakeWidget(name);
    widgets.set(name, widget);
    return widget;
}

function vector(x: number, y: number, z = 0): mod.Vector {
    return { x, y, z } as unknown as mod.Vector;
}

function vectorData(value: mod.Vector): TestVector {
    return value as unknown as TestVector;
}

function addValue(left: number, right: number): number;
function addValue(left: mod.Vector, right: mod.Vector): mod.Vector;
function addValue(left: number | mod.Vector, right: number | mod.Vector): number | mod.Vector {
    if (typeof left === "number" && typeof right === "number") return left + right;

    const leftData = vectorData(left as mod.Vector);
    const rightData = vectorData(right as mod.Vector);
    return vector(leftData.x + rightData.x, leftData.y + rightData.y, leftData.z + rightData.z);
}

function subtractValue(left: number, right: number): number;
function subtractValue(left: mod.Vector, right: mod.Vector): mod.Vector;
function subtractValue(left: number | mod.Vector, right: number | mod.Vector): number | mod.Vector {
    if (typeof left === "number" && typeof right === "number") return left - right;

    const leftData = vectorData(left as mod.Vector);
    const rightData = vectorData(right as mod.Vector);
    return vector(leftData.x - rightData.x, leftData.y - rightData.y, leftData.z - rightData.z);
}

function dotVector(left: mod.Vector, right: mod.Vector): number {
    const leftData = vectorData(left);
    const rightData = vectorData(right);
    return leftData.x * rightData.x + leftData.y * rightData.y + leftData.z * rightData.z;
}

function normalizeVector(value: mod.Vector): mod.Vector {
    const data = vectorData(value);
    const length = Math.sqrt(data.x ** 2 + data.y ** 2 + data.z ** 2);
    return vector(data.x / length, data.y / length, data.z / length);
}

function stopHingedBoardSampleAfterFirstRuntimeTick(): SampleAnimationControl {
    let stopSample: (() => void) | undefined;
    let canceled = false;
    let waitCount = 0;
    modMock.Wait.mockImplementation(async () => {
        waitCount += 1;
        if (waitCount === 2) {
            canceled = true;
            stopSample?.();
        }
    });

    return {
        isCanceled: () => canceled,
        onCancel: (stop) => {
            stopSample = stop;
        },
    };
}

beforeEach(() => {
    vi.resetAllMocks();
    widgets.clear();
    soldierIsCrouching = false;

    modMock = setupBfPortalMock({
        GetObjId: () => 100,
        Wait: async () => undefined,
        SpawnObject: () => fakeObject("sample-object"),
        Add: addValue,
        DotProduct: dotVector,
        Normalize: normalizeVector,
        SendErrorReport: () => undefined,
        Subtract: subtractValue,
        UnspawnObject: () => undefined,
        CreateTransform: (position: mod.Vector, rotation: mod.Vector) => ({ position, rotation }) as unknown as mod.Transform,
        GetObjectPosition: () => vector(10, 3, 23),
        GetObjectRotation: () => vector(0, 0, 0),
        GetObjectTransform: () => ({ position: vector(10, 3, 23), rotation: vector(0, 0, 0) }) as unknown as mod.Transform,
        GetTransformPosition: (transform: mod.Transform) => (transform as unknown as { position: mod.Vector }).position,
        GetTransformRotation: (transform: mod.Transform) => (transform as unknown as { rotation: mod.Vector }).rotation,
        CreateVector: (x: number, y: number, z: number) => vector(x, y, z),
        XComponentOf: (value: mod.Vector) => vectorData(value).x,
        YComponentOf: (value: mod.Vector) => vectorData(value).y,
        ZComponentOf: (value: mod.Vector) => vectorData(value).z,
        GetUIRoot: () => widgetNamed("root"),
        HasUIWidgetWithName: (name: string) => widgets.has(name),
        FindUIWidgetWithName: (name: string) => widgetNamed(name),
        GetUIWidgetName: (widget: mod.UIWidget) => widgetData(widget).name,
        GetUIWidgetPosition: () => vector(0, 0, 0),
        GetUIWidgetSize: (widget: mod.UIWidget) => {
            const name = widgetData(widget).name;
            if (name === "sampleUiGaugeAnimation-100-fill") return vector(24, 36, 0);
            return vector(100, 40, 0);
        },
        GetUIWidgetBgAlpha: () => 0,
        GetUIWidgetBgColor: () => vector(0.1, 0.12, 0.16),
        GetUIWidgetPadding: () => 8,
        GetUITextAlpha: () => 0,
        GetUITextColor: () => vector(1, 1, 1),
        GetUITextSize: () => 20,
        GetUIImageAlpha: () => 0,
        GetUIImageColor: () => vector(1, 1, 1),
        GetUIButtonAlphaBase: () => 0.4,
        GetUIButtonAlphaDisabled: () => 0.2,
        GetUIButtonAlphaPressed: () => 0.6,
        GetUIButtonAlphaHover: () => 0.7,
        GetUIButtonAlphaFocused: () => 0.8,
        GetUIButtonColorBase: () => vector(0.2, 0.2, 0.2),
        GetUIButtonColorDisabled: () => vector(0.1, 0.1, 0.1),
        GetUIButtonColorPressed: () => vector(0.4, 0.4, 0.4),
        GetUIButtonColorHover: () => vector(0.5, 0.5, 0.5),
        GetUIButtonColorFocused: () => vector(0.6, 0.6, 0.6),
        GetSoldierState: ((_player: mod.Player, soldierState: mod.SoldierStateVector | mod.SoldierStateBool) => {
            if (soldierState === mod.SoldierStateBool.IsCrouching) return soldierIsCrouching;
            return soldierState === mod.SoldierStateVector.GetFacingDirection ? vector(0, 0, 1) : vector(10, 2, 20);
        }) as typeof mod.GetSoldierState,
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
            BottomCenter: 0,
            BottomLeft: 1,
            Center: 3,
            TopLeft: 7,
            TopCenter: 6,
            TopRight: 8,
        } as typeof mod.UIAnchor,
        UIButtonEvent: {
            ButtonDown: 0,
            ButtonUp: 1,
            FocusIn: 2,
            FocusOut: 3,
            HoverIn: 4,
            HoverOut: 5,
        } as typeof mod.UIButtonEvent,
        UIBgFill: {
            Blur: 0,
            None: 5,
            Solid: 8,
        } as typeof mod.UIBgFill,
        UIDepth: {
            AboveGameUI: 0,
            BelowGameUI: 1,
        } as typeof mod.UIDepth,
        UIImageType: {
            CrownOutline: 0,
            CrownSolid: 1,
            None: 2,
            QuestionMark: 3,
            RifleAmmo: 4,
            SelfHeal: 5,
            SpawnBeacon: 6,
            TEMP_PortalIcon: 7,
        } as typeof mod.UIImageType,
        SoldierStateVector: {
            EyePosition: 0,
            GetFacingDirection: 1,
            GetLinearVelocity: 2,
            GetPosition: 3,
        } as typeof mod.SoldierStateVector,
        SoldierStateBool: {
            IsCrouching: 4,
        } as typeof mod.SoldierStateBool,
        RestrictedInputs: {
            MoveForwardBack: 0,
            MoveLeftRight: 1,
            Jump: 2,
            Prone: 3,
            FireWeapon: 4,
            Reload: 5,
        } as typeof mod.RestrictedInputs,
        Weapons: {
            AssaultRifle_M433: 4,
        } as typeof mod.Weapons,
        RuntimeSpawn_Common: {
            Crate_01_A: 60,
            FiringRange_Target_01: 61,
        } as typeof mod.RuntimeSpawn_Common,
        RuntimeSpawn_Limestone: {
            Books_01_A: 70,
            FloorPlate_01_128: 71,
        } as typeof mod.RuntimeSpawn_Limestone,
    });

    void OnPlayerJoinGame(createFake<mod.Player>());
});

describe("sample menu", () => {
    it("initializes without creating the menu when a player joins", async () => {
        await OnPlayerJoinGame(createFake<mod.Player>());

        expect(modMock.AddUIButton).not.toHaveBeenCalled();
    });

    it("creates a Portal button menu when a player deploys", async () => {
        await OnPlayerDeployed(createFake<mod.Player>());

        expect(modMock.AddUIContainer).toHaveBeenCalledWith(
            "sample-menu-100-root",
            { x: 28, y: 92, z: 0 },
            { x: 372, y: 328, z: 0 },
            7,
            expect.anything(),
            true,
            8,
            { x: 0.015, y: 0.03, z: 0.055 },
            0.86,
            8,
            0,
            expect.anything(),
        );
        expect(modMock.AddUIButton).toHaveBeenCalledTimes(13);
        expect(modMock.EnableUIInputMode).toHaveBeenCalledWith(true, expect.anything());
        expect(modMock.EnableInputRestriction).toHaveBeenCalledTimes(6);
        expect(modMock.EnableInputRestriction.mock.calls.every((call) => call[2] === true)).toBe(true);
        expect(modMock.EnableUIButtonEvent).toHaveBeenCalledWith(widgetNamed("sample-menu-100-button-ui-gauge"), 0, true);
        expect(modMock.EnableUIButtonEvent).toHaveBeenCalledWith(widgetNamed("sample-menu-100-button-ui-gauge"), 1, true);
        expect(modMock.EnableUIButtonEvent).toHaveBeenCalledTimes(26);
        expect(modMock.AddUIText).toHaveBeenCalledWith(
            "sample-menu-100-button-ui-gauge-label",
            { x: 188, y: 72, z: 0 },
            { x: 158, y: 30, z: 0 },
            7,
            widgetNamed("sample-menu-100-root"),
            true,
            0,
            { x: 0, y: 0, z: 0 },
            0,
            5,
            expect.anything(),
            13,
            { x: 1, y: 1, z: 1 },
            1,
            3,
            0,
            expect.anything(),
        );
        expect(modMock.AddUIText).toHaveBeenCalledWith(
            "sample-menu-100-guide",
            { x: 188, y: 294, z: 0 },
            { x: 158, y: 30, z: 0 },
            7,
            widgetNamed("sample-menu-100-root"),
            true,
            0,
            { x: 0, y: 0, z: 0 },
            0,
            5,
            expect.objectContaining({ msg: stringkeys.sample_menu_move_button_hint }),
            11,
            { x: 1, y: 1, z: 1 },
            1,
            3,
            0,
            expect.anything(),
        );
        expect(modMock.AddUIButton).toHaveBeenCalledWith(
            "sample-menu-100-button-move-mode",
            { x: 16, y: 292, z: 0 },
            { x: 158, y: 30, z: 0 },
            7,
            widgetNamed("sample-menu-100-root"),
            true,
            0,
            { x: 0.05, y: 0.08, z: 0.05 },
            0.5,
            8,
            true,
            { x: 0.22, y: 0.58, z: 0.22 },
            0.92,
            { x: 0.08, y: 0.08, z: 0.08 },
            0.35,
            { x: 0.18, y: 0.85, z: 0.35 },
            1,
            { x: 0.16, y: 0.75, z: 0.25 },
            1,
            { x: 0.7, y: 1, z: 0.55 },
            1,
            0,
            expect.anything(),
        );
    });

    it("runs a sample immediately from a button event", async () => {
        await OnPlayerDeployed(createFake<mod.Player>());

        await OnPlayerUIButtonEvent(
            createFake<mod.Player>(),
            widgetNamed("sample-menu-100-button-ui-gauge"),
            mod.UIButtonEvent.ButtonUp,
        );

        expect(modMock.SetUITextLabel).toHaveBeenCalledWith(widgetNamed("sample-menu-100-status"), expect.anything());
        expect(modMock.SetUIButtonColorBase).toHaveBeenCalledWith(widgetNamed("sample-menu-100-button-ui-gauge"), { x: 0.92, y: 0.62, z: 0.16 });
        expect(modMock.SetUITextColor).toHaveBeenCalledWith(widgetNamed("sample-menu-100-button-ui-gauge-label"), { x: 0, y: 0, z: 0 });
        expect(modMock.AddUIContainer).toHaveBeenCalledWith(
            "sampleUiGaugeAnimation-100-fill",
            { x: -368, y: -292, z: 0 },
            { x: 24, y: 36, z: 0 },
            3,
            expect.anything(),
            true,
            0,
            { x: 0.2, y: 0.75, z: 1 },
            0.9,
            8,
            0,
            expect.anything(),
        );
    });

    it("enters movement mode from the move UI button and returns to menu mode from crouch", async () => {
        let now = 1000;
        vi.spyOn(Date, "now").mockImplementation(() => now);
        await OnPlayerDeployed(createFake<mod.Player>());
        modMock.EnableUIInputMode.mockClear();
        modMock.EnableInputRestriction.mockClear();

        await OnPlayerUIButtonEvent(
            createFake<mod.Player>(),
            widgetNamed("sample-menu-100-button-move-mode"),
            mod.UIButtonEvent.ButtonUp,
        );

        expect(modMock.EnableUIInputMode).toHaveBeenLastCalledWith(false, expect.anything());
        expect(modMock.EnableInputRestriction).toHaveBeenCalledTimes(6);
        expect(modMock.EnableInputRestriction.mock.calls.every((call) => call[2] === false)).toBe(true);
        expect(modMock.SetUITextLabel).toHaveBeenCalledWith(widgetNamed("sample-menu-100-status"), expect.objectContaining({ msg: stringkeys.sample_status_move_mode }));

        modMock.EnableUIInputMode.mockClear();
        modMock.EnableInputRestriction.mockClear();
        now = 1400;
        soldierIsCrouching = true;

        await OngoingPlayer(createFake<mod.Player>());

        expect(modMock.EnableUIInputMode).toHaveBeenLastCalledWith(true, expect.anything());
        expect(modMock.EnableInputRestriction).toHaveBeenCalledTimes(6);
        expect(modMock.EnableInputRestriction.mock.calls.every((call) => call[2] === true)).toBe(true);
        expect(modMock.SetUITextLabel).toHaveBeenCalledWith(widgetNamed("sample-menu-100-status"), expect.objectContaining({ msg: stringkeys.sample_menu_status_idle }));
    });

    it("maintains player mode from OngoingPlayer at an interval and stops after death", async () => {
        let now = 1000;
        vi.spyOn(Date, "now").mockImplementation(() => now);

        await OnPlayerDeployed(createFake<mod.Player>());
        modMock.EnableUIInputMode.mockClear();
        modMock.EnableInputRestriction.mockClear();

        await OngoingPlayer(createFake<mod.Player>());

        expect(modMock.EnableUIInputMode).toHaveBeenLastCalledWith(true, expect.anything());
        expect(modMock.EnableInputRestriction).toHaveBeenCalledTimes(6);

        modMock.EnableUIInputMode.mockClear();
        modMock.EnableInputRestriction.mockClear();
        now = 1100;

        await OngoingPlayer(createFake<mod.Player>());

        expect(modMock.EnableUIInputMode).not.toHaveBeenCalled();
        expect(modMock.EnableInputRestriction).not.toHaveBeenCalled();

        await OnPlayerDied(
            createFake<mod.Player>(),
            createFake<mod.Player>(),
            { __test: true } as unknown as mod.DeathType,
            { __test: true } as unknown as mod.WeaponUnlock,
        );
        now = 1400;
        await OngoingPlayer(createFake<mod.Player>());

        expect(modMock.EnableUIInputMode).not.toHaveBeenCalled();
        expect(modMock.EnableInputRestriction).not.toHaveBeenCalled();
    });

    it("does not run a sample just by deploying", async () => {
        await OnPlayerDeployed(createFake<mod.Player>());

        expect(modMock.AddUIContainer).not.toHaveBeenCalledWith(
            "sampleUiGaugeAnimation-100-fill",
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything(),
        );
    });

    it("cleans up the sample menu when a player returns before deploying", async () => {
        await OnPlayerDeployed(createFake<mod.Player>());
        widgets.set("sample-menu-100-root", widgetNamed("sample-menu-100-root"));

        await OnPlayerUndeploy(createFake<mod.Player>());

        expect(modMock.DeleteUIWidget).toHaveBeenCalledWith(widgetNamed("sample-menu-100-root"));
    });

    it("accepts Portal UI button events without relying on enum identity", async () => {
        await OnPlayerUIButtonEvent(
            createFake<mod.Player>(),
            widgetNamed("sample-menu-100-button-ui-gauge"),
            mod.UIButtonEvent.HoverIn,
        );

        expect(modMock.SetUIButtonColorBase).toHaveBeenCalledWith(widgetNamed("sample-menu-100-button-ui-gauge"), { x: 0.92, y: 0.62, z: 0.16 });
    });

    it("pressing the same button again cancels the active animation", async () => {
        let now = 1000;
        vi.spyOn(Date, "now").mockImplementation(() => now);
        await OnPlayerDeployed(createFake<mod.Player>());
        modMock.Wait.mockImplementation(() => new Promise(() => undefined));

        await OnPlayerUIButtonEvent(
            createFake<mod.Player>(),
            widgetNamed("sample-menu-100-button-ui-slide"),
            mod.UIButtonEvent.ButtonUp,
        );

        const visibleCallsBeforeCancel = modMock.SetUIWidgetVisible.mock.calls.length;
        now = 1400;
        await OnPlayerUIButtonEvent(
            createFake<mod.Player>(),
            widgetNamed("sample-menu-100-button-ui-slide"),
            mod.UIButtonEvent.ButtonUp,
        );

        expect(modMock.SetUITextLabel).toHaveBeenCalledWith(widgetNamed("sample-menu-100-status"), expect.anything());
        expect(modMock.SetUIWidgetVisible.mock.calls.length).toBe(visibleCallsBeforeCancel);
    });

    it("ignores duplicate same-button events from a single Portal click", async () => {
        let now = 1000;
        vi.spyOn(Date, "now").mockImplementation(() => now);
        await OnPlayerDeployed(createFake<mod.Player>());
        modMock.Wait.mockImplementation(() => new Promise(() => undefined));

        await OnPlayerUIButtonEvent(
            createFake<mod.Player>(),
            widgetNamed("sample-menu-100-button-ui-gauge"),
            mod.UIButtonEvent.ButtonDown,
        );

        const statusCallsAfterStart = modMock.SetUITextLabel.mock.calls.length;
        const visibleCallsAfterStart = modMock.SetUIWidgetVisible.mock.calls.length;

        now = 1050;
        await OnPlayerUIButtonEvent(
            createFake<mod.Player>(),
            widgetNamed("sample-menu-100-button-ui-gauge"),
            mod.UIButtonEvent.ButtonUp,
        );

        expect(modMock.SetUITextLabel.mock.calls.length).toBe(statusCallsAfterStart);
        expect(modMock.SetUIWidgetVisible.mock.calls.length).toBe(visibleCallsAfterStart);

        await OnPlayerUndeploy(createFake<mod.Player>());
    });

    it("runs object samples with a default visible prefab", async () => {
        await OnPlayerDeployed(createFake<mod.Player>());
        modMock.Wait.mockImplementation(() => new Promise(() => undefined));

        await OnPlayerUIButtonEvent(
            createFake<mod.Player>(),
            widgetNamed("sample-menu-100-button-object-move"),
            mod.UIButtonEvent.ButtonUp,
        );

        expect(modMock.SpawnObject).toHaveBeenCalledWith(
            mod.RuntimeSpawn_Limestone.Books_01_A,
            { x: 8.8, y: 3.2, z: 23, },
            { x: 0, y: 0, z: 0 },
            { x: 1.8, y: 1.8, z: 1.8 },
        );
        expect(modMock.SetUITextLabel).toHaveBeenCalledWith(widgetNamed("sample-menu-100-status"), expect.anything());

        await OnPlayerUndeploy(createFake<mod.Player>());
    });

    it("runs the floating object sample through physics", async () => {
        await OnPlayerDeployed(createFake<mod.Player>());

        await OnPlayerUIButtonEvent(
            createFake<mod.Player>(),
            widgetNamed("sample-menu-100-button-object-float"),
            mod.UIButtonEvent.ButtonUp,
        );

        expect(modMock.SpawnObject).toHaveBeenCalledWith(
            mod.RuntimeSpawn_Limestone.Books_01_A,
            { x: 10, y: 3.35, z: 22.2 },
            { x: 0, y: 0, z: 0 },
            { x: 2.1, y: 2.1, z: 2.1 },
        );
        expect(modMock.SetObjectTransform).toHaveBeenCalled();
    });
});

describe("direct UI sample functions", () => {
    it("sampleUiGaugeAnimation creates a gauge and animates its fill", async () => {
        await sampleUiGaugeAnimation(createFake<mod.Player>());

        expect(modMock.AddUIContainer).toHaveBeenCalledWith(
            "sampleUiGaugeAnimation-100-fill",
            { x: -368, y: -292, z: 0 },
            { x: 24, y: 36, z: 0 },
            3,
            expect.anything(),
            true,
            0,
            { x: 0.2, y: 0.75, z: 1 },
            0.9,
            8,
            0,
            expect.anything(),
        );
        expect(modMock.SetUIWidgetSize).toHaveBeenCalledWith(widgetNamed("sampleUiGaugeAnimation-100-fill"), { x: 760, y: 36, z: 0 });
        expect(modMock.SetUIWidgetPosition).toHaveBeenCalledWith(widgetNamed("sampleUiGaugeAnimation-100-fill"), { x: 0, y: -292, z: 0 });
        expect(modMock.SetUIWidgetPosition).toHaveBeenCalledWith(widgetNamed("sampleUiGaugeAnimation-100-edge"), { x: 380, y: -292, z: 0 });
        expect(modMock.SetUIWidgetBgColor.mock.calls).toContainEqual([
            widgetNamed("sampleUiGaugeAnimation-100-fill"),
            { x: 0.25, y: 1, z: expect.closeTo(0.45) },
        ]);
    });

    it("sampleObjectFloatPhysics moves an object through physics", async () => {
        await sampleObjectFloatPhysics(createFake<mod.Player>(), mod.RuntimeSpawn_Common.Crate_01_A);

        expect(modMock.SetObjectTransform).toHaveBeenCalled();
    });

    it("sampleRuntimeObjectHingedBoards spawns two boards and rotates both around the hinge", async () => {
        await sampleRuntimeObjectHingedBoards(createFake<mod.Player>(), mod.RuntimeSpawn_Common.Crate_01_A, stopHingedBoardSampleAfterFirstRuntimeTick());

        expect(modMock.SpawnObject).toHaveBeenCalledTimes(5);
        expect(modMock.SpawnObject).toHaveBeenNthCalledWith(
            1,
            mod.RuntimeSpawn_Common.Crate_01_A,
            { x: expect.closeTo(6.9), y: 3, z: expect.closeTo(21.9) },
            { x: 0, y: Math.PI / 2, z: 0 },
            { x: 1, y: 1, z: 1 },
        );
        expect(modMock.SpawnObject).toHaveBeenNthCalledWith(
            2,
            mod.RuntimeSpawn_Common.Crate_01_A,
            { x: expect.closeTo(5.6), y: 3, z: expect.closeTo(21.9) },
            { x: 0, y: Math.PI / 2, z: 0 },
            { x: 1, y: 1, z: 1 },
        );
        expect(modMock.SetObjectTransform).toHaveBeenCalled();
        expect(modMock.SetObjectTransform.mock.calls.map((call) => call[0])).toContain(modMock.SpawnObject.mock.results[0].value);
        expect(modMock.SetObjectTransform.mock.calls.map((call) => call[0])).toContain(modMock.SpawnObject.mock.results[1].value);
    });

    it("sampleRuntimeObjectHingedBoards aligns visual yaw with player-relative layout", async () => {
        modMock.GetSoldierState.mockImplementation(((_player: mod.Player, soldierState: mod.SoldierStateVector | mod.SoldierStateBool) => {
            if (soldierState === mod.SoldierStateBool.IsCrouching) return soldierIsCrouching;
            return soldierState === mod.SoldierStateVector.GetFacingDirection ? vector(1, 0, 0) : vector(10, 2, 20);
        }) as typeof mod.GetSoldierState);

        await sampleRuntimeObjectHingedBoards(createFake<mod.Player>(), mod.RuntimeSpawn_Common.Crate_01_A, stopHingedBoardSampleAfterFirstRuntimeTick());

        expect(modMock.SpawnObject).toHaveBeenNthCalledWith(
            1,
            mod.RuntimeSpawn_Common.Crate_01_A,
            { x: expect.closeTo(11.9), y: 3, z: expect.closeTo(23.1) },
            { x: 0, y: Math.PI, z: 0 },
            { x: 1, y: 1, z: 1 },
        );
        expect(modMock.SpawnObject).toHaveBeenNthCalledWith(
            2,
            mod.RuntimeSpawn_Common.Crate_01_A,
            { x: expect.closeTo(11.9), y: 3, z: expect.closeTo(24.4) },
            { x: 0, y: Math.PI, z: 0 },
            { x: 1, y: 1, z: 1 },
        );
    });
});
