# PrismLab — 論文グラフ＆統計スタジオ

GraphPad Prism 風のワークフロー（**データ表 → 解析 → グラフ → レイアウト**）を、
依存ライブラリゼロの単一HTMLで実装した完全オフラインのWebアプリ。

- 実体は `index.html` の1ファイルのみ。ダブルクリックで開けば動きます。
- ローカルサーバで確認する場合： `.claude/launch.json` の `prism-lab`（port 8951）

## 編集の仕方（重要）

`index.html` は **`build/` 以下のパーツを結合して生成** しています。直接編集せず、

1. `build/*.js`（または `build/00_base.html`）を編集
2. `./assemble.sh` を実行（構文チェック付きで `index.html` を再生成）

| ファイル | 内容 |
|---|---|
| `build/00_base.html` | HTML骨格・CSS・数学/統計コア（特殊関数〜Cox回帰まで） |
| `build/05_state.js` | プロジェクト状態・データモデル・セル値ユーティリティ |
| `build/06_ui.js` | ナビゲータ・ツールバー・シート切替・モーダル |
| `build/07_table.js` | データ表（スプレッドシート）の描画と編集 |
| `build/08_io.js` | xlsx/CSV入出力・変換・デモデータ |
| `build/09_analysis.js` | 解析の定義（20種類以上）と結果表示 |
| `build/10_graph.js` | SVGグラフ描画エンジン（25種類以上） |
| `build/11_graphui.js` | グラフ作成ダイアログ・書式インスペクタ・画像出力 |
| `build/12_layout.js` | レイアウト（複数パネル図） |
| `build/13_mixed.js` | 混合効果モデル（REML・欠測のある反復測定） |
| `build/14_fitting.js` | ROUT外れ値除去・共有パラメータのグローバルフィット |
| `build/15_pzfx.js` | GraphPad Prism (.pzfx) 読み込み |
| `build/16_pdf.js` | PDF直接生成（FlateDecodeで可逆埋め込み） |
| `build/19_boot.js` | ようこそ画面と起動処理（最後に読み込む） |

## 数値の検証

scipy / statsmodels と照合済み：一元配置ANOVA（F・p）、Tukey（q・p・CI）、Dunnett、
Bartlett、Brown-Forsythe、二元配置ANOVA（SS/df/MS/F/p・Šídák事後）、
非線形回帰（パラメータ・SE・95%CI・R²・Sy.x が curve_fit と7桁以上一致）。
2群比較・ノンパラメトリック・分割表・生存解析・回帰系の実装は stat-atelier から継承（検証済み）。
混合効果モデル（REML）は、完全データで反復測定ANOVAと一致すること、欠測データで独立実装の
Python/numpy REML（σ²b・σ²e・ICC・logLik・Wald F）と一致することを確認済み。
ROUTは既知の外れ値を混入させたデータでパラメータが元に戻ることを確認。
PDFは xref オフセットと /Length の整合を検証し、macOS Quick Look で描画確認済み。

## 公開

GitHub Pages: https://maro515.github.io/prism-lab/
