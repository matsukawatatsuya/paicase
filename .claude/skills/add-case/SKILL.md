---
name: add-case
description: physical-ai-trackerに新しいフィジカルAI事例を1件以上追加し、GitHub Pagesの公開サイトに反映する。ユーザーが新事例の記事URL・概要を渡してきたとき、または「事例を追加して」「新しい事例を入れて」「情報を更新して」と言われたときに使う。
---

新しいフィジカルAI事例を `data/source-pool.json` に追加し、タグ付け・DB反映・公開サイトへのデプロイまでを行う手順。

## 1. 候補データを `data/source-pool.json` に追記する

配列の末尾に以下の形式でオブジェクトを追加する（既存エントリを参考にする）:

```json
{
  "title": "記事タイトル",
  "url": "https://...",
  "publishedDate": "YYYY-MM-DD",
  "sourceName": "配信元名",
  "company": "導入企業名",
  "summary": "3〜4文程度の要約",
  "imageUrl": "https://... または null",
  "industryHints": ["製造業"],
  "useCaseHints": ["ピッキング・搬送"],
  "vendorHints": ["Agility Robotics"],
  "countryHints": ["カナダ"]
}
```

タグ付けの実際の挙動（`services/tagger.js` / `services/taxonomy.js`）:

- **industryHints / useCaseHints**: title・summary・company本文と合わせてキーワード照合される。ヒントは自由記述でよいが、`services/taxonomy.js` の `INDUSTRIES` / `USE_CASES` のkeywords配列に一致する語を含めると確実にタグが付く。
- **vendorHints / countryHints**: 本文全体からは照合されず、ここに入れた値だけが `VENDORS` / `COUNTRIES` のkeywordsと照合される（導入企業名との衝突を避けるため）。**`services/taxonomy.js` に存在するベンダー名・国名と一致する語を入れること。** 新しいベンダー・国が登場した場合は、先に `services/taxonomy.js` の `VENDORS` / `COUNTRIES` 配列にエントリを追記してからcandidateを追加する。
- **ロボットタイプ**: hintsは不要。title・summaryから `ROBOT_TYPES`（ヒューマノイド／ロボットアーム／四足歩行ロボット／AMR・AGV／自動運転車／ドローン）のキーワードで自動検出される。
- 重複判定は `services/dedupe.js` がタイトルの類似度（バイグラムJaccard）またはURL一致で行い、`officialScore`（公式サイト・プレスリリース=3、主要メディア=2、その他=1）がより高い情報だけを残す。同一事例を複数ソースから追加しても問題ない。

## 2. ローカルサーバーを起動する

```
npm start
```

（既に起動していればスキップ）`http://localhost:3000` で待ち受ける。ASCIIパス以外（OneDriveの日本語パスなど）ではnodeがクラッシュするため、必ずこのリポジトリの場所で実行すること。

## 3. 更新パイプラインを実行する

```
curl -X POST http://localhost:3000/api/update
```

`data/source-pool.json` の未取得分を重複排除・自動タグ付けしてSQLite DB（`db/physical-ai.sqlite`）に反映する。レスポンスで追加・更新・スキップ件数を確認する。

## 4. 静的データに書き出す

```
node db/export.js
```

DBの内容が `docs/data.json` に書き出される。

## 5. サーバーを停止し、コミット・プッシュする

ローカルサーバーを停止したら、公開サイトに関わる差分だけをコミットする:

```
git add docs/data.json
git commit -m "..."
git push
```

`data/source-pool.json` に変更があればあわせてコミットする。`db/physical-ai.sqlite` はローカルの作業DBなのでコミット対象に含めない。数分でGitHub Pages側に反映される。

## 注意点

- 事例が1件も一致しない業種・ユースケース・国・ベンダーになった場合は、タグが空のまま登録される（エラーにはならない）。追加後は `docs/data.json` を確認し、意図したタグが付いているか確認するとよい。
- `services/taxonomy.js` を編集した場合は、`node -e "require('./db/seed').seedMaster()"` 等でマスタテーブルに反映してから更新パイプラインを実行する（`npm start` 時にも自動実行される）。
