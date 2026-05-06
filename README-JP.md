# bf6-animation

[English version](./README.md)

Battlefield 6 Portal のカスタム UI 向けに、タイムラインベースのアニメーションヘルパーを提供します。

```ts
import { GravityWorld, RuntimeObject, uiGravityBody, objectGravityBody, uiTimeline, objectTimeline } from "bf6-animation";

await uiTimeline()
    .to(panel, { visible: true, x: 24, bgAlpha: 0.85 }, { duration: 0.35, ease: "outCubic" })
    .to(title, { textAlpha: 1, textSize: 28 }, { duration: 0.25, ease: "outBack" })
    .wait(2)
    .to(panel, { x: -320, bgAlpha: 0, visible: false }, { duration: 0.3, ease: "inCubic" })
    .play();
```

複数要素を同じ時間で動かす場合は、`to()` に配列を渡します。

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

ループさせる場合は、`loop: true` または回数を指定します。

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

複合オブジェクトは `RuntimeObject` で親子関係を作り、`objectTimeline().to()` の中で相対移動や任意軸回転を指定できます。

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

軽量な重力シミュレーションは `GravityWorld` で扱えます。UI と object の両方に同じ仕組みを使えます。

```ts
const gravity = new GravityWorld({ gravity: [0, 980, 0] })
    .add(uiGravityBody(panel, { velocity: [120, 0, 0], groundY: 720 }))
    .add(objectGravityBody(crate, { velocity: [0, 8, 0], groundY: 0 }));

await uiTimeline({ loop: true })
    .physics(gravity, { step: 1 / 15 })
    .play();
```

`groundY` を指定すると、そのY座標より下へ落ちないように止めます。これはゲーム本体の物理ではなく、スクリプトで位置を更新するだけの簡易処理です。

`GravityWorld` は UI と object の両方のタイムラインに接続できます。`physics(gravity, { step })` は物理を1tick進め、`physics(gravity, { duration, step })` は指定時間ぶん物理を進めます。

投げた物のような放物線は、初速と重力を指定して再現できます。

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

UI座標で上に投げる場合は、Y方向が画面下向きに増えることが多いため、上向き初速をマイナス、重力をプラスにします。

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

`GravityWorld` は全bodyを1回ずつ更新するだけなので、計算量はbody数に比例する `O(N)` です。全物体同士の衝突判定は `O(N^2)` になり、Portal上で複合オブジェクトやUIを同時に動かす用途では負荷が跳ね上がりやすいため、実装する予定はありません。地面Y座標で止める処理以外の衝突・接触・押し合い・ゲームオブジェクトとの物理連動も実装予定はありません。

このパッケージは、Portal の `mod.Wait`、UI の getter / setter、オブジェクトの Transform API、`mod.CreateVector` を使用します。

## 使い方

0. [link1345/Battlefield6-SampleTemplate](https://github.com/link1345/Battlefield6-SampleTemplate)のような複数のファイルを統合できるBF6 TypeScriptテンプレートを使って
1. `mods/bf6-animation.ts`を、統合フォルダに入れる
  - [link1345/Battlefield6-SampleTemplate](https://github.com/link1345/Battlefield6-SampleTemplate)ならば、`mods`フォルダに保存
2. 好きにコーディングする。
  - このリポジトリの`mods/Script.ts`にサンプルプログラムがある
3. ファイルを統合する
  - [link1345/Battlefield6-SampleTemplate](https://github.com/link1345/Battlefield6-SampleTemplate)ならば、`npm run build`で、1つのファイルを統合し、`dist`フォルダに出力される
4. BF6 PortalのWebエディタに登録する
  - [link1345/Battlefield6-SampleTemplate](https://github.com/link1345/Battlefield6-SampleTemplate)ならば、`dist`フォルダのtsファイルやjsonファイルを登録する
