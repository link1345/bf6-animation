import { GravityWorld, objectGravityBody, runtimeObjectGravityBody, uiGravityBody } from "./bf6-gravity";
import { RuntimeObject, RuntimeObjectPrefab, objectTimeline } from "./bf6-object-animation";
import { uiTimeline } from "./bf6-ui-animation";

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
    // Label text widget name.
    const labelName = `sampleUiGaugeAnimation-${playerId}-label`;

    resetWidgets([panelName]);

    // Gauge panel container.
    const panel = addPanel(panelName, v(0, 150), v(840, 172), mod.UIAnchor.TopCenter, eventPlayer);
    mod.AddUIContainer(trackName, v(56, 92), v(728, 24), mod.UIAnchor.TopLeft, panel, true, 0, v(0.2, 0.24, 0.28), 0.75, mod.UIBgFill.Solid, eventPlayer);
    mod.AddUIContainer(fillName, v(56, 92), v(0, 24), mod.UIAnchor.TopLeft, panel, true, 0, v(0.2, 0.9, 0.55), 0, mod.UIBgFill.Solid, eventPlayer);
    // Gauge label text widget.
    const label = addText(labelName, panel, mod.stringkeys.sample_ui_gauge_label, v(52, 16), v(736, 52), 34, eventPlayer);
    // Gauge fill widget.
    const fill = findWidget(fillName, panel);

    if (control?.isCanceled()) return;
    // Timeline that fills the gauge and then fades the panel out.
    const timeline = uiTimeline()
        .to(panel, { visible: true, bgAlpha: 0.88 }, { duration: 0.15, ease: "outCubic" })
        .to(label, { textAlpha: 1 }, { duration: 0.1 })
        .to(fill, { width: 240, bgAlpha: 1, bgColor: [0.2, 0.75, 1] }, { duration: 0.28, ease: "outCubic" })
        .to(fill, { width: 528, bgColor: [0.95, 0.82, 0.2] }, { duration: 0.32, ease: "inOutCubic" })
        .to(fill, { width: 728, bgColor: [0.25, 1, 0.45] }, { duration: 0.28, ease: "outBack" })
        .wait(0.8)
        .to(panel, { y: 96, bgAlpha: 0, visible: false }, { duration: 0.25, ease: "inCubic" });
    control?.onCancel(() => timeline.stop());
    await timeline.play();
}

// Demonstrates button color, alpha, and text focus animation.
export async function sampleUiButtonFocusAnimation(eventPlayer: mod.Player, control?: SampleAnimationControl): Promise<void> {
    // Player id used to make widget names unique.
    const playerId = samplePlayerId(eventPlayer);
    // Panel widget name.
    const panelName = `sampleUiButtonFocusAnimation-${playerId}-panel`;
    // Button widget name.
    const buttonName = `sampleUiButtonFocusAnimation-${playerId}-button`;
    // Button label widget name.
    const labelName = `sampleUiButtonFocusAnimation-${playerId}-label`;

    resetWidgets([panelName]);

    // Panel containing the button demo.
    const panel = addPanel(panelName, v(0, -240), v(660, 184), mod.UIAnchor.BottomCenter, eventPlayer);
    mod.AddUIButton(
        buttonName,
        v(48, 44),
        v(564, 96),
        mod.UIAnchor.TopLeft,
        panel,
        true,
        0,
        v(0.02, 0.05, 0.08),
        0.25,
        mod.UIBgFill.Solid,
        true,
        v(0.18, 0.24, 0.32),
        0.65,
        v(0.1, 0.1, 0.1),
        0.3,
        v(0.4, 0.75, 1),
        0.95,
        v(0.35, 0.95, 0.65),
        0.95,
        v(1, 0.85, 0.2),
        1,
        mod.UIDepth.AboveGameUI,
        eventPlayer,
    );
    // Button widget being animated.
    const button = findWidget(buttonName, panel);
    // Label text displayed over the button.
    const label = addText(labelName, panel, mod.stringkeys.sample_ui_button_label, v(48, 44), v(564, 96), 36, eventPlayer);

    if (control?.isCanceled()) return;
    // Timeline that animates panel entry, button state colors, and exit.
    const timeline = uiTimeline()
        .to(panel, { visible: true, y: 64, bgAlpha: 0.78 }, { duration: 0.18, ease: "outCubic" })
        .to([
            { target: button, props: { buttonAlphaBase: 0.95, buttonColorBase: [0.18, 0.5, 0.95] } },
            { target: label, props: { textAlpha: 1, textSize: 42 } },
        ], { duration: 0.22, ease: "outCubic" })
        .to(button, { buttonColorFocused: [1, 0.78, 0.18], buttonAlphaFocused: 1, buttonColorHover: [0.28, 0.95, 0.62] }, { duration: 0.25, ease: "outBack" })
        .wait(0.8)
        .to(panel, { y: -380, bgAlpha: 0, visible: false }, { duration: 0.25, ease: "inCubic" });
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
        .physics(gravity, { duration: 1.05, step: 1 / 30 })
        .to(shadow, { bgAlpha: 0.4, width: 128 }, { duration: 0.16, ease: "outCubic" })
        .wait(0.6)
        .to([
            { target: icon, props: { imageAlpha: 0, visible: false } },
            { target: shadow, props: { bgAlpha: 0, visible: false } },
        ], { duration: 0.2, ease: "inCubic" });
    control?.onCancel(() => timeline.stop());
    await timeline.play();
}

// Demonstrates a weapon switch UI animation with old/new labels and ammo text.
export async function sampleWeaponSwitchUiAnimation(eventPlayer: mod.Player, control?: SampleAnimationControl): Promise<void> {
    // Player id used to make widget names unique.
    const playerId = samplePlayerId(eventPlayer);
    // Panel widget name.
    const panelName = `sampleWeaponSwitchUiAnimation-${playerId}-panel`;
    // Old weapon label widget name.
    const oldName = `sampleWeaponSwitchUiAnimation-${playerId}-old`;
    // New weapon label widget name.
    const newName = `sampleWeaponSwitchUiAnimation-${playerId}-new`;
    // Ammo label widget name.
    const ammoName = `sampleWeaponSwitchUiAnimation-${playerId}-ammo`;
    // Weapon image widget name.
    const iconName = `sampleWeaponSwitchUiAnimation-${playerId}-weapon`;

    resetWidgets([panelName]);

    // Panel containing all weapon switch UI elements.
    const panel = addPanel(panelName, v(36, -300), v(960, 250), mod.UIAnchor.BottomLeft, eventPlayer);
    // Text for the weapon being replaced.
    const oldWeapon = addText(oldName, panel, mod.stringkeys.sample_weapon_old, v(500, 42), v(370, 60), 42, eventPlayer);
    // Text for the newly selected weapon.
    const newWeapon = addText(newName, panel, mod.stringkeys.sample_weapon_new, v(500, 42), v(370, 60), 42, eventPlayer);
    // Ammo text shown during the switch.
    const ammo = addText(ammoName, panel, mod.stringkeys.sample_weapon_ammo, v(500, 118), v(370, 60), 38, eventPlayer);
    mod.AddUIWeaponImage(iconName, v(28, 42), v(430, 150), mod.UIAnchor.TopLeft, mod.Weapons.AssaultRifle_M433, panel, eventPlayer);
    // Weapon icon widget.
    const icon = findWidget(iconName, panel);

    if (control?.isCanceled()) return;
    // Timeline that shows old weapon data, swaps to new data, and hides the panel.
    const timeline = uiTimeline()
        .to(panel, { visible: true, y: 42, bgAlpha: 0.86 }, { duration: 0.22, ease: "outCubic" })
        .to([
            { target: oldWeapon, props: { textAlpha: 1 } },
            { target: ammo, props: { textAlpha: 1 } },
            { target: icon, props: { visible: true } },
        ], { duration: 0.18 })
        .wait(0.55)
        .to(oldWeapon, { x: 430, textAlpha: 0 }, { duration: 0.14, ease: "inCubic" })
        .to(newWeapon, { x: 500, textAlpha: 1, textSize: 54 }, { duration: 0.2, ease: "outBack" })
        .to(ammo, { textColor: [0.25, 1, 0.6], textSize: 46 }, { duration: 0.18, ease: "outCubic" })
        .wait(0.8)
        .to(panel, { y: -300, bgAlpha: 0, visible: false }, { duration: 0.25, ease: "inCubic" });
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
        .physics(gravity, { duration: 1.2, step: 1 / 30 });
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
        .physics(gravity, { duration: 1, step: 1 / 30 });
    control?.onCancel(() => timeline.stop());
    await timeline.play();
}
