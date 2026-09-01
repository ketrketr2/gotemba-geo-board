# 御殿場GEOボード（gotemba-geo-board）

御殿場プレミアム・アウトレットの「語られ方」定点観測ボード。
AI4面（ChatGPT / Gemini / GoogleのAI Overview / AIモード）・Google検索需要・
クチコミ／オープンデータを週次で計測し、暗号化ゲート付き GitHub Pages で配信する。

- 公開URL（ゲート付き）: https://ketrketr2.github.io/gotemba-geo-board/
- 技術資産の流用元: [toyota-geo-board](https://github.com/ketrketr2/toyota-geo-board)（計測基盤）/ [toyota-car-board](https://github.com/ketrketr2/toyota-car-board)（表示・ゲート・検証）

## 構成（1リポジトリ同居）

```
config/    settings.yaml（4面・予算・クォータ）/ outlets.yaml（施設・テーマ辞書）/ domains.yaml（引用分類）
prompts/   registry.yaml … クエリレジストリ（IDは絶対に振り直さない）
src/       run_round.py（週次計測）/ probe.py（API疎通）/ score_demand.py（需要スコアと入替）
           llm.py（DataForSEO 4面呼び出し・リダイレクタ復元）/ detect.py（施設・テーマ・ペルソナ検出）
tools/     aggregate_board.py → build.py → verify.js → encrypt.py → verify_gate.js / pull_trend.py
data/      snapshots/（回答全文＋引用の生データ）/ board_seed.json（R0シード）
docs/      公開ディレクトリ（GitHub Pages: main /docs）
```

## セットアップ（初回のみ）

1. Settings > Secrets and variables > Actions に3件登録（Nameは一字一句この通り）
   - `DATAFORSEO_LOGIN` / `DATAFORSEO_PASSWORD`（https://app.dataforseo.com/ の API Access）
   - `GOTEMBA_GATE_KEY`（閲覧ゲートの "id:pw" 連結文字列。トヨタ側とは別の値にする）
2. Settings > Pages > Deploy from a branch > `main` / `docs`
3. Actions > probe を手動実行（各API 1呼・$2上限）→ ログで構造と単価を確認
4. `src/score_demand.py --apply` で需要スコア付け → active ≒120本を確定（Actions化予定）
5. Actions > round を手動実行（テスト1周 ≒$12–15）→ snapshot検品 → cron有効化

## 品質ルール（全て実事故由来・厳守）

- デモ値・推定値をボードに載せない。取れない数値は「—」（run系にデモモードは無い）
- クエリIDは絶対に振り直さない（時系列が壊れる）
- 回答本文・引用は全文保存（指標の再定義・再計算のため）
- playwright検証 ERRORS: none になるまで公開しない（verify.js / verify_gate.js）
- フォントは BIZ UDPGothic を非ブロッキング読込（document.write 後の同期linkは白画面）
- reveal演出に IntersectionObserver を使わない（スクショ透明化）→ stagger setTimeout
- Secrets・ゲートPW・APIキーをコード／ログ／ボードに出さない（echo禁止）

## ボード（表示側）

`tools/part_head.html` + `tools/part_js1.js` が本体。`window.BOARD_DATA`（= `tools/board_data.json`）を
読み、V1サマリー〜V9 KPI再設計＋連携ティザー3面（SNS / GA4×Affinity / CRM）を描画する。
R0時点は `data/board_seed.json`（出典付き実データ＋設計サンプル。サンプルはUI上で明示タグ付き）。
計測が始まると `tools/aggregate_board.py` が実測値で順次上書きする。
