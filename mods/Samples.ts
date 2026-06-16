import { GravityWorld, objectGravityBody, runtimeObjectGravityBody, uiGravityBody } from "./bf6-gravity";
import { RuntimeObject, RuntimeObjectPrefab, objectTimeline } from "./bf6-object-animation";
import { type VectorLike } from "./bf6-easings";
import { uiTimeline, type TweenProps, type UITimelineItem } from "./bf6-ui-animation";

// Prefab type used by the object sample functions.
type SampleObjectPrefab = RuntimeObjectPrefab;

// Cancellation hooks passed from the menu controller into each sample.
export interface SampleAnimationControl {
    // Returns true after the sample has been canceled.
    isCanceled(): boolean;
    // Registers cleanup work to run when the sample is canceled.
    onCancel(stop: () => void): void;
}

// Returns a stable numeric id for a player.
function samplePlayerId(eventPlayer: mod.Player): number {
    return mod.GetObjId(eventPlayer);
}

// Creates a mod.Vector with a default Z coordinate of zero.
export function v(x: number, y: number, z = 0): mod.Vector {
    return mod.CreateVector(x, y, z);
}

// Creates a typed UI timeline item so TypeScript selects the multi-target overload.
function uiItem(target: mod.UIWidget, props: TweenProps): UITimelineItem {
    return { target, props };
}

// Calculates a point relative to the player using right/up/forward offsets.
function sampleObjectPoint(eventPlayer: mod.Player, right: number, up: number, forward: number): mod.Vector {
    // Current soldier position.
    const position = mod.GetSoldierState(eventPlayer, mod.SoldierStateVector.GetPosition);
    // Current facing direction.
    const facing = mod.GetSoldierState(eventPlayer, mod.SoldierStateVector.GetFacingDirection);
    // Facing X component projected onto the ground plane.
    const facingX = mod.XComponentOf(facing);
    // Facing Z component projected onto the ground plane.
    const facingZ = mod.ZComponentOf(facing);
    // Horizontal facing vector length.
    const facingLength = Math.sqrt(facingX * facingX + facingZ * facingZ);
    // Normalized forward X component with a fallback when the facing vector is too small.
    const forwardX = facingLength > 0.001 ? facingX / facingLength : 0;
    // Normalized forward Z component with a fallback when the facing vector is too small.
    const forwardZ = facingLength > 0.001 ? facingZ / facingLength : 1;
    // Right-vector X component derived from forward.
    const rightX = forwardZ;
    // Right-vector Z component derived from forward.
    const rightZ = -forwardX;

    return v(
        mod.XComponentOf(position) + rightX * right + forwardX * forward,
        mod.YComponentOf(position) + up,
        mod.ZComponentOf(position) + rightZ * right + forwardZ * forward,
    );
}

// Returns a player-relative point as a tuple for VectorLike APIs.
function sampleObjectPointArray(eventPlayer: mod.Player, right: number, up: number, forward: number): [number, number, number] {
    // Vector position before tuple conversion.
    const point = sampleObjectPoint(eventPlayer, right, up, forward);
    return [mod.XComponentOf(point), mod.YComponentOf(point), mod.ZComponentOf(point)];
}

// Formats a VectorLike value for compact Portal logs.
function sampleVectorLog(value: VectorLike): string {
    const point: mod.Vector = Array.isArray(value) ? v(value[0], value[1], value.length > 2 ? value[2] : 0) : value as mod.Vector;
    return `${mod.XComponentOf(point)},${mod.YComponentOf(point)},${mod.ZComponentOf(point)}`;
}

// Raises a tuple point so debug markers remain visible above flat objects.
function sampleRaisePoint(value: [number, number, number], up: number): [number, number, number] {
    return [value[0], value[1] + up, value[2]];
}

// Deletes a UI widget by name when it exists.
function removeWidget(name: string): void {
    if (mod.HasUIWidgetWithName(name)) {
        mod.DeleteUIWidget(mod.FindUIWidgetWithName(name));
    }
}

// Deletes multiple UI widgets by name.
function resetWidgets(names: readonly string[]): void {
    for (const name of names) {
        removeWidget(name);
    }
}

// Finds a widget globally or under a parent widget.
export function findWidget(name: string, parent?: mod.UIWidget): mod.UIWidget {
    return parent === undefined ? mod.FindUIWidgetWithName(name) : mod.FindUIWidgetWithName(name, parent);
}

// Adds a shared sample panel container.
function addPanel(name: string, position: mod.Vector, size: mod.Vector, anchor: mod.UIAnchor, eventPlayer: mod.Player, visible = false): mod.UIWidget {
    mod.AddUIContainer(
        name,
        position,
        size,
        anchor,
        mod.GetUIRoot(),
        visible,
        6,
        v(0.02, 0.04, 0.07),
        visible ? 0.86 : 0,
        mod.UIBgFill.Solid,
        mod.UIDepth.AboveGameUI,
        eventPlayer,
    );
    return findWidget(name);
}

// Adds centered text to a parent widget.
function addText(name: string, parent: mod.UIWidget, messageKey: string, position: mod.Vector, size: mod.Vector, textSize: number, eventPlayer: mod.Player): mod.UIWidget {
    mod.AddUIText(
        name,
        position,
        size,
        mod.UIAnchor.Center,
        parent,
        true,
        0,
        v(0, 0, 0),
        0,
        mod.UIBgFill.None,
        mod.Message(messageKey),
        textSize,
        v(1, 1, 1),
        0,
        mod.UIAnchor.Center,
        mod.UIDepth.AboveGameUI,
        eventPlayer,
    );
    return findWidget(name, parent);
}

// Spawns a sample object when a prefab is available.
function spawnSampleObject(prefab: SampleObjectPrefab | undefined, position: mod.Vector, rotation: mod.Vector, scale: mod.Vector): mod.Object | undefined {
    if (prefab === undefined) {
        console.log("LOG> BF6 animation object sample skipped. Pass a RuntimeSpawn prefab to run this sample.");
        return undefined;
    }

    return mod.SpawnObject(prefab, position, rotation, scale) as mod.Object;
}

// Demonstrates object position tweening through several player-relative points.
export async function sampleObjectMove(eventPlayer: mod.Player, prefab?: SampleObjectPrefab, control?: SampleAnimationControl): Promise<void> {
    // Player id used in logs.
    const playerId = samplePlayerId(eventPlayer);
    console.log("LOG> sampleObjectMove:", playerId);

    // Object being animated by the sample.
    const object = spawnSampleObject(prefab, sampleObjectPoint(eventPlayer, -1.2, 1.2, 3), v(0, 0, 0), v(1.8, 1.8, 1.8));
    if (!object || control?.isCanceled()) return;

    // Timeline that moves the object between three positions.
    const timeline = objectTimeline()
        .to(object, { position: sampleObjectPointArray(eventPlayer, 1.2, 2, 3) }, { duration: 0.45, ease: "outCubic" })
        .to(object, { position: sampleObjectPointArray(eventPlayer, -1.2, 2, 3.8) }, { duration: 0.45, ease: "inOutCubic" })
        .to(object, { position: sampleObjectPointArray(eventPlayer, 0, 1.2, 3) }, { duration: 0.45, ease: "outBack" });
    control?.onCancel(() => timeline.stop());
    await timeline.play();
}

// Demonstrates object rotation tweening with pitch, yaw, roll, and full rotation.
export async function sampleObjectRotate(eventPlayer: mod.Player, prefab?: SampleObjectPrefab, control?: SampleAnimationControl): Promise<void> {
    // Player id used in logs.
    const playerId = samplePlayerId(eventPlayer);
    console.log("LOG> sampleObjectRotate:", playerId);

    // Object being rotated by the sample.
    const object = spawnSampleObject(prefab, sampleObjectPoint(eventPlayer, 0, 1.4, 3), v(0, 0, 0), v(1.9, 1.9, 1.9));
    if (!object || control?.isCanceled()) return;

    // Timeline that applies several rotation styles.
    const timeline = objectTimeline()
        .to(object, { yaw: Math.PI / 2 }, { duration: 0.4, ease: "outCubic" })
        .to(object, { pitch: Math.PI / 5, roll: -Math.PI / 8 }, { duration: 0.4, ease: "inOutCubic" })
        .to(object, { rotation: [0, Math.PI * 2, 0] }, { duration: 0.6, ease: "linear" });
    control?.onCancel(() => timeline.stop());
    await timeline.play();
}

// Demonstrates RuntimeObject parent-child movement and child rotation.
export async function sampleRuntimeObjectParentChild(eventPlayer: mod.Player, prefab?: SampleObjectPrefab, control?: SampleAnimationControl): Promise<void> {
    // Player id used in logs.
    const playerId = samplePlayerId(eventPlayer);
    console.log("LOG> sampleRuntimeObjectParentChild:", playerId);

    if (prefab === undefined || control?.isCanceled()) {
        console.log("LOG> RuntimeObject sample skipped. Pass a RuntimeSpawn prefab to spawn parent and child objects.");
        return;
    }

    // Parent RuntimeObject that controls the child transform space.
    const parent = new RuntimeObject(prefab, sampleObjectPointArray(eventPlayer, 0, 1.2, 3.2), [0, 0, 0], [0, 1, 0], 0, [1.8, 1.8, 1.8]);
    // Child RuntimeObject attached to the parent.
    const child = parent.NewChild(prefab, [0, 0.25, 1.4], [0, 0, 0], [0, 1, 0], 0, [0.9, 0.9, 0.9]);

    // Timeline that moves the parent while rotating the child.
    const timeline = objectTimeline()
        .to([
            { target: parent, props: { moveBy: [0, 0, 1.2] } },
            { target: child, props: { qRotateBy: { axis: [0, 1, 0], angle: Math.PI * 2 } } },
        ], { duration: 1.2, ease: "inOutCubic" })
        .to(parent, { qRotateBy: { axis: [0, 1, 0], angle: Math.PI } }, { duration: 0.8, ease: "outCubic" });
    control?.onCancel(() => timeline.stop());
    await timeline.play();
}

// Demonstrates two flat boards where the right board rotates around the left-center of the first board.
export async function sampleRuntimeObjectHingedBoards(eventPlayer: mod.Player, prefab?: SampleObjectPrefab, control?: SampleAnimationControl): Promise<void> {
    // Player id used in logs.
    const playerId = samplePlayerId(eventPlayer);
    console.log("LOG> sampleRuntimeObjectHingedBoards:", playerId);

    if (prefab === undefined || control?.isCanceled()) {
        console.log("LOG> Hinged board sample skipped. Pass a RuntimeSpawn prefab to spawn the boards.");
        return;
    }

    // WARNING: This hinge sample is calibrated for scale 1 only.
    // BF6 does not expose the prefab's mesh dimensions or visual pivot here, so non-1 scale can make the visual board drift from the calculated hinge/origin path.
    const boardScale = 1;
    const baseHingeRight = -1.8;
    const baseBoardOriginGapRight = 1.3;
    const boardUp = 1;
    const boardForward = 3.2;
    const boardScaleVector: [number, number, number] = [boardScale, boardScale, boardScale];
    const boardOriginSpan = baseBoardOriginGapRight * boardScale;
    const boardMeshOriginOffset: [number, number, number] = [boardOriginSpan, 0, 0];
    const firstOriginRight = baseHingeRight - boardOriginSpan;
    const secondOriginRight = baseHingeRight - boardOriginSpan * 2;
    const boardRotationAxis: [number, number, number] = [0, 1, 0];
    const boardVisualYawOffset = Math.PI / 2;
    const facing = mod.GetSoldierState(eventPlayer, mod.SoldierStateVector.GetFacingDirection);
    const facingX = mod.XComponentOf(facing);
    const facingZ = mod.ZComponentOf(facing);
    const facingLength = Math.sqrt(facingX * facingX + facingZ * facingZ);
    const boardYaw = facingLength > 0.001 ? Math.atan2(facingX / facingLength, facingZ / facingLength) : 0;

    // FloorPlate appears to use a right-side corner/edge origin, so place origins at each board's right edge.
    const hinge = sampleObjectPointArray(eventPlayer, baseHingeRight, boardUp, boardForward);
    const firstOrigin = sampleObjectPointArray(eventPlayer, firstOriginRight, boardUp, boardForward);
    const secondOrigin = sampleObjectPointArray(eventPlayer, secondOriginRight, boardUp, boardForward);
    const closedAngle = 0;
    const openAngle = Math.PI / 2;
    const visualClosedAngle = boardYaw + boardVisualYawOffset;
    const visualOpenAngle = boardYaw + boardVisualYawOffset + openAngle;
    const markerVisualClosedAngle = visualClosedAngle - Math.PI / 2;
    const markerVisualOpenAngle = visualOpenAngle - Math.PI / 2;
    const firstRotateToBase = { axis: boardRotationAxis, baseAngle: closedAngle, rotCenter: hinge, baseCenter: firstOrigin };
    const secondRotateToBase = { axis: boardRotationAxis, baseAngle: closedAngle, rotCenter: hinge, baseCenter: secondOrigin };
    const markerUp = 1.35;
    const markerHinge = sampleRaisePoint(hinge, markerUp);
    const markerFirstOrigin = sampleRaisePoint(firstOrigin, markerUp);
    const markerSecondOrigin = sampleRaisePoint(secondOrigin, markerUp);
    const firstMarkerRotateToBase = { axis: boardRotationAxis, baseAngle: closedAngle, rotCenter: markerHinge, baseCenter: markerFirstOrigin };
    const secondMarkerRotateToBase = { axis: boardRotationAxis, baseAngle: closedAngle, rotCenter: markerHinge, baseCenter: markerSecondOrigin };

    console.log(
        "LOG> hinged-layout",
        "yaw", boardYaw,
        "hinge", sampleVectorLog(hinge),
        "firstOrigin", sampleVectorLog(firstOrigin),
        "secondOrigin", sampleVectorLog(secondOrigin),
        "span", boardOriginSpan,
        "meshOffset", sampleVectorLog(boardMeshOriginOffset),
        "visualOffset", boardVisualYawOffset,
        "visualClosed", visualClosedAngle,
        "visualOpen", visualOpenAngle,
        "markerVisualClosed", markerVisualClosedAngle,
        "markerVisualOpen", markerVisualOpenAngle,
        "markerHinge", sampleVectorLog(markerHinge),
        "markerFirst", sampleVectorLog(markerFirstOrigin),
        "markerSecond", sampleVectorLog(markerSecondOrigin),
    );

    const firstBoard = new RuntimeObject(prefab, firstOrigin, boardMeshOriginOffset, boardRotationAxis, visualClosedAngle, boardScaleVector);
    const secondBoard = new RuntimeObject(prefab, secondOrigin, boardMeshOriginOffset, boardRotationAxis, visualClosedAngle, boardScaleVector);
    const markerPrefab = mod.RuntimeSpawn_Common.FiringRange_Target_01;
    const hingeMarker = new RuntimeObject(markerPrefab, markerHinge, [0, 0, 0], boardRotationAxis, markerVisualClosedAngle, [0.2, 0.2, 0.2]);
    const firstOriginMarker = new RuntimeObject(markerPrefab, markerFirstOrigin, [0, 0, 0], boardRotationAxis, markerVisualClosedAngle, [0.25, 0.25, 0.25]);
    const secondOriginMarker = new RuntimeObject(markerPrefab, markerSecondOrigin, [0, 0, 0], boardRotationAxis, markerVisualClosedAngle, [0.3, 0.3, 0.3]);

    // Timeline uses absolute target states so looped playback does not accumulate relative rotation drift.
    const timeline = objectTimeline({ loop: true })
        .to([
            { target: firstBoard, props: { qRotateTo: { ...firstRotateToBase, fromAngle: closedAngle, angle: closedAngle, fromVisualAngle: visualClosedAngle, visualAngle: visualClosedAngle, debugName: "hinge-first-close" } } },
            { target: secondBoard, props: { qRotateTo: { ...secondRotateToBase, fromAngle: closedAngle, angle: closedAngle, fromVisualAngle: visualClosedAngle, visualAngle: visualClosedAngle, debugName: "hinge-second-close" } } },
            { target: firstOriginMarker, props: { qRotateTo: { ...firstMarkerRotateToBase, fromAngle: closedAngle, angle: closedAngle, fromVisualAngle: markerVisualClosedAngle, visualAngle: markerVisualClosedAngle, debugName: "marker-first-close" } } },
            { target: secondOriginMarker, props: { qRotateTo: { ...secondMarkerRotateToBase, fromAngle: closedAngle, angle: closedAngle, fromVisualAngle: markerVisualClosedAngle, visualAngle: markerVisualClosedAngle, debugName: "marker-second-close" } } },
        ], { duration: 0 })
        .wait(4)
        .to([
            { target: firstBoard, props: { qRotateTo: { ...firstRotateToBase, fromAngle: closedAngle, angle: openAngle, fromVisualAngle: visualClosedAngle, visualAngle: visualOpenAngle, debugName: "hinge-first-open" } } },
            { target: secondBoard, props: { qRotateTo: { ...secondRotateToBase, fromAngle: closedAngle, angle: openAngle, fromVisualAngle: visualClosedAngle, visualAngle: visualOpenAngle, debugName: "hinge-second-open" } } },
            { target: firstOriginMarker, props: { qRotateTo: { ...firstMarkerRotateToBase, fromAngle: closedAngle, angle: openAngle, fromVisualAngle: markerVisualClosedAngle, visualAngle: markerVisualOpenAngle, debugName: "marker-first-open" } } },
            { target: secondOriginMarker, props: { qRotateTo: { ...secondMarkerRotateToBase, fromAngle: closedAngle, angle: openAngle, fromVisualAngle: markerVisualClosedAngle, visualAngle: markerVisualOpenAngle, debugName: "marker-second-open" } } },
        ], { duration: 1.2, ease: "inOutCubic", step: 1 / 20 })
        .wait(6)
        .to([
            { target: firstBoard, props: { qRotateTo: { ...firstRotateToBase, fromAngle: openAngle, angle: closedAngle, fromVisualAngle: visualOpenAngle, visualAngle: visualClosedAngle, debugName: "hinge-first-return" } } },
            { target: secondBoard, props: { qRotateTo: { ...secondRotateToBase, fromAngle: openAngle, angle: closedAngle, fromVisualAngle: visualOpenAngle, visualAngle: visualClosedAngle, debugName: "hinge-second-return" } } },
            { target: firstOriginMarker, props: { qRotateTo: { ...firstMarkerRotateToBase, fromAngle: openAngle, angle: closedAngle, fromVisualAngle: markerVisualOpenAngle, visualAngle: markerVisualClosedAngle, debugName: "marker-first-return" } } },
            { target: secondOriginMarker, props: { qRotateTo: { ...secondMarkerRotateToBase, fromAngle: openAngle, angle: closedAngle, fromVisualAngle: markerVisualOpenAngle, visualAngle: markerVisualClosedAngle, debugName: "marker-second-return" } } },
        ], { duration: 1.0, ease: "inOutCubic", step: 1 / 20 });
    control?.onCancel(() => {
        timeline.stop();
        firstBoard.Remove();
        secondBoard.Remove();
        hingeMarker.Remove();
        firstOriginMarker.Remove();
        secondOriginMarker.Remove();
    });
    await timeline.play();
}

// Demonstrates object movement across multiple points with waits between segments.
export async function sampleObjectMultiPointMove(eventPlayer: mod.Player, prefab?: SampleObjectPrefab, control?: SampleAnimationControl): Promise<void> {
    // Player id used in logs.
    const playerId = samplePlayerId(eventPlayer);
    console.log("LOG> sampleObjectMultiPointMove:", playerId);

    // Object being moved through multiple points.
    const object = spawnSampleObject(prefab, sampleObjectPoint(eventPlayer, -1.8, 1.1, 3.2), v(0, 0, 0), v(1.8, 1.8, 1.8));
    if (!object || control?.isCanceled()) return;

    // Timeline that moves the object through a short path.
    const timeline = objectTimeline()
        .to(object, { position: sampleObjectPointArray(eventPlayer, -0.7, 2.8, 3.2) }, { duration: 0.35, ease: "outCubic" })
        .wait(0.1)
        .to(object, { position: sampleObjectPointArray(eventPlayer, 0.7, 1.7, 2.7) }, { duration: 0.35, ease: "inOutCubic" })
        .wait(0.1)
        .to(object, { position: sampleObjectPointArray(eventPlayer, 1.8, 3.4, 3.7) }, { duration: 0.35, ease: "outBack" })
        .to(object, { position: sampleObjectPointArray(eventPlayer, 0, 1.2, 3.2) }, { duration: 0.5, ease: "inOutCubic" });
    control?.onCancel(() => timeline.stop());
    await timeline.play();
}

// Demonstrates a sliding UI notification animation.
export async function sampleUiSlideNotification(eventPlayer: mod.Player, control?: SampleAnimationControl): Promise<void> {
    // Player id used to make widget names unique.
    const playerId = samplePlayerId(eventPlayer);
    // Panel widget name.
    const panelName = `sampleUiSlideNotification-${playerId}-panel`;
    // Accent bar widget name.
    const accentName = `sampleUiSlideNotification-${playerId}-accent`;
    // Title text widget name.
    const titleName = `sampleUiSlideNotification-${playerId}-title`;

    resetWidgets([panelName]);

    // Notification panel container.
    const panel = addPanel(panelName, v(-820, 64), v(720, 164), mod.UIAnchor.TopRight, eventPlayer);
    mod.AddUIContainer(accentName, v(0, 0), v(0, 10), mod.UIAnchor.TopLeft, panel, false, 0, v(0.1, 0.85, 1), 0, mod.UIBgFill.Solid, eventPlayer);
    // Accent bar widget.
    const accent = findWidget(accentName, panel);
    // Title text widget.
    const title = addText(titleName, panel, mod.stringkeys.sample_ui_slide_title, v(36, 14), v(648, 136), 36, eventPlayer);

    if (control?.isCanceled()) return;
    // Timeline that slides the panel in, expands the accent, then hides it.
    const timeline = uiTimeline()
        .to(panel, { visible: true, x: 34, bgAlpha: 0.9 }, { duration: 0.25, ease: "outCubic" })
        .to(accent, { visible: true, width: 720, bgAlpha: 1 }, { duration: 0.18, ease: "outCubic" })
        .to(title, { textAlpha: 1, textSize: 50 }, { duration: 0.2, ease: "outBack" })
        .wait(1.2)
        .to(title, { textAlpha: 0 }, { duration: 0.12, ease: "inCubic" })
        .to(panel, { x: -820, bgAlpha: 0, visible: false }, { duration: 0.22, ease: "inCubic" });
    control?.onCancel(() => timeline.stop());
    await timeline.play();
}

// Demonstrates a UI gauge fill animation.
export async function sampleUiGaugeAnimation(eventPlayer: mod.Player, control?: SampleAnimationControl): Promise<void> {
    // Player id used to make widget names unique.
    const playerId = samplePlayerId(eventPlayer);
    // Panel widget name.
    const panelName = `sampleUiGaugeAnimation-${playerId}-panel`;
    // Gauge track widget name.
    const trackName = `sampleUiGaugeAnimation-${playerId}-track`;
    // Gauge fill widget name.
    const fillName = `sampleUiGaugeAnimation-${playerId}-fill`;
    // Bright leading edge widget name.
    const edgeName = `sampleUiGaugeAnimation-${playerId}-edge`;
    // Label text widget name.
    const labelName = `sampleUiGaugeAnimation-${playerId}-label`;

    resetWidgets([panelName, trackName, fillName, edgeName, labelName]);

    // Root-level gauge background. Center anchoring matches Portal's size animation behavior.
    mod.AddUIContainer(panelName, v(0, -330), v(860, 168), mod.UIAnchor.Center, mod.GetUIRoot(), true, 8, v(0.02, 0.04, 0.07), 0.86, mod.UIBgFill.Solid, mod.UIDepth.AboveGameUI, eventPlayer);

    // Track behind the fill bar.
    mod.AddUIContainer(trackName, v(0, -292), v(760, 36), mod.UIAnchor.Center, mod.GetUIRoot(), true, 6, v(0.16, 0.2, 0.23), 0.92, mod.UIBgFill.Solid, mod.UIDepth.AboveGameUI, eventPlayer);
    // Fill bar. Its center X moves as width changes so the left edge appears fixed.
    mod.AddUIContainer(fillName, v(-368, -292), v(24, 36), mod.UIAnchor.Center, mod.GetUIRoot(), true, 0, v(0.2, 0.75, 1), 0.9, mod.UIBgFill.Solid, mod.UIDepth.AboveGameUI, eventPlayer);
    // Bright marker at the current fill edge.
    mod.AddUIContainer(edgeName, v(-356, -292), v(14, 58), mod.UIAnchor.Center, mod.GetUIRoot(), true, 0, v(1, 1, 1), 0.95, mod.UIBgFill.Solid, mod.UIDepth.AboveGameUI, eventPlayer);
    // Gauge label text widget.// Gauge label text widget.
    mod.AddUIText(labelName, v(0, -358), v(760, 54), mod.UIAnchor.Center, mod.GetUIRoot(), true, 0, v(0, 0, 0), 0, mod.UIBgFill.None, mod.Message(mod.stringkeys.sample_ui_gauge_label), 38, v(1, 1, 1), 0, mod.UIAnchor.Center, mod.UIDepth.AboveGameUI, eventPlayer);

    // Gauge label text widget.
    const panel = findWidget(panelName);
    // Gauge label text widget.
    const label = findWidget(labelName);
    // Gauge fill widget.
    const fill = findWidget(fillName);
    // Bright leading edge widget.
    const edge = findWidget(edgeName);
    // Bright leading track widget.
    const track = findWidget(trackName);

    if (control?.isCanceled()) return;
    // Timeline that grows the bar while keeping its left side visually anchored.
    const timeline = uiTimeline()
        .to([
            uiItem(panel, { position: [0, -330, 0], bgAlpha: 0.86, visible: true }),
            uiItem(fill, { position: [-368, -292, 0], size: [24, 36], bgAlpha: 0.9, bgColor: [0.2, 0.75, 1] }),
            uiItem(edge, { position: [-356, -292, 0], bgAlpha: 0.95, bgColor: [1, 1, 1] }),
        ], { duration: 0 })
        .to(panel, { y: -314, bgAlpha: 0.9 }, { duration: 0.18, ease: "outCubic" })
        .to(label, { textAlpha: 1, textSize: 42 }, { duration: 0.16, ease: "outBack" })
        .to([
            uiItem(fill, { position: [-250, -292, 0], size: [260, 36], bgColor: [0.2, 0.75, 1], bgAlpha: 0.95 }),
            uiItem(edge, { x: -120, bgColor: [0.65, 0.95, 1], bgAlpha: 1 }),
        ], { duration: 0.32, ease: "outCubic" })
        .to([
            uiItem(fill, { position: [-110, -292, 0], size: [540, 36], bgColor: [0.95, 0.82, 0.2], bgAlpha: 0.98 }),
            uiItem(edge, { x: 160, bgColor: [1, 0.92, 0.3] }),
        ], { duration: 0.38, ease: "inOutCubic" })
        .to([
            uiItem(fill, { position: [-165, -292, 0], size: [430, 36], bgColor: [1, 0.38, 0.22] }),
            uiItem(edge, { x: 50, bgColor: [1, 0.55, 0.35] }),
        ], { duration: 0.2, ease: "inCubic" })
        .to([
            uiItem(fill, { position: [0, -292, 0], size: [760, 36], bgColor: [0.25, 1, 0.45], bgAlpha: 1 }),
            uiItem(edge, { x: 380, bgColor: [0.72, 1, 0.82] }),
            uiItem(label, { textColor: [0.25, 1, 0.72], textSize: 46 }),
        ], { duration: 0.34, ease: "outBack" })
        .to([
            uiItem(fill, { bgAlpha: 0.78 }),
            uiItem(edge, { bgAlpha: 0.72 }),
        ], { duration: 0.22, ease: "outCubic" })
        .wait(1)
        .to([
            uiItem(panel, { y: -350, bgAlpha: 0, visible: false }),
            uiItem(fill, { bgAlpha: 0, visible: false }),
            uiItem(edge, { bgAlpha: 0, visible: false }),
            uiItem(label, { textAlpha: 0, visible: false }),
            uiItem(track, { bgAlpha: 0, visible: false }),
        ], { duration: 0.25, ease: "inCubic" });
    control?.onCancel(() => timeline.stop());
    await timeline.play();
}

// Demonstrates UIWidget movement driven by GravityWorld physics.
export async function sampleUiGravityBounce(eventPlayer: mod.Player, control?: SampleAnimationControl): Promise<void> {
    // Player id used to make widget names unique.
    const playerId = samplePlayerId(eventPlayer);
    // Icon image widget name.
    const iconName = `sampleUiGravityBounce-${playerId}-icon`;
    // Shadow widget name.
    const shadowName = `sampleUiGravityBounce-${playerId}-shadow`;

    resetWidgets([iconName, shadowName]);

    mod.AddUIImage(iconName, v(-260, -430), v(108, 108), mod.UIAnchor.Center, mod.GetUIRoot(), true, 0, v(0, 0, 0), 0, mod.UIBgFill.None, mod.UIImageType.QuestionMark, v(0.1, 0.85, 1), 1, eventPlayer);
    mod.AddUIContainer(shadowName, v(-234, 178), v(56, 8), mod.UIAnchor.Center, mod.GetUIRoot(), true, 0, v(0, 0, 0), 0.25, mod.UIBgFill.Solid, eventPlayer);

    // Icon widget affected by gravity.
    const icon = findWidget(iconName);
    // Shadow widget animated separately after the bounce.
    const shadow = findWidget(shadowName);
    // Gravity world that moves the icon downward until it reaches groundY.
    const gravity = new GravityWorld({ gravity: [0, 920, 0] })
        .add(uiGravityBody(icon, { velocity: [260, -180, 0], groundY: 170 }));

    if (control?.isCanceled()) return;
    // Timeline that runs physics, expands the shadow, and fades both widgets out.
    const timeline = uiTimeline()
        .to(shadow, { bgAlpha: 0.12, width: 24 }, { duration: 0 })
        .physics(gravity, { duration: 1.05, step: 1 / 15 })
        .to(shadow, { bgAlpha: 0.4, width: 128 }, { duration: 0.16, ease: "outCubic" })
        .wait(0.6)
        .to([
            { target: icon, props: { imageAlpha: 0, visible: false } },
            { target: shadow, props: { bgAlpha: 0, visible: false } },
        ], { duration: 0.2, ease: "inCubic" });
    control?.onCancel(() => timeline.stop());
    await timeline.play();
}

// Demonstrates a round-change announcement UI animation.
export async function sampleRoundChangeUiAnimation(eventPlayer: mod.Player, control?: SampleAnimationControl): Promise<void> {
    // Player id used to make widget names unique.
    const playerId = samplePlayerId(eventPlayer);
    // Panel widget name.
    const panelName = `sampleRoundChangeUiAnimation-${playerId}-panel`;
    // Horizontal accent line widget name.
    const lineName = `sampleRoundChangeUiAnimation-${playerId}-line`;
    // Title text widget name.
    const titleName = `sampleRoundChangeUiAnimation-${playerId}-title`;
    // Subtitle text widget name.
    const subtitleName = `sampleRoundChangeUiAnimation-${playerId}-subtitle`;

    resetWidgets([panelName]);

    // Center panel used for the round-change message.
    const panel = addPanel(panelName, v(0, -56), v(980, 250), mod.UIAnchor.Center, eventPlayer);
    mod.AddUIContainer(lineName, v(490, 122), v(0, 8), mod.UIAnchor.TopLeft, panel, true, 0, v(0.2, 0.85, 1), 0, mod.UIBgFill.Solid, eventPlayer);
    // Accent line widget.
    const line = findWidget(lineName, panel);
    // Main round-change title.
    const title = addText(titleName, panel, mod.stringkeys.sample_round_title, v(0, 42), v(980, 84), 56, eventPlayer);
    // Supporting subtitle below the title.
    const subtitle = addText(subtitleName, panel, mod.stringkeys.sample_round_subtitle, v(0, 138), v(980, 52), 30, eventPlayer);

    if (control?.isCanceled()) return;
    // Timeline that expands the line, reveals text, then collapses everything.
    const timeline = uiTimeline()
        .to(panel, { visible: true, bgAlpha: 0.62 }, { duration: 0.15, ease: "outCubic" })
        .to(line, { x: 0, width: 980, bgAlpha: 1 }, { duration: 0.22, ease: "outCubic" })
        .to(title, { textAlpha: 1, textSize: 82 }, { duration: 0.26, ease: "outBack" })
        .to(subtitle, { textAlpha: 1, y: 150 }, { duration: 0.18, ease: "outCubic" })
        .wait(1.1)
        .to([
            { target: title, props: { textAlpha: 0, y: 28 } },
            { target: subtitle, props: { textAlpha: 0, y: 184 } },
            { target: line, props: { bgAlpha: 0, width: 0, x: 490 } },
        ], { duration: 0.22, ease: "inCubic" })
        .to(panel, { bgAlpha: 0, visible: false }, { duration: 0.15 });
    control?.onCancel(() => timeline.stop());
    await timeline.play();
}

// Demonstrates GravityWorld physics on a normal spawned object.
export async function sampleObjectGravityThrow(eventPlayer: mod.Player, prefab?: SampleObjectPrefab, control?: SampleAnimationControl): Promise<void> {
    // Player id used in logs.
    const playerId = samplePlayerId(eventPlayer);
    console.log("LOG> sampleObjectGravityThrow:", playerId);

    // Initial spawn point in front of the player.
    const start = sampleObjectPoint(eventPlayer, -1.4, 1.1, 3);
    // Object being moved by gravity.
    const object = spawnSampleObject(prefab, start, v(0, 0, 0), v(1.8, 1.8, 1.8));
    if (!object || control?.isCanceled()) return;

    // Ground height below the start point.
    const groundY = mod.YComponentOf(start) - 1.2;
    // Gravity world that throws the object forward and upward.
    const gravity = new GravityWorld({ gravity: [0, -9.8, 0] })
        .add(objectGravityBody(object, { velocity: [6, 8, 0], groundY }));

    // Timeline that runs the physics simulation.
    const timeline = objectTimeline()
        .physics(gravity, { duration: 1.2, step: 1 / 15 });
    control?.onCancel(() => timeline.stop());
    await timeline.play();
}

// Demonstrates GravityWorld physics on a composite RuntimeObject.
export async function sampleRuntimeObjectGravity(eventPlayer: mod.Player, prefab?: SampleObjectPrefab, control?: SampleAnimationControl): Promise<void> {
    // Player id used in logs.
    const playerId = samplePlayerId(eventPlayer);
    console.log("LOG> sampleRuntimeObjectGravity:", playerId);

    if (prefab === undefined || control?.isCanceled()) {
        console.log("LOG> RuntimeObject gravity sample skipped. Pass a RuntimeSpawn prefab to spawn the composite object.");
        return;
    }

    // Initial high spawn point in front of the player.
    const start = sampleObjectPoint(eventPlayer, 0, 4, 3.2);
    // Parent RuntimeObject affected by gravity.
    const runtime = new RuntimeObject(prefab, [mod.XComponentOf(start), mod.YComponentOf(start), mod.ZComponentOf(start)], [0, 0, 0], [0, 1, 0], 0, [1.7, 1.7, 1.7]);
    runtime.NewChild(prefab, [0, 0, 1.4], [0, 0, 0], [0, 1, 0], 0, [0.85, 0.85, 0.85]);

    // Ground height below the start point.
    const groundY = mod.YComponentOf(start) - 5;
    // Gravity world that moves the RuntimeObject through its adapter.
    const gravity = new GravityWorld({ gravity: [0, -9.8, 0] })
        .add(runtimeObjectGravityBody(runtime, { velocity: [0, 1, 0], groundY }));

    // Timeline that runs the physics simulation.
    const timeline = objectTimeline()
        .physics(gravity, { duration: 1, step: 1 / 15 });
    control?.onCancel(() => timeline.stop());
    await timeline.play();
}

// Demonstrates floating object motion driven only by physics acceleration.
export async function sampleObjectFloatPhysics(eventPlayer: mod.Player, prefab?: SampleObjectPrefab, control?: SampleAnimationControl): Promise<void> {
    // Player id used in logs.
    const playerId = samplePlayerId(eventPlayer);
    console.log("LOG> sampleObjectFloatPhysics:", playerId);

    // Initial spawn point in front of the player.
    const start = sampleObjectPoint(eventPlayer, 0, 1.35, 2.2);
    // Object being moved by alternating physics acceleration.
    const object = spawnSampleObject(prefab, start, v(0, 0, 0), v(2.1, 2.1, 2.1));
    if (!object || control?.isCanceled()) return;

    // Gravity world used as a simple vertical oscillator.
    const gravity = new GravityWorld({ gravity: [0, 7.5, 0] })
        .add(objectGravityBody(object, { velocity: [0, 1.2, 0] }));

    // Timeline alternates gravity direction; no direct Y tween is used.
    const timeline = objectTimeline()
        .physics(gravity, { duration: 0.22, step: 1 / 15 })
        .call(() => { gravity.gravity = [0, -8.5, 0]; })
        .physics(gravity, { duration: 0.45, step: 1 / 15 })
        .call(() => { gravity.gravity = [0, 8.5, 0]; })
        .physics(gravity, { duration: 0.45, step: 1 / 15 })
        .call(() => { gravity.gravity = [0, -8.5, 0]; })
        .physics(gravity, { duration: 0.45, step: 1 / 15 })
        .call(() => { gravity.gravity = [0, 8.5, 0]; })
        .physics(gravity, { duration: 0.45, step: 1 / 15 })
        .call(() => { gravity.gravity = [0, -8.5, 0]; })
        .physics(gravity, { duration: 0.32, step: 1 / 15 });
    control?.onCancel(() => timeline.stop());
    await timeline.play();
}
