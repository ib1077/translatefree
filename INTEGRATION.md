# 路線図appとの統合に向けた分離

現在の路線図app 13.9Xの紙色 `#fcfcfa`、紺の操作帯 `#173b4c`、右側58pxの操作帯、タイトルから横向き本体へ入る構成を参考にしています。路線図appのソース自体は変更していません。

## 機能の境界

| ファイル | 役割 |
|---|---|
| diagram-data.json | 元Excel①の時刻・距離・元セル。UI変更前と同じデータ |
| diagram-core.js | データ検証、時刻表示、固定配色。画面や保存領域に依存しない |
| diagram-view.js | 任意のSVGへ描画するcreateViewer。画面IDやlocalStorageに依存しない |
| pan-zoom.js | viewerへドラッグ・ピンチ・慣性・ホイール操作を接続。回転したSVG座標も処理 |
| app.js | タイトル、横向き表示、右側操作、DATA保存、印刷などこのアプリの画面構成 |
| ui-config.js | 表示用の版・年月。元資料の適用日とは分離 |

単独HTMLはこの同じ部品とJSONを埋め込んで生成します。PWAと別々の描画ロジックを持ちません。

## 別の画面に組み込む例

`diagram-core.js`、`diagram-view.js`、`pan-zoom.js` と必要なCSSを読み込みます。`app.js` は読み込まず、統合側で画面遷移や保存を管理できます。SVGは実際の幅・高さを持つ要素にしてください。

```js
const viewer = ChizuDiagram.createViewer({
  svg: diagramSvg,
  data: diagramData,
  onSelect(trainId) { /* 統合側の選択処理 */ },
  onViewChange(view) { /* view.start / view.end は午前0時からの秒 */ }
});
const gestures = ChizuDiagram.attachGestures({
  surface: diagramViewport,
  viewer,
  onTap(point) {
    const trainId = viewer.pick(point);
    if (trainId) viewer.select(trainId);
  }
});
viewer.setRange(12 * 3600, 3 * 3600);
viewer.setFilters({up: true, down: true});
// 非表示にする前には残った指操作・慣性を終了。
gestures.reset();
// 再表示時（ResizeObserverでも追従）
viewer.schedule();
// 完全に取り外す時
gestures.destroy();
viewer.destroy();
```

createViewerはインスタンスごとに独立した表示範囲・フィルターと固有のSVGクリップIDを持ちます。印刷の上下2図もこの方式で描画しています。元データは書き換えません。

## 現在の画面から通知するイベント

`#app-shell` からDOMのカスタムイベントを発火します。保存・ネットワーク送信は行いません。

- `chizu:viewportchange`：`detail = {startSeconds, endSeconds}`
- `chizu:trainselect`：`detail = {trainId, direction}`。選択解除はnull。

列車番号は元ExcelのIDを保持し、駅地点には元表記と累積距離が含まれます。将来の路線図とつなぐ際には、このデータを介して対応させます。画面上のピクセル位置では関連付けません。

元Excelの智頭は56.05、路線図appの全長表示は56.1です。同じ名前というだけで距離を上書き・丸めず、統合時に起点・単位・駅名の対応を確認してください。現段階では両アプリのデータやservice workerを結合していません。統合後のservice workerは統合アプリ側で1つに管理する想定です。
