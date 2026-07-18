# フィジカルAI事例トラッカー

2026年1月以降の世界のフィジカルAI実導入事例を収集・タグ付けし、業種×ユースケースのクロス集計で可視化するWebアプリ。`docs/` 配下は完全に静的なファイル（HTML/CSS/JS + data.json）のみで動作し、GitHub Pagesなどの静的ホスティングにそのまま公開できる。

## 公開サイト（GitHub Pages）

`docs/` フォルダをGitHub Pagesのソースに指定するだけで公開できる（Settings → Pages → Source: Deploy from a branch → Branch: main / docs）。`docs/app.js` は `docs/data.json` を読み込み、クロス集計・絞り込みをすべてブラウザ側で計算するため、サーバーは不要。

## ローカルでの動作確認・データ管理用の起動方法

```
cd physical-ai-tracker
npm install
npm start
```

ブラウザで http://localhost:3000 を開く（`docs/` を静的配信するだけの開発用サーバー）。

**注意（重要）**: このプロジェクトは `C:\Users\matsu\physical-ai-tracker`（ASCIIパス）に配置している。このPCではnode/npmの実行ディレクトリに日本語などの非ASCII文字が含まれると`node`がクラッシュする既知の問題があるため、`OneDrive\ドキュメント\Claude`配下では動かさないこと。

## できること

- 業種×ユースケースのクロス集計表（件数はクリックで絞り込み、行・列はマウスオーバーでハイライト）
- フェーズ（本番稼働／実証実験／不明）でのチップ絞り込み。記事内容を確認して手動で判定した値で、他の絞り込み条件とAND条件で組み合わせられる
- ロボットベンダー（Agility Robotics、Figure AIなど）名でのチップ絞り込み。業種・ユースケースと組み合わせてAND条件で絞り込める
- 事例一覧（画像・タイトル・日付・出典）
- 事例クリックでサマリーモーダル表示。モーダル内のタグをクリックするとそのタグ1件だけで絞り込んだ一覧に戻る。「詳細表示」でソース記事を別タブで開く

## データの更新方法

事例データは `data/source-pool.json`（リサーチ済みの候補プール、2026年7月時点で88件）が元になっている。更新の流れ：

1. `data/source-pool.json` に新しい候補を追加する（または `services/searchAdapter.js` を実検索APIに差し替えて自動収集する）
2. ローカルサーバーを起動した状態で `curl -X POST http://localhost:3000/api/update` を実行し、重複排除・自動タグ付けしてSQLite DB（`db/physical-ai.sqlite`）に反映する
3. `node db/export.js` を実行し、DBの内容を `docs/data.json` に書き出す
4. `docs/data.json` の変更をコミット・pushすればGitHub Pages側にも反映される

「情報更新」を叩くAPI（`/api/update`）は開発用サーバー上でのみ動作し、公開サイト（GitHub Pages）側には存在しない。公開版のデータ更新は必ずこの手順でdata.jsonを作り直してデプロイする。

## 検索アダプタを実際のAPIに差し替える方法

`services/searchAdapter.js` の `fetchCandidates()` を、Google Custom Search API や Bing Web Search API を呼び出す実装に差し替えるだけでよい。戻り値の形（title, url, publishedDate, sourceName, company, summary, imageUrl, industryHints, useCaseHints）を維持すれば、重複排除・タグ付け・DB反映のロジック（`services/updatePipeline.js`）はそのまま使える。ファイル内にGoogle Custom Search向けの実装例をコメントで記載している。

## 重複排除・公式度スコアリングについて

同一事例が複数ソースで見つかった場合、`services/dedupe.js` の `officialScore()` が情報源の「公式度」を判定する（企業公式サイト・プレスリリース=3、主要メディア=2、その他=1）。タイトルの類似度（バイグラムJaccard）またはURL一致で重複を検知し、より公式度の高い情報だけを残す。

## 業種・ユースケースの分類定義

`services/taxonomy.js` に業種11種・ユースケース13種・ロボットベンダー35種のキーワード辞書を定義。`services/tagger.js` がタイトル・要約・企業名・収集時のヒントと照合して自動タグ付けする。分類を増やしたい場合はこのファイルを編集する。

**ベンダー判定のみ挙動が異なる点に注意**: 業種・ユースケースはタイトル・要約本文からも自動検出するが、ベンダー名（例:「トヨタ」）は導入企業名と衝突しやすいため、本文全文とは照合せず `vendorHints`（収集時に確認した正確なベンダー名）とだけ照合する。検索アダプタを実APIに差し替える際は、候補データに `vendorHints` を必ず含めること（省略するとベンダータグが一切付かない）。

## 技術構成

- バックエンド: Node.js + Express
- DB: sql.js（WASM版SQLite、ネイティブビルド不要）
- フロントエンド: 素のHTML/CSS/JS（ビルド不要）
