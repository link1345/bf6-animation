# bf6-ui-anime

Timeline-based animation helpers for Battlefield 6 Portal custom UI.

```ts
import { timeline } from "bf6-ui-anime";

await timeline()
    .to(panel, { visible: true, x: 24, bgAlpha: 0.85 }, { duration: 0.35, ease: "outCubic" })
    .to(title, { textAlpha: 1, textSize: 28 }, { duration: 0.25, ease: "outBack" })
    .wait(2)
    .to(panel, { x: -320, bgAlpha: 0, visible: false }, { duration: 0.3, ease: "inCubic" })
    .play();
```

The package uses Portal's `mod.Wait`, UI getters and setters, and `mod.CreateVector`. The repository build script inlines this package into `dist/Script.ts` when a mod imports `bf6-ui-anime`.
