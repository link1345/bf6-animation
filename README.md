# bf6-animation

[日本語版はこちら](./README-JP.md)

Timeline-based animation helpers for Battlefield 6 Portal custom UI.

```ts
import { GravityWorld, RuntimeObject, uiGravityBody, objectGravityBody, uiTimeline, objectTimeline } from "bf6-animation";

await uiTimeline()
    .to(panel, { visible: true, x: 24, bgAlpha: 0.85 }, { duration: 0.35, ease: "outCubic" })
    .to(title, { textAlpha: 1, textSize: 28 }, { duration: 0.25, ease: "outBack" })
    .wait(2)
    .to(panel, { x: -320, bgAlpha: 0, visible: false }, { duration: 0.3, ease: "inCubic" })
    .play();
```

Pass an array to `to()` to animate multiple targets during the same timeline step.

```ts
await uiTimeline()
    .to([
        { target: panel, props: { x: 24, bgAlpha: 0.85 } },
        { target: title, props: { textAlpha: 1, textSize: 28 } },
    ], { duration: 0.35, ease: "outCubic" })
    .play();

await objectTimeline()
    .to([
        { target: boxA, props: { x: 10 } },
        { target: boxB, props: { yaw: 90 } },
    ], { duration: 0.5 })
    .play();
```

Use `loop: true` for an infinite loop, or pass a number for a finite loop count.

```ts
await uiTimeline({ loop: true })
    .to(panel, { bgAlpha: 1 }, { duration: 0.4 })
    .to(panel, { bgAlpha: 0.3 }, { duration: 0.4 })
    .play();

await objectTimeline({ loop: 3 })
    .to(box, { yaw: 180 }, { duration: 0.5 })
    .to(box, { yaw: 0 }, { duration: 0.5 })
    .play();
```

Use `RuntimeObject` for composite objects with parent-child transforms, then pass relative movement and arbitrary-axis rotation into `objectTimeline().to()`.

```ts
const parent = new RuntimeObject(undefined, [0, 100, 0], [0, 0, 0], [0, 1, 0], 0);
const child = parent.NewChild(prefab, [0, 0, 10], [0, 0, 0], [0, 1, 0], 0);

await objectTimeline()
    .to([
        { target: parent, props: { moveBy: [0, 0, 20] } },
        { target: child, props: { qRotateBy: { axis: [0, 1, 0], angle: Math.PI * 2 } } },
    ], { duration: 2, ease: "linear" })
    .play();
```

Use `GravityWorld` for lightweight gravity simulation. The same mechanism works for UI and world objects.

```ts
const gravity = new GravityWorld({ gravity: [0, 980, 0] })
    .add(uiGravityBody(panel, { velocity: [120, 0, 0], groundY: 720 }))
    .add(objectGravityBody(crate, { velocity: [0, 8, 0], groundY: 0 }));

await uiTimeline({ loop: true })
    .physics(gravity, { step: 1 / 15 })
    .play();
```

Set `groundY` to stop a body from falling below that Y coordinate. This is not game-engine physics; it is only script-driven position updates.

`GravityWorld` can be plugged into both UI and object timelines. `physics(gravity, { step })` advances physics by one tick, while `physics(gravity, { duration, step })` advances it for a fixed duration.

Projectile-like arcs can be made by setting an initial velocity and gravity.

```ts
const throwObject = new GravityWorld({ gravity: [0, -9.8, 0] })
    .add(objectGravityBody(ball, {
        velocity: [12, 18, 0],
        groundY: 0,
    }));

await objectTimeline({ loop: true })
    .physics(throwObject, { step: 1 / 15 })
    .play();
```

For UI coordinates, Y often increases downward. Use a negative Y velocity to throw upward, and positive Y gravity to pull it back down.

```ts
const throwIcon = new GravityWorld({ gravity: [0, 980, 0] })
    .add(uiGravityBody(icon, {
        velocity: [300, -600, 0],
        groundY: 720,
    }));

await uiTimeline({ loop: true })
    .physics(throwIcon, { step: 1 / 15 })
    .play();
```

`GravityWorld` updates each body once per step, so the cost is `O(N)` for N bodies. All-pairs collision detection is not planned because it grows to `O(N^2)`, which can become too expensive for Portal experiences that already move UI, objects, and composite RuntimeObjects. Collision, contact, pushing, and real physics interaction with game objects are also not planned beyond the simple `groundY` clamp.

The package uses Portal's `mod.Wait`, UI getters and setters, object transform APIs, and `mod.CreateVector`. The repository build script inlines this package into `dist/Script.ts` when a mod imports `bf6-animation`.

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
