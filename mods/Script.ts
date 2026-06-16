import { RuntimeObjectPrefab } from "./bf6-object-animation";
import {
    sampleObjectGravityThrow,
    sampleObjectFloatPhysics,
    sampleObjectMove,
    sampleObjectMultiPointMove,
    sampleObjectRotate,
    sampleRoundChangeUiAnimation,
    sampleRuntimeObjectGravity,
    sampleRuntimeObjectHingedBoards,
    sampleRuntimeObjectParentChild,
    sampleUiGaugeAnimation,
    sampleUiGravityBounce,
    sampleUiSlideNotification,
    SampleAnimationControl,
    v, findWidget,
} from "./Samples";

// Menu entry metadata and the function that runs the selected sample.
type SampleEntry = {
    // Stable sample identifier used in widget names and state maps.
    id: string;
    // Localized button label string key.
    label: string;
    // Localized status string shown after selecting the sample.
    selectedStatus: string;
    // Localized status string shown while the sample is running.
    runningStatus: string;
    // Function that executes the sample animation for a player.
    run: (eventPlayer: mod.Player, control: SampleAnimationControl) => Promise<void>;
};

// Selected sample id per player object id.
const selectedSampleIds = new Map<number, string>();
// Currently running sample state per player object id.
const activeSampleRuns = new Map<number, ActiveSampleRun>();
// Last button event per player, used to suppress duplicated UI events.
const lastButtonEvents = new Map<number, ButtonEventStamp>();
// Whether each player is currently free to move instead of using UI buttons.
const playerMoveModes = new Map<number, boolean>();
// Last sampled crouch state per player while movement mode is active.
const playerWasCrouching = new Map<number, boolean>();
// Whether OngoingPlayer should maintain menu/movement mode for each player.
const playerModeMonitorActive = new Map<number, boolean>();
// Last OngoingPlayer maintenance time per player.
const lastPlayerModeMonitorTimes = new Map<number, number>();
// Maximum time window for treating repeated button events as duplicates.
const duplicateButtonEventWindowMs = 250;
// Minimum interval for OngoingPlayer mode maintenance.
const playerModeMonitorIntervalMs = 250;
// Monotonic id assigned to each new sample run.
let nextSampleRunId = 1;

// Runtime state for one active sample execution.
type ActiveSampleRun = {
    // Unique id for this execution.
    id: number;
    // Sample id currently being executed.
    sampleId: string;
    // Whether the run has been canceled.
    canceled: boolean;
    // Cleanup callbacks registered by the running sample.
    stops: Set<() => void>;
};

// Timestamp and widget name for the last UI button event.
type ButtonEventStamp = {
    // Button widget name that fired the event.
    buttonName: string;
    // Date.now() timestamp in milliseconds.
    time: number;
};

// Returns the prefab used by object animation samples.
function sampleObjectPrefab(): RuntimeObjectPrefab {
    return mod.RuntimeSpawn_Limestone.Books_01_A;
}

function sampleObjectBlackPrefab(): RuntimeObjectPrefab {
    return mod.RuntimeSpawn_Limestone.FloorPlate_01_128;
}

// Builds the list of selectable animation samples shown in the menu.
function sampleEntries(): readonly SampleEntry[] {
    return [
        { id: "ui-slide", label: mod.stringkeys.sample_menu_button_ui_slide, selectedStatus: mod.stringkeys.sample_status_selected_ui_slide, runningStatus: mod.stringkeys.sample_status_running_ui_slide, run: sampleUiSlideNotification },
        { id: "ui-gauge", label: mod.stringkeys.sample_menu_button_ui_gauge, selectedStatus: mod.stringkeys.sample_status_selected_ui_gauge, runningStatus: mod.stringkeys.sample_status_running_ui_gauge, run: sampleUiGaugeAnimation },
        { id: "ui-gravity", label: mod.stringkeys.sample_menu_button_ui_gravity, selectedStatus: mod.stringkeys.sample_status_selected_ui_gravity, runningStatus: mod.stringkeys.sample_status_running_ui_gravity, run: sampleUiGravityBounce },
        { id: "round-change", label: mod.stringkeys.sample_menu_button_round, selectedStatus: mod.stringkeys.sample_status_selected_round, runningStatus: mod.stringkeys.sample_status_running_round, run: sampleRoundChangeUiAnimation },
        { id: "object-move", label: mod.stringkeys.sample_menu_button_object_move, selectedStatus: mod.stringkeys.sample_status_selected_object_move, runningStatus: mod.stringkeys.sample_status_running_object_move, run: (eventPlayer, control) => sampleObjectMove(eventPlayer, sampleObjectPrefab(), control) },
        { id: "object-rotate", label: mod.stringkeys.sample_menu_button_object_rotate, selectedStatus: mod.stringkeys.sample_status_selected_object_rotate, runningStatus: mod.stringkeys.sample_status_running_object_rotate, run: (eventPlayer, control) => sampleObjectRotate(eventPlayer, sampleObjectPrefab(), control) },
        { id: "object-parent", label: mod.stringkeys.sample_menu_button_object_parent, selectedStatus: mod.stringkeys.sample_status_selected_object_parent, runningStatus: mod.stringkeys.sample_status_running_object_parent, run: (eventPlayer, control) => sampleRuntimeObjectParentChild(eventPlayer, sampleObjectPrefab(), control) },
        //{ id: "object-hinge", label: mod.stringkeys.sample_menu_button_object_hinge, selectedStatus: mod.stringkeys.sample_status_selected_object_hinge, runningStatus: mod.stringkeys.sample_status_running_object_hinge, run: (eventPlayer, control) => sampleRuntimeObjectHingedBoards(eventPlayer, sampleObjectBlackPrefab(), control) },
        { id: "object-points", label: mod.stringkeys.sample_menu_button_object_points, selectedStatus: mod.stringkeys.sample_status_selected_object_points, runningStatus: mod.stringkeys.sample_status_running_object_points, run: (eventPlayer, control) => sampleObjectMultiPointMove(eventPlayer, sampleObjectPrefab(), control) },
        { id: "object-throw", label: mod.stringkeys.sample_menu_button_object_throw, selectedStatus: mod.stringkeys.sample_status_selected_object_throw, runningStatus: mod.stringkeys.sample_status_running_object_throw, run: (eventPlayer, control) => sampleObjectGravityThrow(eventPlayer, sampleObjectPrefab(), control) },
        { id: "runtime-gravity", label: mod.stringkeys.sample_menu_button_runtime_gravity, selectedStatus: mod.stringkeys.sample_status_selected_runtime_gravity, runningStatus: mod.stringkeys.sample_status_running_runtime_gravity, run: (eventPlayer, control) => sampleRuntimeObjectGravity(eventPlayer, sampleObjectPrefab(), control) },
        { id: "object-float", label: mod.stringkeys.sample_menu_button_object_float, selectedStatus: mod.stringkeys.sample_status_selected_object_float, runningStatus: mod.stringkeys.sample_status_running_object_float, run: (eventPlayer, control) => sampleObjectFloatPhysics(eventPlayer, sampleObjectPrefab(), control) },
    ];
}

// Returns a stable numeric id for a player.
function playerId(eventPlayer: mod.Player): number {
    return mod.GetObjId(eventPlayer);
}

// Builds the root widget name for a player's sample menu.
function menuRootName(eventPlayer: mod.Player): string {
    return `sample-menu-${playerId(eventPlayer)}-root`;
}

// Builds the status label widget name for a player's sample menu.
function menuStatusName(eventPlayer: mod.Player): string {
    return `sample-menu-${playerId(eventPlayer)}-status`;
}

// Builds the guide label widget name for a player's sample menu.
function menuGuideName(eventPlayer: mod.Player): string {
    return `sample-menu-${playerId(eventPlayer)}-guide`;
}

// Builds the movement toggle button widget name for a player's sample menu.
function moveModeButtonName(eventPlayer: mod.Player): string {
    return `sample-menu-${playerId(eventPlayer)}-button-move-mode`;
}

// Builds the movement toggle button label widget name for a player's sample menu.
function moveModeButtonLabelName(eventPlayer: mod.Player): string {
    return `${moveModeButtonName(eventPlayer)}-label`;
}

// Builds the button widget name for one sample entry.
function sampleButtonName(eventPlayer: mod.Player, sampleId: string): string {
    return `sample-menu-${playerId(eventPlayer)}-button-${sampleId}`;
}

// Builds the text label widget name for one sample button.
function sampleButtonLabelName(eventPlayer: mod.Player, sampleId: string): string {
    return `${sampleButtonName(eventPlayer, sampleId)}-label`;
}

// Deletes a widget by name when it exists.
function removeWidgetByName(name: string): void {
    if (mod.HasUIWidgetWithName(name)) {
        mod.DeleteUIWidget(mod.FindUIWidgetWithName(name));
    }
}

// Returns movement-related inputs disabled while the player is using the UI button menu.
function menuModeRestrictedInputs(): readonly mod.RestrictedInputs[] {
    return [
        mod.RestrictedInputs.MoveForwardBack,
        mod.RestrictedInputs.MoveLeftRight,
        mod.RestrictedInputs.Jump,
        mod.RestrictedInputs.Prone,
        mod.RestrictedInputs.FireWeapon,
        mod.RestrictedInputs.Reload,
    ];
}

// Restricts or releases player movement.
function setPlayerMovementRestricted(eventPlayer: mod.Player, restricted: boolean): void {
    for (const input of menuModeRestrictedInputs()) {
        mod.EnableInputRestriction(eventPlayer, input, restricted);
    }
}

// Applies either button-menu mode or free-movement mode to one player.
function setPlayerMoveMode(eventPlayer: mod.Player, canMove: boolean): void {
    const playerKey = playerId(eventPlayer);
    playerMoveModes.set(playerKey, canMove);
    playerWasCrouching.set(playerKey, false);
    mod.EnableUIInputMode(!canMove, eventPlayer);
    setPlayerMovementRestricted(eventPlayer, !canMove);
}

// Toggles one player between menu mode and movement mode.
function togglePlayerMoveMode(eventPlayer: mod.Player): void {
    const nextCanMove = !playerMoveModes.get(playerId(eventPlayer));
    setPlayerMoveMode(eventPlayer, nextCanMove);
    console.log("LOG> toggled bf6-animation move mode:", playerId(eventPlayer), nextCanMove);
}

// Starts OngoingPlayer mode maintenance for one player.
function startPlayerModeMonitor(eventPlayer: mod.Player): void {
    const playerKey = playerId(eventPlayer);
    playerModeMonitorActive.set(playerKey, true);
    lastPlayerModeMonitorTimes.set(playerKey, 0);
}

// Stops OngoingPlayer mode maintenance for one player.
function stopPlayerModeMonitor(eventPlayer: mod.Player): void {
    const playerKey = playerId(eventPlayer);
    playerModeMonitorActive.delete(playerKey);
    lastPlayerModeMonitorTimes.delete(playerKey);
    playerWasCrouching.delete(playerKey);
}

// Periodically reapplies the current mode from OngoingPlayer without creating a deploy-time loop.
function maintainPlayerMode(eventPlayer: mod.Player): void {
    const playerKey = playerId(eventPlayer);
    if (!playerModeMonitorActive.get(playerKey)) return;

    const now = Date.now();
    const last = lastPlayerModeMonitorTimes.get(playerKey) ?? 0;
    if (now - last < playerModeMonitorIntervalMs) return;

    lastPlayerModeMonitorTimes.set(playerKey, now);
    if (playerMoveModes.get(playerKey)) {
        const isCrouching = mod.GetSoldierState(eventPlayer, mod.SoldierStateBool.IsCrouching);
        if (isCrouching && !playerWasCrouching.get(playerKey)) {
            setPlayerMoveMode(eventPlayer, false);
            setMenuStatus(eventPlayer, mod.stringkeys.sample_menu_status_idle);
            console.log("LOG> returned bf6-animation menu mode from crouch:", playerKey);
            return;
        }
        playerWasCrouching.set(playerKey, isCrouching);
    }

    setPlayerMoveMode(eventPlayer, playerMoveModes.get(playerKey) ?? false);
}

// Adds a menu text widget and returns the created widget.
function addMenuText(name: string, parent: mod.UIWidget, messageKey: string, position: mod.Vector, size: mod.Vector, textSize: number, eventPlayer: mod.Player): mod.UIWidget {
    mod.AddUIText(
        name,
        position,
        size,
        mod.UIAnchor.TopLeft,
        parent,
        true,
        0,
        v(0, 0, 0),
        0,
        mod.UIBgFill.None,
        mod.Message(messageKey),
        textSize,
        v(1, 1, 1),
        1,
        mod.UIAnchor.Center,
        mod.UIDepth.AboveGameUI,
        eventPlayer,
    );
    return findWidget(name, parent);
}

// Adds one sample button and its label to the menu.
function addSampleButton(entry: SampleEntry, index: number, parent: mod.UIWidget, eventPlayer: mod.Player): void {
    // Two-column menu column index.
    const column = index % 2;
    // Row index inside the two-column menu.
    const row = Math.floor(index / 2);
    // Unique widget name for the button.
    const buttonName = sampleButtonName(eventPlayer, entry.id);
    // Button X position inside the menu panel.
    const x = 16 + column * 172;
    // Button Y position inside the menu panel.
    const y = 72 + row * 38;

    mod.AddUIButton(
        buttonName,
        v(x, y),
        v(158, 30),
        mod.UIAnchor.TopLeft,
        parent,
        true,
        0,
        v(0.02, 0.05, 0.08),
        0.45,
        mod.UIBgFill.Solid,
        true,
        v(0.16, 0.23, 0.3),
        0.82,
        v(0.08, 0.08, 0.08),
        0.35,
        v(0.18, 0.7, 1),
        1,
        v(0.22, 0.9, 0.65),
        1,
        v(1, 0.82, 0.25),
        1,
        mod.UIDepth.AboveGameUI,
        eventPlayer,
    );

    // Created button widget used to enable input events.
    const button = findWidget(buttonName, parent);
    mod.EnableUIButtonEvent(button, mod.UIButtonEvent.ButtonDown, true);
    mod.EnableUIButtonEvent(button, mod.UIButtonEvent.ButtonUp, true);
    addMenuText(sampleButtonLabelName(eventPlayer, entry.id), parent, entry.label, v(x, y), v(158, 30), 13, eventPlayer);
}

// Adds the button that toggles between movement-locked menu mode and free movement.
function addMoveModeButton(parent: mod.UIWidget, eventPlayer: mod.Player): void {
    const buttonName = moveModeButtonName(eventPlayer);

    mod.AddUIButton(
        buttonName,
        v(16, 292),
        v(158, 30),
        mod.UIAnchor.TopLeft,
        parent,
        true,
        0,
        v(0.05, 0.08, 0.05),
        0.5,
        mod.UIBgFill.Solid,
        true,
        v(0.22, 0.58, 0.22),
        0.92,
        v(0.08, 0.08, 0.08),
        0.35,
        v(0.18, 0.85, 0.35),
        1,
        v(0.16, 0.75, 0.25),
        1,
        v(0.7, 1, 0.55),
        1,
        mod.UIDepth.AboveGameUI,
        eventPlayer,
    );

    const button = findWidget(buttonName, parent);
    mod.EnableUIButtonEvent(button, mod.UIButtonEvent.ButtonDown, true);
    mod.EnableUIButtonEvent(button, mod.UIButtonEvent.ButtonUp, true);
    addMenuText(moveModeButtonLabelName(eventPlayer), parent, mod.stringkeys.sample_menu_button_move_mode, v(16, 292), v(158, 30), 13, eventPlayer);
}

// Creates or recreates the full sample selection menu for a player.
export function createSampleMenu(eventPlayer: mod.Player): void {
    // Root widget name for this player's menu.
    const rootName = menuRootName(eventPlayer);
    removeWidgetByName(rootName);

    mod.AddUIContainer(
        rootName,
        v(28, 92),
        v(372, 328),
        mod.UIAnchor.TopLeft,
        mod.GetUIRoot(),
        true,
        8,
        v(0.015, 0.03, 0.055),
        0.86,
        mod.UIBgFill.Solid,
        mod.UIDepth.AboveGameUI,
        eventPlayer,
    );

    // Root container widget used as the parent for menu children.
    const root = findWidget(rootName);
    addMenuText(`sample-menu-${playerId(eventPlayer)}-title`, root, mod.stringkeys.sample_menu_title, v(16, 12), v(340, 24), 18, eventPlayer);
    addMenuText(menuStatusName(eventPlayer), root, mod.stringkeys.sample_menu_status_idle, v(16, 42), v(340, 20), 12, eventPlayer);
    addMenuText(menuGuideName(eventPlayer), root, mod.stringkeys.sample_menu_move_button_hint, v(188, 294), v(158, 30), 11, eventPlayer);
    setPlayerMoveMode(eventPlayer, false);

    // All sample entries rendered as menu buttons.
    const entries = sampleEntries();
    for (let i = 0; i < entries.length; i += 1) {
        addSampleButton(entries[i], i, root, eventPlayer);
    }
    addMoveModeButton(root, eventPlayer);
    updateSelectedButtonVisuals(eventPlayer);
}

// Finds the sample entry associated with a button widget name.
function findSampleByButtonName(buttonName: string): SampleEntry | undefined {
    for (const entry of sampleEntries()) {
        if (buttonName.endsWith(`-button-${entry.id}`)) return entry;
    }
    return undefined;
}

// Updates the menu status label if it still exists.
function setMenuStatus(eventPlayer: mod.Player, message: string): void {
    // Status label widget name for this player.
    const statusName = menuStatusName(eventPlayer);
    if (mod.HasUIWidgetWithName(statusName)) {
        mod.SetUITextLabel(mod.FindUIWidgetWithName(statusName), mod.Message(message));
    }
}

// Applies selected or normal visual styling to one sample button.
function setButtonVisual(eventPlayer: mod.Player, entry: SampleEntry, selected: boolean): void {
    // Button widget name for this entry.
    const buttonName = sampleButtonName(eventPlayer, entry.id);
    if (!mod.HasUIWidgetWithName(buttonName)) return;

    // Button widget being recolored.
    const button = mod.FindUIWidgetWithName(buttonName);
    if (selected) {
        mod.SetUIButtonColorBase(button, v(0.92, 0.62, 0.16));
        mod.SetUIButtonAlphaBase(button, 1);
        mod.SetUIButtonColorFocused(button, v(1, 0.82, 0.25));
        mod.SetUIButtonAlphaFocused(button, 1);
    } else {
        mod.SetUIButtonColorBase(button, v(0.16, 0.23, 0.3));
        mod.SetUIButtonAlphaBase(button, 0.82);
        mod.SetUIButtonColorFocused(button, v(1, 0.82, 0.25));
        mod.SetUIButtonAlphaFocused(button, 1);
    }

    // Text label widget paired with the button.
    const labelName = sampleButtonLabelName(eventPlayer, entry.id);
    if (mod.HasUIWidgetWithName(labelName)) {
        mod.SetUITextColor(mod.FindUIWidgetWithName(labelName), selected ? v(0, 0, 0) : v(1, 1, 1));
    }
}

// Refreshes every menu button so only the selected sample is highlighted.
function updateSelectedButtonVisuals(eventPlayer: mod.Player): void {
    // Selected sample id stored for this player.
    const selectedSampleId = selectedSampleIds.get(playerId(eventPlayer));
    for (const entry of sampleEntries()) {
        setButtonVisual(eventPlayer, entry, entry.id === selectedSampleId);
    }
}

// Creates the cancellation control object passed into sample functions.
function createSampleControl(run: ActiveSampleRun): SampleAnimationControl {
    return {
        isCanceled: () => run.canceled,
        onCancel(stop: () => void) {
            if (run.canceled) {
                stop();
                return;
            }
            run.stops.add(stop);
        },
    };
}

// Cancels the currently running sample for a player, if one exists.
function cancelActiveSampleRun(eventPlayer: mod.Player): ActiveSampleRun | undefined {
    // Player id used as the key in runtime maps.
    const playerKey = playerId(eventPlayer);
    // Active run currently associated with this player.
    const activeRun = activeSampleRuns.get(playerKey);
    if (!activeRun) return undefined;

    activeRun.canceled = true;
    for (const stop of activeRun.stops) {
        stop();
    }
    activeSampleRuns.delete(playerKey);
    console.log("LOG> canceled bf6-animation sample:", playerKey, activeRun.sampleId);
    return activeRun;
}

// Returns true when a button event repeats too quickly for the same player and widget.
function shouldIgnoreDuplicateButtonEvent(eventPlayer: mod.Player, buttonName: string): boolean {
    // Player id used as the key in the duplicate-event map.
    const playerKey = playerId(eventPlayer);
    // Current timestamp in milliseconds.
    const now = Date.now();
    // Last event recorded for this player.
    const lastEvent = lastButtonEvents.get(playerKey);
    lastButtonEvents.set(playerKey, { buttonName, time: now });

    return lastEvent !== undefined
        && lastEvent.buttonName === buttonName
        && now - lastEvent.time <= duplicateButtonEventWindowMs;
}

// Handles a button press by canceling any old sample and starting the selected one.
function runSampleFromButton(eventPlayer: mod.Player, buttonName: string): void {
    if (buttonName === moveModeButtonName(eventPlayer)) {
        if (shouldIgnoreDuplicateButtonEvent(eventPlayer, buttonName)) {
            console.log("LOG> ignored duplicate bf6-animation move mode button event:", playerId(eventPlayer));
            return;
        }

        togglePlayerMoveMode(eventPlayer);
        setMenuStatus(eventPlayer, playerMoveModes.get(playerId(eventPlayer)) ? mod.stringkeys.sample_status_move_mode : mod.stringkeys.sample_menu_status_idle);
        return;
    }

    // Sample entry matched from the pressed button name.
    const entry = findSampleByButtonName(buttonName);
    if (!entry) {
        console.log("LOG> OnPlayerUIButtonEvent ignored unknown widget:", buttonName);
        return;
    }

    if (shouldIgnoreDuplicateButtonEvent(eventPlayer, buttonName)) {
        console.log("LOG> ignored duplicate bf6-animation button event:", playerId(eventPlayer), entry.id);
        return;
    }

    // Canceled run returned when another sample was active.
    const canceledRun = cancelActiveSampleRun(eventPlayer);
    if (canceledRun?.sampleId === entry.id) {
        setMenuStatus(eventPlayer, entry.selectedStatus);
        return;
    }

    // Player id used as the key in runtime maps.
    const playerKey = playerId(eventPlayer);
    // Runtime state for the new sample execution.
    const run: ActiveSampleRun = {
        id: nextSampleRunId,
        sampleId: entry.id,
        canceled: false,
        stops: new Set<() => void>(),
    };
    nextSampleRunId += 1;

    activeSampleRuns.set(playerKey, run);
    selectedSampleIds.set(playerKey, entry.id);
    updateSelectedButtonVisuals(eventPlayer);
    setMenuStatus(eventPlayer, entry.runningStatus);
    console.log("LOG> started bf6-animation sample:", playerKey, entry.id);

    // Cancellation API passed into the sample implementation.
    const control = createSampleControl(run);
    void entry.run(eventPlayer, control).then(() => {
        if (activeSampleRuns.get(playerKey)?.id === run.id) {
            activeSampleRuns.delete(playerKey);
            setMenuStatus(eventPlayer, entry.selectedStatus);
            console.log("LOG> finished bf6-animation sample:", playerKey, entry.id);
        }
    });
}

// Initializes per-player sample state when the player joins.
export async function OnPlayerJoinGame(eventPlayer: mod.Player) {
    console.log("LOG> OnPlayerJoinGame bf6-animation sample init:", playerId(eventPlayer));
    cancelActiveSampleRun(eventPlayer);
    stopPlayerModeMonitor(eventPlayer);
    selectedSampleIds.delete(playerId(eventPlayer));
    lastButtonEvents.delete(playerId(eventPlayer));
    playerMoveModes.delete(playerId(eventPlayer));
    playerWasCrouching.delete(playerId(eventPlayer));
}

// Stops mode maintenance when a player dies.
export async function OnPlayerDied(eventPlayer: mod.Player, eventOtherPlayer: mod.Player, eventDeathType: mod.DeathType, eventWeaponUnlock: mod.WeaponUnlock) {
    console.log("LOG> OnPlayerDied bf6-animation mode cleanup:", playerId(eventPlayer), playerId(eventOtherPlayer), eventDeathType, eventWeaponUnlock);
    stopPlayerModeMonitor(eventPlayer);
    playerMoveModes.delete(playerId(eventPlayer));
    playerWasCrouching.delete(playerId(eventPlayer));
}

// Cleans up running animations and UI when the player undeploys.
export async function OnPlayerUndeploy(eventPlayer: mod.Player) {
    console.log("LOG> OnPlayerUndeploy bf6-animation sample cleanup:", playerId(eventPlayer));
    cancelActiveSampleRun(eventPlayer);
    stopPlayerModeMonitor(eventPlayer);
    lastButtonEvents.delete(playerId(eventPlayer));
    playerMoveModes.delete(playerId(eventPlayer));
    playerWasCrouching.delete(playerId(eventPlayer));
    mod.EnableUIInputMode(false, eventPlayer);
    setPlayerMovementRestricted(eventPlayer, false);
    removeWidgetByName(menuRootName(eventPlayer));
}

// Creates the sample menu shortly after the player deploys.
export async function OnPlayerDeployed(eventPlayer: mod.Player) {
    console.log("LOG> OnPlayerDeployed bf6-animation sample menu:", playerId(eventPlayer));
    await mod.Wait(0.1);
    createSampleMenu(eventPlayer);
    startPlayerModeMonitor(eventPlayer);
}

// Routes UI button events to the matching sample entry.
export async function OnPlayerUIButtonEvent(eventPlayer: mod.Player, eventUIWidget: mod.UIWidget, eventUIButtonEvent: mod.UIButtonEvent) {
    console.log("LOG> OnPlayerUIButtonEvent:", playerId(eventPlayer), mod.GetUIWidgetName(eventUIWidget), eventUIButtonEvent);
    runSampleFromButton(eventPlayer, mod.GetUIWidgetName(eventUIWidget));
}

// Maintains the current mode at a bounded interval while the player is deployed.
export async function OngoingPlayer(eventPlayer: mod.Player) {
    maintainPlayerMode(eventPlayer);
}
