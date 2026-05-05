# bf6-ui-anime

[English version](./README.md)

Battlefield 6 Portal のカスタム UI 向けに、タイムラインベースのアニメーションヘルパーを提供します。

```ts
import { timeline } from "bf6-ui-anime";

await timeline()
    .to(panel, { visible: true, x: 24, bgAlpha: 0.85 }, { duration: 0.35, ease: "outCubic" })
    .to(title, { textAlpha: 1, textSize: 28 }, { duration: 0.25, ease: "outBack" })
    .wait(2)
    .to(panel, { x: -320, bgAlpha: 0, visible: false }, { duration: 0.3, ease: "inCubic" })
    .play();
```

このパッケージは、Portal の `mod.Wait`、UI の getter / setter、`mod.CreateVector` を使用します。

## 使い方

0. [link1345/Battlefield6-SampleTemplate](https://github.com/link1345/Battlefield6-SampleTemplate)のような複数のファイルを統合できるBF6 TypeScriptテンプレートを使って
1. `mods/bf6-ui-anime.ts`を、統合フォルダに入れる
  - [link1345/Battlefield6-SampleTemplate](https://github.com/link1345/Battlefield6-SampleTemplate)ならば、`mods`フォルダに保存
2. 好きにコーディングする。
  - このリポジトリの`mods/Script.ts`にサンプルプログラムがある
3. ファイルを統合する
  - [link1345/Battlefield6-SampleTemplate](https://github.com/link1345/Battlefield6-SampleTemplate)ならば、`npm run build`で、1つのファイルを統合し、`dist`フォルダに出力される
4. BF6 PortalのWebエディタに登録する
  - [link1345/Battlefield6-SampleTemplate](https://github.com/link1345/Battlefield6-SampleTemplate)ならば、`dist`フォルダのtsファイルやjsonファイルを登録する