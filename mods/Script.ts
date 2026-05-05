import { uiTimeline } from "./bf6-ui-animation";

export async function OnPlayerDeployed(eventPlayer: mod.Player) {
    const playerId = mod.GetObjId(eventPlayer);
    const panelName = `deploy-panel-${playerId}`;
    const accentName = `deploy-accent-${playerId}`;
    const titleName = `deploy-title-${playerId}`;

    console.log("LOG> OnPlayerDeployed bf6-animation sample:", playerId);
    await mod.Wait(0.1);

    if (mod.HasUIWidgetWithName(panelName)) {
        mod.DeleteUIWidget(mod.FindUIWidgetWithName(panelName));
    }

    mod.AddUIContainer(
        panelName,
        mod.CreateVector(-420, 120, 0),
        mod.CreateVector(380, 96, 0),
        mod.UIAnchor.TopRight,
        mod.GetUIRoot(),
        false,
        8,
        mod.CreateVector(0.02, 0.06, 0.12),
        0,
        mod.UIBgFill.Solid,
        eventPlayer,
    );

    const panel = mod.FindUIWidgetWithName(panelName);

    mod.AddUIContainer(
        accentName,
        mod.CreateVector(0, 0, 0),
        mod.CreateVector(0, 6, 0),
        mod.UIAnchor.TopLeft,
        panel,
        false,
        0,
        mod.CreateVector(0.1, 0.8, 1),
        0,
        mod.UIBgFill.Solid,
        eventPlayer,
    );

    mod.AddUIText(
        titleName,
        mod.CreateVector(18, 8, 0),
        mod.CreateVector(344, 80, 0),
        mod.UIAnchor.Center,
        panel,
        true,
        0,
        mod.CreateVector(0, 0, 0),
        0,
        mod.UIBgFill.None,
        mod.Message("BF6 UI Anime deployed {}", playerId),
        20,
        mod.CreateVector(1, 1, 1),
        0,
        mod.UIAnchor.Center,
        eventPlayer,
    );

    const accent = mod.FindUIWidgetWithName(accentName, panel);
    const title = mod.FindUIWidgetWithName(titleName, panel);

    await uiTimeline()
        .to(panel, { visible: true, x: 36, bgAlpha: 0.92 }, { duration: 0.35, ease: "outCubic" })
        .to(accent, { visible: true, width: 380, bgAlpha: 1 }, { duration: 0.22, ease: "outCubic" })
        .to(title, { textAlpha: 1, textSize: 30 }, { duration: 0.25, ease: "outBack" })
        .wait(2)
        .to(title, { textAlpha: 0 }, { duration: 0.15, ease: "inCubic" })
        .to(panel, { x: -420, bgAlpha: 0, visible: false }, { duration: 0.3, ease: "inCubic" })
        .play();
}
