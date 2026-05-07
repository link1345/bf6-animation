import { RuntimeObjectPrefab } from "./bf6-object-animation";
import {
    sampleObjectGravityThrow,
    sampleObjectMove,
    sampleObjectMultiPointMove,
    sampleObjectRotate,
    sampleRoundChangeUiAnimation,
    sampleRuntimeObjectGravity,
    sampleRuntimeObjectParentChild,
    sampleUiButtonFocusAnimation,
    sampleUiGaugeAnimation,
    sampleUiGravityBounce,
    sampleUiSlideNotification,
    sampleWeaponSwitchUiAnimation,
    SampleAnimationControl,
    v, findWidget,
} from "./Samples";

type SampleEntry = {
    id: string;
    label: string;
    selectedStatus: string;
    runningStatus: string;
    run: (eventPlayer: mod.Player, control: SampleAnimationControl) => Promise<void>;
};

const selectedSampleIds = new Map<number, string>();
const activeSampleRuns = new Map<number, ActiveSampleRun>();
const lastButtonEvents = new Map<number, ButtonEventStamp>();
const duplicateButtonEventWindowMs = 250;
let nextSampleRunId = 1;

type ActiveSampleRun = {
    id: number;
    sampleId: string;
    canceled: boolean;
    stops: Set<() => void>;
};

type ButtonEventStamp = {
    buttonName: string;
    time: number;
};

function sampleObjectPrefab(): RuntimeObjectPrefab {
    return mod.RuntimeSpawn_Common.Crate_01_A;
}

function sampleEntries(): readonly SampleEntry[] {
    return [
        { id: "ui-slide", label: mod.stringkeys.sample_menu_button_ui_slide, selectedStatus: mod.stringkeys.sample_status_selected_ui_slide, runningStatus: mod.stringkeys.sample_status_running_ui_slide, run: sampleUiSlideNotification },
        { id: "ui-gauge", label: mod.stringkeys.sample_menu_button_ui_gauge, selectedStatus: mod.stringkeys.sample_status_selected_ui_gauge, runningStatus: mod.stringkeys.sample_status_running_ui_gauge, run: sampleUiGaugeAnimation },
        { id: "ui-button", label: mod.stringkeys.sample_menu_button_ui_button, selectedStatus: mod.stringkeys.sample_status_selected_ui_button, runningStatus: mod.stringkeys.sample_status_running_ui_button, run: sampleUiButtonFocusAnimation },
        { id: "ui-gravity", label: mod.stringkeys.sample_menu_button_ui_gravity, selectedStatus: mod.stringkeys.sample_status_selected_ui_gravity, runningStatus: mod.stringkeys.sample_status_running_ui_gravity, run: sampleUiGravityBounce },
        { id: "weapon-switch", label: mod.stringkeys.sample_menu_button_weapon, selectedStatus: mod.stringkeys.sample_status_selected_weapon, runningStatus: mod.stringkeys.sample_status_running_weapon, run: sampleWeaponSwitchUiAnimation },
        { id: "round-change", label: mod.stringkeys.sample_menu_button_round, selectedStatus: mod.stringkeys.sample_status_selected_round, runningStatus: mod.stringkeys.sample_status_running_round, run: sampleRoundChangeUiAnimation },
        { id: "object-move", label: mod.stringkeys.sample_menu_button_object_move, selectedStatus: mod.stringkeys.sample_status_selected_object_move, runningStatus: mod.stringkeys.sample_status_running_object_move, run: (eventPlayer, control) => sampleObjectMove(eventPlayer, sampleObjectPrefab(), control) },
        { id: "object-rotate", label: mod.stringkeys.sample_menu_button_object_rotate, selectedStatus: mod.stringkeys.sample_status_selected_object_rotate, runningStatus: mod.stringkeys.sample_status_running_object_rotate, run: (eventPlayer, control) => sampleObjectRotate(eventPlayer, sampleObjectPrefab(), control) },
        { id: "object-parent", label: mod.stringkeys.sample_menu_button_object_parent, selectedStatus: mod.stringkeys.sample_status_selected_object_parent, runningStatus: mod.stringkeys.sample_status_running_object_parent, run: (eventPlayer, control) => sampleRuntimeObjectParentChild(eventPlayer, sampleObjectPrefab(), control) },
        { id: "object-points", label: mod.stringkeys.sample_menu_button_object_points, selectedStatus: mod.stringkeys.sample_status_selected_object_points, runningStatus: mod.stringkeys.sample_status_running_object_points, run: (eventPlayer, control) => sampleObjectMultiPointMove(eventPlayer, sampleObjectPrefab(), control) },
        { id: "object-throw", label: mod.stringkeys.sample_menu_button_object_throw, selectedStatus: mod.stringkeys.sample_status_selected_object_throw, runningStatus: mod.stringkeys.sample_status_running_object_throw, run: (eventPlayer, control) => sampleObjectGravityThrow(eventPlayer, sampleObjectPrefab(), control) },
        { id: "runtime-gravity", label: mod.stringkeys.sample_menu_button_runtime_gravity, selectedStatus: mod.stringkeys.sample_status_selected_runtime_gravity, runningStatus: mod.stringkeys.sample_status_running_runtime_gravity, run: (eventPlayer, control) => sampleRuntimeObjectGravity(eventPlayer, sampleObjectPrefab(), control) },
    ];
}

function playerId(eventPlayer: mod.Player): number {
    return mod.GetObjId(eventPlayer);
}

function menuRootName(eventPlayer: mod.Player): string {
    return `sample-menu-${playerId(eventPlayer)}-root`;
}

function menuStatusName(eventPlayer: mod.Player): string {
    return `sample-menu-${playerId(eventPlayer)}-status`;
}

function sampleButtonName(eventPlayer: mod.Player, sampleId: string): string {
    return `sample-menu-${playerId(eventPlayer)}-button-${sampleId}`;
}

function sampleButtonLabelName(eventPlayer: mod.Player, sampleId: string): string {
    return `${sampleButtonName(eventPlayer, sampleId)}-label`;
}

function removeWidgetByName(name: string): void {
    if (mod.HasUIWidgetWithName(name)) {
        mod.DeleteUIWidget(mod.FindUIWidgetWithName(name));
    }
}

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

function addSampleButton(entry: SampleEntry, index: number, parent: mod.UIWidget, eventPlayer: mod.Player): void {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const buttonName = sampleButtonName(eventPlayer, entry.id);
    const x = 16 + column * 172;
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

    const button = findWidget(buttonName, parent);
    mod.EnableUIButtonEvent(button, mod.UIButtonEvent.ButtonDown, true);
    mod.EnableUIButtonEvent(button, mod.UIButtonEvent.ButtonUp, true);
    addMenuText(sampleButtonLabelName(eventPlayer, entry.id), parent, entry.label, v(x, y), v(158, 30), 13, eventPlayer);
}

export function createSampleMenu(eventPlayer: mod.Player): void {
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

    const root = findWidget(rootName);
    addMenuText(`sample-menu-${playerId(eventPlayer)}-title`, root, mod.stringkeys.sample_menu_title, v(16, 12), v(340, 24), 18, eventPlayer);
    addMenuText(menuStatusName(eventPlayer), root, mod.stringkeys.sample_menu_status_idle, v(16, 42), v(340, 20), 12, eventPlayer);
    mod.EnableUIInputMode(true, eventPlayer);

    const entries = sampleEntries();
    for (let i = 0; i < entries.length; i += 1) {
        addSampleButton(entries[i], i, root, eventPlayer);
    }
    updateSelectedButtonVisuals(eventPlayer);
}

function findSampleByButtonName(buttonName: string): SampleEntry | undefined {
    for (const entry of sampleEntries()) {
        if (buttonName.endsWith(`-button-${entry.id}`)) return entry;
    }
    return undefined;
}

function setMenuStatus(eventPlayer: mod.Player, message: string): void {
    const statusName = menuStatusName(eventPlayer);
    if (mod.HasUIWidgetWithName(statusName)) {
        mod.SetUITextLabel(mod.FindUIWidgetWithName(statusName), mod.Message(message));
    }
}

function setButtonVisual(eventPlayer: mod.Player, entry: SampleEntry, selected: boolean): void {
    const buttonName = sampleButtonName(eventPlayer, entry.id);
    if (!mod.HasUIWidgetWithName(buttonName)) return;

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

    const labelName = sampleButtonLabelName(eventPlayer, entry.id);
    if (mod.HasUIWidgetWithName(labelName)) {
        mod.SetUITextColor(mod.FindUIWidgetWithName(labelName), selected ? v(0, 0, 0) : v(1, 1, 1));
    }
}

function updateSelectedButtonVisuals(eventPlayer: mod.Player): void {
    const selectedSampleId = selectedSampleIds.get(playerId(eventPlayer));
    for (const entry of sampleEntries()) {
        setButtonVisual(eventPlayer, entry, entry.id === selectedSampleId);
    }
}

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

function cancelActiveSampleRun(eventPlayer: mod.Player): ActiveSampleRun | undefined {
    const playerKey = playerId(eventPlayer);
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

function shouldIgnoreDuplicateButtonEvent(eventPlayer: mod.Player, buttonName: string): boolean {
    const playerKey = playerId(eventPlayer);
    const now = Date.now();
    const lastEvent = lastButtonEvents.get(playerKey);
    lastButtonEvents.set(playerKey, { buttonName, time: now });

    return lastEvent !== undefined
        && lastEvent.buttonName === buttonName
        && now - lastEvent.time <= duplicateButtonEventWindowMs;
}

function runSampleFromButton(eventPlayer: mod.Player, buttonName: string): void {
    const entry = findSampleByButtonName(buttonName);
    if (!entry) {
        console.log("LOG> OnPlayerUIButtonEvent ignored unknown widget:", buttonName);
        return;
    }

    if (shouldIgnoreDuplicateButtonEvent(eventPlayer, buttonName)) {
        console.log("LOG> ignored duplicate bf6-animation button event:", playerId(eventPlayer), entry.id);
        return;
    }

    const canceledRun = cancelActiveSampleRun(eventPlayer);
    if (canceledRun?.sampleId === entry.id) {
        setMenuStatus(eventPlayer, entry.selectedStatus);
        return;
    }

    const playerKey = playerId(eventPlayer);
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

    const control = createSampleControl(run);
    void entry.run(eventPlayer, control).then(() => {
        if (activeSampleRuns.get(playerKey)?.id === run.id) {
            activeSampleRuns.delete(playerKey);
            setMenuStatus(eventPlayer, entry.selectedStatus);
            console.log("LOG> finished bf6-animation sample:", playerKey, entry.id);
        }
    });
}

export async function OnPlayerJoinGame(eventPlayer: mod.Player) {
    console.log("LOG> OnPlayerJoinGame bf6-animation sample init:", playerId(eventPlayer));
    cancelActiveSampleRun(eventPlayer);
    selectedSampleIds.delete(playerId(eventPlayer));
    lastButtonEvents.delete(playerId(eventPlayer));
}

export async function OnPlayerUndeploy(eventPlayer: mod.Player) {
    console.log("LOG> OnPlayerUndeploy bf6-animation sample cleanup:", playerId(eventPlayer));
    cancelActiveSampleRun(eventPlayer);
    lastButtonEvents.delete(playerId(eventPlayer));
    removeWidgetByName(menuRootName(eventPlayer));
}

export async function OnPlayerDeployed(eventPlayer: mod.Player) {
    console.log("LOG> OnPlayerDeployed bf6-animation sample menu:", playerId(eventPlayer));
    await mod.Wait(0.1);
    createSampleMenu(eventPlayer);
}

export async function OnPlayerUIButtonEvent(eventPlayer: mod.Player, eventUIWidget: mod.UIWidget, eventUIButtonEvent: mod.UIButtonEvent) {
    console.log("LOG> OnPlayerUIButtonEvent:", playerId(eventPlayer), mod.GetUIWidgetName(eventUIWidget), eventUIButtonEvent);
    runSampleFromButton(eventPlayer, mod.GetUIWidgetName(eventUIWidget));
}
