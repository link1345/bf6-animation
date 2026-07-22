# bf6-animation

[English version](./README.md)

BF6 Portal の TypeScript で、UI とスポーンオブジェクトをタイムライン形式で動かすためのアニメーション補助スクリプトです。

アニメーションスクリプト本体は、 `mods/bf6-*.ts` です。サンプル実装はこのリポジトリでは `mods/Samples.ts`、Portal から呼ばれるイベント関数は `mods/Script.ts` にあります。

Portal SDK 1.4.1.0 の型情報で、`mod.Wait`、UI 作成/更新 API、ボタンイベント、`mod.SpawnObject`、`mod.SetObjectTransform` などを確認しています。

## Questions / Support

ご質問やご意見がありましたら、PlumRiceのDiscordサーバーでお気軽にご連絡ください

このプロジェクトに関する議論は、適切なスレッド／チャンネルをご利用ください。

https://discord.gg/Zy65k8AxH2

## できること

- `uiTimeline()` で UIWidget の位置、サイズ、背景色、透明度、文字、画像、ボタン色などを順番にアニメーションできます。
- `objectTimeline()` で `mod.SetObjectTransform` が受け取るオブジェクト型の位置と回転をアニメーションできます。
- `to()` に配列を渡すと、複数の UI やオブジェクトを同じ時間で同時に動かせます。
- `wait()` で待ち時間、`call()` で任意処理、`loop` でループ再生を挟めます。
- `RuntimeObject` で親子関係を持つ複合オブジェクトを作り、親の移動や回転を子へ伝播できます。
- `GravityWorld` で UI、通常オブジェクト、`RuntimeObject` に簡易的な重力移動を付けられます。

これはゲームエンジン本体の物理を置き換えるものではありません。スクリプトから座標や表示状態を小刻みに更新する、演出用の軽量な仕組みです。

## 注意点

- アニメーションさせる要素が多いほど、サーバーへの負荷が高くなります。全プレイヤーで共有できる情報は `receiver` を指定せずに作成し、チーム単位で共有できる情報は `AddUIContainer` などの `receiver` 引数に `Team` を渡してください。プレイヤーごとに個別表示する必要がない UI は、できるだけ共有表示に寄せるのがおすすめです。
- `step` の既定値は `1 / 15` です。 **細かくすると滑らかになりますが、Portal 上での更新回数が増えてサーバーへの負荷が増えます。**
- `GravityWorld` は登録された body を1つずつ更新するだけなので計算量は `O(N)` です。 **物体同士の衝突判定や押し合いはありません。**
- BF6 Portal の一部のオブジェクトには、ゲーム標準の物理演算が付いています。コードで一時的に宙へ浮かせても、スクリプトによる座標更新が止まると、ゲーム側の物理で地面に落ちる場合があります。
- UI の Y 座標とワールドの Y 座標では、向きの考え方が違う場合があります。UI の落下サンプルでは正の Y を下向き、オブジェクトの投擲サンプルでは負の Y を重力方向として扱っています。

## ファイル構成

```text
mods/
  Script.ts                Portal のイベント関数。サンプルメニューを作ってボタン入力を受け取る
  Samples.ts               UI、オブジェクト、重力のサンプルアニメーション集
  bf6-ui-animation.ts      UIWidget 用タイムライン
  bf6-object-animation.ts  TransformableObject と RuntimeObject 用タイムライン
  bf6-gravity.ts           簡易重力シミュレーション
  bf6-easings.ts           easing 関数
dist/
  Script.ts                npm run build で生成される Portal 登録用スクリプト
  Strings.json             Portal に登録する文字列
```

### 使い方(自分のプログラムにこのアニメーションスクリプトを組み込む)

自分のプログラムにこのアニメーションスクリプトを組み込む場合は、複数ファイルを統合できる BF6 Portal 用テンプレートを使うのがおすすめです。たとえば `deluca-mike/bf6-portal-scripting-template` や `link1345/Battlefield6-SampleTemplate` のようなテンプレートを使い、作業フォルダに `mods/bf6-*.ts` を入れて、Portal エディタへソースコードを登録する段階でファイルを統合してください。`mods/bf6-*.ts` 群は行数が多いため、コーディング中から1つのファイルへまとめて管理するのはおすすめしません。

## 使い方(サンプル)

1. 依存関係を入れます。

```sh
npm install
```

2. TypeScript をひとつの Portal 用スクリプトにまとめます。

```sh
npm run build
```

3. 生成された `dist/Script.ts` と、元からある `dist/Strings.json` を BF6 Portal の Web エディタに登録します。

4. Portal で体験を開始します。プレイヤーが出撃すると、画面左上にサンプルメニューが表示されます。

`mergeScript.js` は `mods` 配下の `.ts` ファイルを読み、静的 import を取り除いて `dist/Script.ts` にまとめます。Portal 側へアップロードするのは `mods` 配下の個別ファイルではなく、ビルド後の `dist/Script.ts` です。

## Portal 側で使っている主なAPI

Portal の TypeScript 型では、`mod.Wait(n)` は秒数を受け取って `Promise<void>` を返します。このライブラリは各 tick で `await mod.Wait(step)` しながら値を補間します。

UI は `mod.AddUIContainer`、`mod.AddUIText`、`mod.AddUIImage`、`mod.AddUIButton` で作成し、`mod.SetUIWidgetPosition` や `mod.SetUIWidgetSize`、`mod.SetUITextAlpha` などで更新します。ボタン入力は `mod.EnableUIButtonEvent(widget, mod.UIButtonEvent.ButtonDown, true)` のように有効化し、`OnPlayerUIButtonEvent` で受け取ります。

オブジェクトは `mod.SpawnObject(prefab, position, rotation, scale)` で生成し、`mod.SetObjectTransform(object, mod.CreateTransform(position, rotation))` で移動や回転を反映します。サンプルでは `mod.RuntimeSpawn_Common.Crate_01_A` を使っています。

SDK 1.4.1.0 では `mod.SetObjectTransform` がすべての `mod.Object` を受け取らなくなり、特に `Player` と `Vehicle` は対象外です。そのため、オブジェクトアニメーションと重力ヘルパーは SDK 関数の引数型から直接導出した `TransformableObject` を受け取ります。また、`mod.EnableSpatialObject` が SDK から削除されたため、従来の `enabled` トゥイーンプロパティも削除しました。

プレイヤー基準の位置計算では `mod.GetSoldierState(eventPlayer, mod.SoldierStateVector.GetPosition)` と `mod.GetSoldierState(eventPlayer, mod.SoldierStateVector.GetFacingDirection)` を使い、プレイヤーの前方に箱を出すようにしています。

## 基本コード

UI の通知を、右上から出して、文字を大きくし、少し待ってから消す例です。

```ts
import { uiTimeline } from "./bf6-ui-animation";

await uiTimeline()
    .to(panel, { visible: true, x: 34, bgAlpha: 0.9 }, { duration: 0.25, ease: "outCubic" })
    .to(accent, { visible: true, width: 720, bgAlpha: 1 }, { duration: 0.18, ease: "outCubic" })
    .to(title, { textAlpha: 1, textSize: 50 }, { duration: 0.2, ease: "outBack" })
    .wait(1.2)
    .to(title, { textAlpha: 0 }, { duration: 0.12, ease: "inCubic" })
    .to(panel, { x: -820, bgAlpha: 0, visible: false }, { duration: 0.22, ease: "inCubic" })
    .play();
```

`to()` は順番に実行されます。`duration` は秒数、`ease` は補間カーブです。`visible: true` はアニメーション開始前に表示され、`visible: false` はアニメーション終了後に非表示になります。

複数ターゲットを同時に動かす場合は配列を渡します。

```ts
await uiTimeline()
    .to([
        { target: fill, props: { position: [0, -292, 0], size: [760, 36], bgColor: [0.25, 1, 0.45] } },
        { target: edge, props: { x: 380, bgColor: [0.72, 1, 0.82] } },
        { target: label, props: { textColor: [0.25, 1, 0.72], textSize: 46 } },
    ], { duration: 0.34, ease: "outBack" })
    .play();
```

## シンプルにUI実装する

サンプル内では `addPanel()` や `addText()` のような補助関数を使っていますが、最小構成なら Portal の API を直接呼び出すだけでも動かせます。下の例は、プレイヤーが出撃した時に中央へパネルと文字を作り、`uiTimeline()` で表示、移動、フェードアウトを行います。

```ts
import { uiTimeline } from "./bf6-ui-animation";

export async function OnPlayerDeployed(eventPlayer: mod.Player): Promise<void> {
    const panelName = `simple-panel-${mod.GetObjId(eventPlayer)}`;
    const textName = `simple-text-${mod.GetObjId(eventPlayer)}`;

    if (mod.HasUIWidgetWithName(panelName)) {
        mod.DeleteUIWidget(mod.FindUIWidgetWithName(panelName));
    }

    mod.AddUIContainer(
        panelName,
        mod.CreateVector(0, -80, 0),
        mod.CreateVector(520, 132, 0),
        mod.UIAnchor.Center,
        mod.GetUIRoot(),
        false,
        8,
        mod.CreateVector(0.02, 0.04, 0.07),
        0,
        mod.UIBgFill.Solid,
        mod.UIDepth.AboveGameUI,
        eventPlayer,
    );

    const panel = mod.FindUIWidgetWithName(panelName);

    mod.AddUIText(
        textName,
        mod.CreateVector(0, 0, 0),
        mod.CreateVector(520, 132, 0),
        mod.UIAnchor.Center,
        panel,
        true,
        0,
        mod.CreateVector(0, 0, 0),
        0,
        mod.UIBgFill.None,
        mod.Message("SIMPLE UI"),
        34,
        mod.CreateVector(1, 1, 1),
        0,
        mod.UIAnchor.Center,
        mod.UIDepth.AboveGameUI,
        eventPlayer,
    );

    const text = mod.FindUIWidgetWithName(textName, panel);

    await uiTimeline()
        .to(panel, { visible: true, y: -40, bgAlpha: 0.9 }, { duration: 0.25, ease: "outCubic" })
        .to(text, { textAlpha: 1, textSize: 44 }, { duration: 0.2, ease: "outBack" })
        .wait(1)
        .to([
            { target: text, props: { textAlpha: 0, visible: false } },
            { target: panel, props: { y: -100, bgAlpha: 0, visible: false } },
        ], { duration: 0.25, ease: "inCubic" })
        .play();
}
```


## サンプルの動作

- サンプルはプレイヤーIDを widget 名に含め、複数プレイヤーで名前が衝突しにくいようにしています。
- 実行中のサンプルを止めるため、各サンプルは `control?.onCancel(() => timeline.stop())` を登録しています。

### UI SLIDE

![slide image](./docs/image/sample1.gif)

右上に横長の通知パネルが滑り込んできます。細いアクセントバーが伸び、タイトル文字が少し跳ねるように大きくなってから、全体が左へ抜けて消えます。

```ts
export async function sampleUiSlideNotification(eventPlayer: mod.Player, control?: SampleAnimationControl): Promise<void> {
    const playerId = samplePlayerId(eventPlayer);
    const panelName = `sampleUiSlideNotification-${playerId}-panel`;
    const accentName = `sampleUiSlideNotification-${playerId}-accent`;
    const titleName = `sampleUiSlideNotification-${playerId}-title`;

    resetWidgets([panelName]);

    const panel = addPanel(panelName, v(-820, 64), v(720, 164), mod.UIAnchor.TopRight, eventPlayer);
    mod.AddUIContainer(accentName, v(0, 0), v(0, 10), mod.UIAnchor.TopLeft, panel, false, 0, v(0.1, 0.85, 1), 0, mod.UIBgFill.Solid, eventPlayer);
    const accent = findWidget(accentName, panel);
    const title = addText(titleName, panel, mod.stringkeys.sample_ui_slide_title, v(36, 14), v(648, 136), 36, eventPlayer);

    const timeline = uiTimeline()
        .to(panel, { visible: true, x: 34, bgAlpha: 0.9 }, { duration: 0.25, ease: "outCubic" })
        .to(accent, { visible: true, width: 720, bgAlpha: 1 }, { duration: 0.18, ease: "outCubic" })
        .to(title, { textAlpha: 1, textSize: 50 }, { duration: 0.2, ease: "outBack" });

    control?.onCancel(() => timeline.stop());
    await timeline.play();
}
```

### UI GAUGE

![image2](./docs/image/sample2.gif)


画面中央付近にゲージが出て、バーが段階的に伸びます。青から黄色、赤、最後に緑へ色が変わるので、チャージや目標進行度の演出に向いています。

```ts
const timeline = uiTimeline()
    .to(panel, { y: -314, bgAlpha: 0.9 }, { duration: 0.18, ease: "outCubic" })
    .to(label, { textAlpha: 1, textSize: 42 }, { duration: 0.16, ease: "outBack" })
    .to([
        uiItem(fill, { position: [-250, -292, 0], size: [260, 36], bgColor: [0.2, 0.75, 1] }),
        uiItem(edge, { x: -120, bgColor: [0.65, 0.95, 1] }),
    ], { duration: 0.32, ease: "outCubic" })
    .to([
        uiItem(fill, { position: [0, -292, 0], size: [760, 36], bgColor: [0.25, 1, 0.45] }),
        uiItem(edge, { x: 380, bgColor: [0.72, 1, 0.82] }),
        uiItem(label, { textColor: [0.25, 1, 0.72], textSize: 46 }),
    ], { duration: 0.34, ease: "outBack" });
```

`fill` の幅だけを変えると中心基準で広がって見えるため、サンプルでは `position` と `size` を同時に動かし、左端が固定されているように見せています。

### UI GRAVITY

![image3](./docs/image/sample3.gif)

クエスチョンマークが斜め上から落ちてきます。落下後に影が広がり、アイコンと影がフェードアウトします。動きは `GravityWorld` が担当し、タイムラインは「物理を一定時間進める」「影を広げる」「消す」という順番を管理します。

```ts
const gravity = new GravityWorld({ gravity: [0, 920, 0] })
    .add(uiGravityBody(icon, { velocity: [260, -180, 0], groundY: 170 }));

const timeline = uiTimeline()
    .to(shadow, { bgAlpha: 0.12, width: 24 }, { duration: 0 })
    .physics(gravity, { duration: 1.05, step: 1 / 15 })
    .to(shadow, { bgAlpha: 0.4, width: 128 }, { duration: 0.16, ease: "outCubic" })
    .wait(0.6)
    .to([
        { target: icon, props: { imageAlpha: 0, visible: false } },
        { target: shadow, props: { bgAlpha: 0, visible: false } },
    ], { duration: 0.2, ease: "inCubic" });
```

UI 座標では Y が下向きに増える前提で、重力を正の Y、上向き初速を負の Y にしています。

### ROUND UI

![image4](./docs/image/sample4.gif)

画面中央にラウンド切り替え風の大型表示が出ます。横線が左右へ伸び、タイトルとサブタイトルが表示され、少し待ってから縮むように消えます。

```ts
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
    ], { duration: 0.22, ease: "inCubic" });
```

### OBJ MOVE

![image5](./docs/image/sample5.gif)

プレイヤーの前に箱を出し、左右と上下に移動させます。`sampleObjectPoint()` はプレイヤーの現在位置と向きから、右、上、前方のオフセットを計算します。

```ts
const object = spawnSampleObject(prefab, sampleObjectPoint(eventPlayer, -1.2, 1.2, 3), v(0, 0, 0), v(1.8, 1.8, 1.8));

const timeline = objectTimeline()
    .to(object, { position: sampleObjectPointArray(eventPlayer, 1.2, 2, 3) }, { duration: 0.45, ease: "outCubic" })
    .to(object, { position: sampleObjectPointArray(eventPlayer, -1.2, 2, 3.8) }, { duration: 0.45, ease: "inOutCubic" })
    .to(object, { position: sampleObjectPointArray(eventPlayer, 0, 1.2, 3) }, { duration: 0.45, ease: "outBack" });
```

プレイヤー基準の点は、次のように作っています。

```ts
const position = mod.GetSoldierState(eventPlayer, mod.SoldierStateVector.GetPosition);
const facing = mod.GetSoldierState(eventPlayer, mod.SoldierStateVector.GetFacingDirection);
const forwardX = mod.XComponentOf(facing) / facingLength;
const forwardZ = mod.ZComponentOf(facing) / facingLength;
```

### OBJ ROTATE

![image6](./docs/image/sample6.gif)

箱をプレイヤーの前に出し、ヨー回転、ピッチとロールの傾き、最後に一回転を順番に見せます。Portal のオブジェクト回転は `mod.Vector` の X/Y/Z 成分で扱われ、このライブラリでは `pitch`、`yaw`、`roll` として指定できます。

```ts
const timeline = objectTimeline()
    .to(object, { yaw: Math.PI / 2 }, { duration: 0.4, ease: "outCubic" })
    .to(object, { pitch: Math.PI / 5, roll: -Math.PI / 8 }, { duration: 0.4, ease: "inOutCubic" })
    .to(object, { rotation: [0, Math.PI * 2, 0] }, { duration: 0.6, ease: "linear" });
```

### OBJ PARENT

![image7](./docs/image/sample7.gif)

`RuntimeObject` の親子関係を見せるサンプルです。大きい箱を親、小さい箱を子として作り、親が前へ動く間に子だけが回転します。その後、親全体を回転させるため、子も親に追従します。

```ts
const parent = new RuntimeObject(prefab, sampleObjectPointArray(eventPlayer, 0, 1.2, 3.2), [0, 0, 0], [0, 1, 0], 0, [1.8, 1.8, 1.8]);
const child = parent.NewChild(prefab, [0, 0.25, 1.4], [0, 0, 0], [0, 1, 0], 0, [0.9, 0.9, 0.9]);

const timeline = objectTimeline()
    .to([
        { target: parent, props: { moveBy: [0, 0, 1.2] } },
        { target: child, props: { qRotateBy: { axis: [0, 1, 0], angle: Math.PI * 2 } } },
    ], { duration: 1.2, ease: "inOutCubic" })
    .to(parent, { qRotateBy: { axis: [0, 1, 0], angle: Math.PI } }, { duration: 0.8, ease: "outCubic" });
```

`RuntimeObject` の回転はクォータニオンで内部管理し、最後に Portal の `mod.SetObjectTransform` へ反映します。

### OBJ POINTS

![image8](./docs/image/sample8.gif)


箱が複数の点を渡り歩くサンプルです。短い `wait(0.1)` を挟むことで、ただの直線移動ではなく、点を踏んで跳ねるようなテンポになります。

```ts
const timeline = objectTimeline()
    .to(object, { position: sampleObjectPointArray(eventPlayer, -0.7, 2.8, 3.2) }, { duration: 0.35, ease: "outCubic" })
    .wait(0.1)
    .to(object, { position: sampleObjectPointArray(eventPlayer, 0.7, 1.7, 2.7) }, { duration: 0.35, ease: "inOutCubic" })
    .wait(0.1)
    .to(object, { position: sampleObjectPointArray(eventPlayer, 1.8, 3.4, 3.7) }, { duration: 0.35, ease: "outBack" })
    .to(object, { position: sampleObjectPointArray(eventPlayer, 0, 1.2, 3.2) }, { duration: 0.5, ease: "inOutCubic" });
```

### OBJ THROW

![image9](./docs/image/sample9.gif)

`TransformableObject` に `GravityWorld` を接続して、前方へ投げるような放物線を作ります。ワールド座標の Y は上方向として扱っているため、重力は負の Y です。

```ts
const start = sampleObjectPoint(eventPlayer, -1.4, 1.1, 3);
const object = spawnSampleObject(prefab, start, v(0, 0, 0), v(1.8, 1.8, 1.8));
const groundY = mod.YComponentOf(start) - 1.2;

const gravity = new GravityWorld({ gravity: [0, -9.8, 0] })
    .add(objectGravityBody(object, { velocity: [6, 8, 0], groundY }));

await objectTimeline()
    .physics(gravity, { duration: 1.2, step: 1 / 15 })
    .play();
```

### RT GRAVITY

![image10](./docs/image/sample10.gif)

親子構成の `RuntimeObject` 全体を重力で落とします。`runtimeObjectGravityBody()` が `GravityWorld` と `RuntimeObject` の間をつなぎ、移動量を `object.Move(delta)` と `object.ApplyTransform()` に変換します。

```ts
const runtime = new RuntimeObject(prefab, [mod.XComponentOf(start), mod.YComponentOf(start), mod.ZComponentOf(start)], [0, 0, 0], [0, 1, 0], 0, [1.7, 1.7, 1.7]);
runtime.NewChild(prefab, [0, 0, 1.4], [0, 0, 0], [0, 1, 0], 0, [0.85, 0.85, 0.85]);

const gravity = new GravityWorld({ gravity: [0, -9.8, 0] })
    .add(runtimeObjectGravityBody(runtime, { velocity: [0, 1, 0], groundY }));

await objectTimeline()
    .physics(gravity, { duration: 1, step: 1 / 15 })
    .play();
```

### OBJ FLOAT

![image11](./docs/image/sample11.gif)

直接 Y 座標を tween せず、重力方向を途中で反転させて、箱がふわふわ浮くような動きを作ります。`call()` はタイムラインの途中で値を書き換えたい時に使います。

```ts
const gravity = new GravityWorld({ gravity: [0, 7.5, 0] })
    .add(objectGravityBody(object, { velocity: [0, 1.2, 0] }));

const timeline = objectTimeline()
    .physics(gravity, { duration: 0.22, step: 1 / 15 })
    .call(() => { gravity.gravity = [0, -8.5, 0]; })
    .physics(gravity, { duration: 0.45, step: 1 / 15 })
    .call(() => { gravity.gravity = [0, 8.5, 0]; })
    .physics(gravity, { duration: 0.45, step: 1 / 15 });
```
