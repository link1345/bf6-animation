# bf6-animation

[日本語版はこちら](./README-JP.md)

Timeline-based animation helpers for Battlefield 6 Portal custom UI.

```ts
import { uiTimeline } from "bf6-animation";

await uiTimeline()
    .to(panel, { visible: true, x: 24, bgAlpha: 0.85 }, { duration: 0.35, ease: "outCubic" })
    .to(title, { textAlpha: 1, textSize: 28 }, { duration: 0.25, ease: "outBack" })
    .wait(2)
    .to(panel, { x: -320, bgAlpha: 0, visible: false }, { duration: 0.3, ease: "inCubic" })
    .play();
```

The package uses Portal's `mod.Wait`, UI getters and setters, and `mod.CreateVector`. The repository build script inlines this package into `dist/Script.ts` when a mod imports `bf6-animation`.

## Usage

0. Use a BF6 TypeScript template that can bundle multiple files, such as [link1345/Battlefield6-SampleTemplate](https://github.com/link1345/Battlefield6-SampleTemplate).
1. Put `mods/bf6-animation.ts` into the bundle folder.
  - If you use [link1345/Battlefield6-SampleTemplate](https://github.com/link1345/Battlefield6-SampleTemplate), save it in the `mods` folder.
2. Write your code as you like.
  - This repository includes a sample program in `mods/Script.ts`.
3. Bundle the files.
  - If you use [link1345/Battlefield6-SampleTemplate](https://github.com/link1345/Battlefield6-SampleTemplate), `npm run build` bundles everything into one file and outputs it to the `dist` folder.
4. Register the output in the BF6 Portal web editor.
  - If you use [link1345/Battlefield6-SampleTemplate](https://github.com/link1345/Battlefield6-SampleTemplate), register the `.ts` and `.json` files from the `dist` folder.
