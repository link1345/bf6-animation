import { beforeEach, describe, expect, it, vi } from "vitest";
import { GravityBody, GravityWorld, objectGravityBody, runtimeObjectGravityBody, uiGravityBody } from "../mods/bf6-gravity";
import { uiAnimate, uiTimeline } from "../mods/bf6-ui-animation";
import { RuntimeObject, objectAnimate, objectTimeline } from "../mods/bf6-object-animation";
import { setupBfPortalMock, type BfPortalModMock } from "../test-support/bfportal-vitest-mock.generated";

type TestVector = { x: number; y: number; z: number };

let modMock: BfPortalModMock;
let widget: mod.UIWidget;
let secondWidget: mod.UIWidget;
let object: mod.Object;
let secondObject: mod.Object;
let spawnedObjects: mod.Object[];

function fakeWidget(): mod.UIWidget {
    return { __test: true } as unknown as mod.UIWidget;
}

function fakeObject(): mod.Object {
    return { __test: true } as unknown as mod.Object;
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

function messageValue(message: string | number | mod.Player): mod.Message {
    return String(message) as unknown as mod.Message;
}

beforeEach(() => {
    vi.resetAllMocks();

    widget = fakeWidget();
    secondWidget = fakeWidget();
    object = fakeObject();
    secondObject = fakeObject();
    spawnedObjects = [];

    modMock = setupBfPortalMock({
        Wait: async () => undefined,
        Add: addValue,
        CreateVector: (x: number, y: number, z: number) => vector(x, y, z),
        CreateTransform: (position: mod.Vector, rotation: mod.Vector) => ({ position, rotation }) as unknown as mod.Transform,
        DotProduct: dotVector,
        GetObjId: (target: mod.Object) => spawnedObjects.indexOf(target) + 1,
        Message: messageValue,
        Normalize: normalizeVector,
        SendErrorReport: () => undefined,
        SpawnObject: () => {
            const spawned = fakeObject();
            spawnedObjects.push(spawned);
            return spawned as mod.Any;
        },
        Subtract: subtractValue,
        UnspawnObject: () => undefined,
        XComponentOf: (value: mod.Vector) => vectorData(value).x,
        YComponentOf: (value: mod.Vector) => vectorData(value).y,
        ZComponentOf: (value: mod.Vector) => vectorData(value).z,
        GetObjectPosition: (target: mod.Object) => target === secondObject ? vector(50, 60, 70) : vector(10, 20, 30),
        GetObjectRotation: (target: mod.Object) => target === secondObject ? vector(5, 10, 15) : vector(1, 2, 3),
        GetObjectTransform: (target: mod.Object) => ({
            position: target === secondObject ? vector(50, 60, 70) : vector(10, 20, 30),
            rotation: target === secondObject ? vector(5, 10, 15) : vector(1, 2, 3),
        }) as unknown as mod.Transform,
        GetTransformPosition: (transform: mod.Transform) => (transform as unknown as { position: mod.Vector }).position,
        GetTransformRotation: (transform: mod.Transform) => (transform as unknown as { rotation: mod.Vector }).rotation,
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

describe("uiTimeline", () => {
    it("runs to, wait, and to steps in order", async () => {
        const order: string[] = [];
        modMock.SetUIWidgetBgAlpha.mockImplementation(() => order.push("first"));
        modMock.Wait.mockImplementation(async (seconds: number) => {
            if (seconds === 0.2) order.push("wait");
        });
        modMock.SetUITextAlpha.mockImplementation(() => order.push("second"));

        await uiTimeline()
            .to(widget, { bgAlpha: 1 }, { duration: 0 })
            .wait(0.2)
            .to(secondWidget, { textAlpha: 1 }, { duration: 0 })
            .play();

        expect(order).toEqual(["first", "wait", "second"]);
    });

    it("keeps unspecified vector components for position and size shorthands", async () => {
        await uiAnimate(widget).to({ x: 80, y: 120, width: 220 }, { duration: 0 });

        expect(vectorData(modMock.SetUIWidgetPosition.mock.calls[0][1])).toEqual({ x: 80, y: 120, z: 30 });
        expect(vectorData(modMock.SetUIWidgetSize.mock.calls[0][1])).toEqual({ x: 220, y: 40, z: 0 });
    });

    it("uses the last animated size as the next width tween start", async () => {
        await uiTimeline()
            .to(widget, { size: [0, 40] }, { duration: 0 })
            .to(widget, { width: 220 }, { duration: 0.2, step: 0.1, ease: "linear" })
            .play();

        const sizeCalls = modMock.SetUIWidgetSize.mock.calls.map((call) => vectorData(call[1]));
        expect(sizeCalls).toContainEqual({ x: 0, y: 40, z: 0 });
        expect(sizeCalls).toContainEqual({ x: 110, y: 40, z: 0 });
        expect(sizeCalls[sizeCalls.length - 1]).toEqual({ x: 220, y: 40, z: 0 });
    });

    it("runs multiple UI tweens in the same to step", async () => {
        await uiTimeline()
            .to([
                { target: widget, props: { x: 80 } },
                { target: secondWidget, props: { textAlpha: 1 } },
            ], { duration: 0.2, step: 0.2, ease: "linear" })
            .play();

        expect(modMock.Wait).toHaveBeenCalledTimes(1);
        expect(vectorData(modMock.SetUIWidgetPosition.mock.calls[modMock.SetUIWidgetPosition.mock.calls.length - 1][1])).toEqual({ x: 80, y: 20, z: 30 });
        expect(modMock.SetUITextAlpha).toHaveBeenLastCalledWith(secondWidget, 1);
    });

    it("routes alpha properties to the matching Portal setters", async () => {
        await uiAnimate(widget).to({
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
        await uiAnimate(widget).to({
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
        await uiAnimate(widget).to({ visible: true, bgAlpha: 1 }, { duration: 0 });
        await uiAnimate(secondWidget).to({ visible: false, bgAlpha: 0 }, { duration: 0 });

        expect(modMock.SetUIWidgetVisible.mock.calls[0]).toEqual([widget, true]);
        expect(modMock.SetUIWidgetVisible.mock.calls[modMock.SetUIWidgetVisible.mock.calls.length - 1]).toEqual([secondWidget, false]);
    });

    it("applies duration zero without waiting", async () => {
        await uiAnimate(widget).to({ textSize: 32 }, { duration: 0 });

        expect(modMock.Wait).not.toHaveBeenCalled();
        expect(modMock.SetUITextSize).toHaveBeenCalledWith(widget, 32);
    });

    it("stops before running remaining steps", async () => {
        const tl = uiTimeline();
        tl
            .to(widget, { bgAlpha: 1 }, { duration: 0 })
            .call(() => tl.stop())
            .to(secondWidget, { bgAlpha: 1 }, { duration: 0 });

        await tl.play();

        expect(modMock.SetUIWidgetBgAlpha).toHaveBeenCalledTimes(1);
        expect(modMock.SetUIWidgetBgAlpha).toHaveBeenCalledWith(widget, 1);
    });

    it("replays steps for a finite loop count", async () => {
        await uiTimeline({ loop: 3 })
            .to(widget, { bgAlpha: 1 }, { duration: 0 })
            .play();

        expect(modMock.SetUIWidgetBgAlpha).toHaveBeenCalledTimes(3);
    });

    it("can stop an infinite loop from a call step", async () => {
        const tl = uiTimeline({ loop: true });
        let cycles = 0;
        tl
            .to(widget, { bgAlpha: 1 }, { duration: 0 })
            .call(() => {
                cycles += 1;
                if (cycles === 2) tl.stop();
            });

        await tl.play();

        expect(modMock.SetUIWidgetBgAlpha).toHaveBeenCalledTimes(2);
    });

    it("runs physics as a UI timeline step", async () => {
        const world = new GravityWorld({ gravity: [0, 10, 0] })
            .add(uiGravityBody(widget));

        await uiTimeline()
            .physics(world, { step: 0.2 })
            .play();

        expect(modMock.Wait).toHaveBeenCalledWith(0.2);
        expect(vectorData(modMock.SetUIWidgetPosition.mock.calls[0][1])).toEqual({ x: 10, y: 20.4, z: 30 });
    });
});

describe("objectTimeline", () => {
    it("runs to, wait, and to steps in order", async () => {
        const order: string[] = [];
        modMock.SetObjectTransform.mockImplementation((target: mod.Object) => {
            order.push(target === object ? "first" : "second");
        });
        modMock.Wait.mockImplementation(async (seconds: number) => {
            if (seconds === 0.2) order.push("wait");
        });

        await objectTimeline()
            .to(object, { x: 100 }, { duration: 0 })
            .wait(0.2)
            .to(secondObject, { yaw: 90 }, { duration: 0 })
            .play();

        expect(order).toEqual(["first", "wait", "second"]);
    });

    it("keeps unspecified vector components for position and rotation shorthands", async () => {
        await objectAnimate(object).to({ x: 80, y: 120, yaw: 45 }, { duration: 0 });

        const firstTransform = modMock.SetObjectTransform.mock.calls[0][1] as unknown as { position: mod.Vector; rotation: mod.Vector };
        const lastTransform = modMock.SetObjectTransform.mock.calls[modMock.SetObjectTransform.mock.calls.length - 1][1] as unknown as { position: mod.Vector; rotation: mod.Vector };

        expect(vectorData(firstTransform.position)).toEqual({ x: 80, y: 120, z: 30 });
        expect(vectorData(lastTransform.rotation)).toEqual({ x: 1, y: 45, z: 3 });
    });

    it("runs multiple object tweens in the same to step", async () => {
        await objectTimeline()
            .to([
                { target: object, props: { x: 80 } },
                { target: secondObject, props: { yaw: 90 } },
            ], { duration: 0.2, step: 0.2, ease: "linear" })
            .play();

        expect(modMock.Wait).toHaveBeenCalledTimes(1);
        expect(modMock.SetObjectTransform).toHaveBeenCalledWith(object, expect.anything());
        expect(modMock.SetObjectTransform).toHaveBeenCalledWith(secondObject, expect.anything());
    });

    it("stops before running remaining steps", async () => {
        const tl = objectTimeline();
        tl
            .to(object, { x: 100 }, { duration: 0 })
            .call(() => tl.stop())
            .to(secondObject, { x: 100 }, { duration: 0 });

        await tl.play();

        expect(modMock.SetObjectTransform).toHaveBeenCalledTimes(1);
        expect(modMock.SetObjectTransform.mock.calls[0][0]).toBe(object);
    });

    it("replays steps for a finite loop count", async () => {
        await objectTimeline({ loop: 3 })
            .to(object, { x: 100 }, { duration: 0 })
            .play();

        expect(modMock.SetObjectTransform).toHaveBeenCalledTimes(3);
    });

    it("can stop an infinite loop from a call step", async () => {
        const tl = objectTimeline({ loop: true });
        let cycles = 0;
        tl
            .to(object, { x: 100 }, { duration: 0 })
            .call(() => {
                cycles += 1;
                if (cycles === 2) tl.stop();
            });

        await tl.play();

        expect(modMock.SetObjectTransform).toHaveBeenCalledTimes(2);
    });

    it("moves a runtime object through objectTimeline.to", async () => {
        const runtime = new RuntimeObject(undefined, [0, 0, 0], [0, 0, 0], [0, 1, 0], 0);

        await objectTimeline()
            .to(runtime, { moveBy: [0, 0, 9] }, { duration: 0.3, step: 0.1, ease: "linear" })
            .play();

        expect(vectorData(runtime.worldPos)).toEqual({ x: 0, y: 0, z: 9 });
        expect(modMock.Wait).toHaveBeenCalledTimes(3);
    });

    it("loops qRotateTo from absolute base state without carrying relative drift", async () => {
        const runtime = new RuntimeObject(undefined, [10, 0, 0], [0, 0, 0], [0, 1, 0], 0);
        const baseRotateTo = {
            axis: [0, 1, 0] as [number, number, number],
            baseAngle: 0,
            rotCenter: [0, 0, 0] as [number, number, number],
            baseCenter: [10, 0, 0] as [number, number, number],
        };

        await objectTimeline({ loop: 2 })
            .to(runtime, { qRotateTo: { ...baseRotateTo, fromAngle: 0, angle: 0 } }, { duration: 0 })
            .to(runtime, { qRotateTo: { ...baseRotateTo, fromAngle: 0, angle: Math.PI / 2 } }, { duration: 0 })
            .to(runtime, { qRotateTo: { ...baseRotateTo, fromAngle: Math.PI / 2, angle: 0 } }, { duration: 0 })
            .play();

        expect(vectorData(runtime.worldPos)).toEqual({ x: 10, y: 0, z: 0 });
    });

    it("qRotateTo can separate orbit angle from visual rotation angle", async () => {
        const runtime = new RuntimeObject(1 as unknown as Parameters<typeof mod.SpawnObject>[0], [10, 0, 0], [0, 0, 0], [0, 1, 0], 0);

        await objectTimeline()
            .to(runtime, {
                qRotateTo: {
                    axis: [0, 1, 0],
                    fromAngle: 0,
                    angle: Math.PI / 2,
                    fromVisualAngle: 0,
                    visualAngle: 0,
                    baseAngle: 0,
                    rotCenter: [0, 0, 0],
                    baseCenter: [10, 0, 0],
                },
            }, { duration: 0 })
            .play();

        const transform = modMock.SetObjectTransform.mock.calls[0][1] as unknown as { position: mod.Vector; rotation: mod.Vector };
        expect(vectorData(transform.position)).toEqual({ x: expect.closeTo(0), y: 0, z: expect.closeTo(-10) });
        expect(vectorData(transform.rotation)).toEqual({ x: 0, y: 0, z: 0 });
    });

    it("qRotateTo sends direct yaw euler for Y-axis visual rotations over 90 degrees", async () => {
        const runtime = new RuntimeObject(1 as unknown as Parameters<typeof mod.SpawnObject>[0], [10, 0, 0], [0, 0, 0], [0, 1, 0], 0);
        const visualYaw = Math.PI / 2 + 0.05;

        await objectTimeline()
            .to(runtime, {
                qRotateTo: {
                    axis: [0, 1, 0],
                    fromAngle: 0,
                    angle: 0,
                    fromVisualAngle: visualYaw,
                    visualAngle: visualYaw,
                    baseAngle: 0,
                    rotCenter: [0, 0, 0],
                    baseCenter: [10, 0, 0],
                },
            }, { duration: 0 })
            .play();

        const transform = modMock.SetObjectTransform.mock.calls[0][1] as unknown as { position: mod.Vector; rotation: mod.Vector };
        expect(vectorData(transform.rotation)).toEqual({ x: 0, y: visualYaw, z: 0 });
    });

    it("qRotateTo normalizes direct yaw euler before sending it to the game", async () => {
        const runtime = new RuntimeObject(1 as unknown as Parameters<typeof mod.SpawnObject>[0], [10, 0, 0], [0, 0, 0], [0, 1, 0], 0);
        const visualYaw = Math.PI * 1.5;

        await objectTimeline()
            .to(runtime, {
                qRotateTo: {
                    axis: [0, 1, 0],
                    fromAngle: 0,
                    angle: 0,
                    fromVisualAngle: visualYaw,
                    visualAngle: visualYaw,
                    baseAngle: 0,
                    rotCenter: [0, 0, 0],
                    baseCenter: [10, 0, 0],
                },
            }, { duration: 0 })
            .play();

        const transform = modMock.SetObjectTransform.mock.calls[0][1] as unknown as { position: mod.Vector; rotation: mod.Vector };
        expect(vectorData(transform.rotation)).toEqual({ x: 0, y: -Math.PI / 2, z: 0 });
    });

    it("combines parent movement with child rotation in the same runtime to step", async () => {
        const parent = new RuntimeObject(undefined, [0, 0, 0], [0, 0, 0], [0, 1, 0], 0);
        const child = parent.NewChild(undefined, [0, 0, 10], [0, 0, 0], [0, 1, 0], 0);

        await objectTimeline()
            .to([
                { target: parent, props: { moveBy: [10, 0, 0] } },
                { target: child, props: { qRotateBy: { axis: [0, 1, 0], angle: Math.PI / 2 } } },
            ], { duration: 0 })
            .play();

        expect(vectorData(parent.worldPos)).toEqual({ x: 10, y: 0, z: 0 });
        expect(vectorData(child.worldPos)).toEqual({ x: 10, y: 0, z: 10 });
    });

    it("removes runtime object children recursively", () => {
        const parent = new RuntimeObject(1 as unknown as Parameters<typeof mod.SpawnObject>[0], [0, 0, 0], [0, 0, 0], [0, 1, 0], 0);
        parent.NewChild(1 as unknown as Parameters<typeof mod.SpawnObject>[0], [0, 0, 10], [0, 0, 0], [0, 1, 0], 0);

        parent.Remove();

        expect(modMock.UnspawnObject).toHaveBeenCalledTimes(2);
        expect(parent.children.size).toBe(0);
    });

    it("runs physics as an object timeline step", async () => {
        const world = new GravityWorld({ gravity: [0, -10, 0] })
            .add(objectGravityBody(object, { velocity: [0, 2, 0] }));

        await objectTimeline()
            .physics(world, { step: 0.5 })
            .play();

        const transform = modMock.SetObjectTransform.mock.calls[0][1] as unknown as { position: mod.Vector; rotation: mod.Vector };
        expect(modMock.Wait).toHaveBeenCalledWith(0.5);
        expect(vectorData(transform.position)).toEqual({ x: 10, y: 18.5, z: 30 });
    });

    it("runs object timeline physics over duration", async () => {
        const world = new GravityWorld({ gravity: [0, -10, 0] })
            .add(objectGravityBody(object));

        await objectTimeline()
            .physics(world, { duration: 0.3, step: 0.1 })
            .play();

        expect(modMock.Wait).toHaveBeenCalledTimes(3);
        expect(modMock.SetObjectTransform).toHaveBeenCalledTimes(3);
    });
});

describe("GravityWorld", () => {
    it("steps custom gravity bodies with velocity plus gravity", () => {
        let position = vector(0, 10, 0);
        const body = new GravityBody({
            getPosition: () => position,
            setPosition: (next) => {
                position = next;
            },
        }, { velocity: [2, 0, 0] });
        const world = new GravityWorld({ gravity: [0, -10, 0] }).add(body);

        world.step(0.5);

        expect(vectorData(position)).toEqual({ x: 1, y: 7.5, z: 0 });
        expect(vectorData(body.velocity)).toEqual({ x: 2, y: -5, z: 0 });
    });

    it("updates multiple UI bodies in one world step", () => {
        const world = new GravityWorld({ gravity: [0, 10, 0] })
            .add(uiGravityBody(widget))
            .add(uiGravityBody(secondWidget, { velocity: [1, 0, 0] }));

        world.step(0.2);

        expect(vectorData(modMock.SetUIWidgetPosition.mock.calls[0][1])).toEqual({ x: 10, y: 20.4, z: 30 });
        expect(vectorData(modMock.SetUIWidgetPosition.mock.calls[1][1])).toEqual({ x: 50.2, y: 60.4, z: 0 });
    });

    it("updates object bodies while preserving current rotation", () => {
        const world = new GravityWorld({ gravity: [0, -10, 0] })
            .add(objectGravityBody(object, { velocity: [0, 2, 0] }));

        world.step(0.5);

        const transform = modMock.SetObjectTransform.mock.calls[0][1] as unknown as { position: mod.Vector; rotation: mod.Vector };
        expect(vectorData(transform.position)).toEqual({ x: 10, y: 18.5, z: 30 });
        expect(vectorData(transform.rotation)).toEqual({ x: 1, y: 2, z: 3 });
    });

    it("updates runtime object bodies through Move and ApplyTransform", () => {
        const runtime = new RuntimeObject(undefined, [0, 10, 0], [0, 0, 0], [0, 1, 0], 0);
        const world = new GravityWorld({ gravity: [0, -10, 0] })
            .add(runtimeObjectGravityBody(runtime, { velocity: [0, 2, 0] }));

        world.step(0.5);

        expect(vectorData(runtime.worldPos)).toEqual({ x: 0, y: 8.5, z: 0 });
    });

    it("clamps bodies at groundY and clears downward velocity", () => {
        let position = vector(0, 1, 0);
        const body = new GravityBody({
            getPosition: () => position,
            setPosition: (next) => {
                position = next;
            },
        }, { velocity: [0, -20, 0], groundY: 0 });
        const world = new GravityWorld({ gravity: [0, -10, 0] }).add(body);

        world.step(0.5);

        expect(vectorData(position)).toEqual({ x: 0, y: 0, z: 0 });
        expect(vectorData(body.velocity)).toEqual({ x: 0, y: 0, z: 0 });
    });
});
