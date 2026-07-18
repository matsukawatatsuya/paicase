---
name: add-case
description: physical-ai-trackerに新しいフィジカルAI事例を1件以上追加し、GitHub Pagesの公開サイトに反映する。ユーザーが新事例の記事URL・概要を渡してきたとき、または「事例を追加して」「新しい事例を入れて」「情報を更新して」と言われたときに使う。
---

新しいフィジカルAI事例を `data/source-pool.json` に追加し、タグ付け・DB反映・公開サイトへのデプロイまでを行う手順。

## 1. ソースURLが公式記事かどうか確認する

ユーザーからソースのURLを指定された場合、そのURLをそのまま使う前に、同じ内容（同一企業・同一事例）を報じた公式記事（企業のプレスリリース・公式ブログ・製品ページなど）がないかWeb検索する。

- 公式記事が見つかった場合は、指定されたURLの代わりにその公式記事を`url`・`sourceName`として採用する（`officialScore`が高いほど重複時に優先されるため、公式記事を使うほうが望ましい。詳細は後述のタグ付けの実際の挙動を参照）。
- 公式記事が見つからない場合は、指定されたURLをそのまま使う。
- 元のURLと公式記事の内容に矛盾・食い違いがある場合は、公式記事の内容を優先しつつユーザーに確認する。

## 2. 候補データを `data/source-pool.json` に追記する

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
  "countryHints": ["カナダ"],
  "phaseHints": ["本番稼働フェーズ"]
}
```

**phaseHintsの判定基準**: 記事本文を読み、実際に「本番稼働（実運用）」なのか「実証実験（パイロット・トライアル・PoC）」なのかを確認して、必ずどちらか1つだけを配列に入れる（`vendorHints`等と同じく本文全体からの自動検出はしない）。

- `本番稼働フェーズ`: 「本格稼働」「商用運用」「実運用」など、実際に継続的な業務で使われていると明言されている、または稼働期間・処理件数・削減効果など運用実績の数値が示されている場合。
- `実証実験フェーズ`: 「実証実験」「パイロット」「試験導入」「PoC」「検証段階」「試作機」など、実験・試行段階であることが明言されている場合。
- 判定できない場合（発表・契約締結・将来計画のみで稼働状況が本文に書かれていない等）は `["フェーズ不明"]` とする。無理に本番稼働/実証実験のどちらかに寄せない。

**imageUrlの取得方法**: 記事ページをそのまま読み込むツール（WebFetch等）はLLM要約を介するため、`og:image`/`twitter:image`のメタタグを見落とすことがある（特にNikkei等の会員制・JS描画サイト）。`null`と判断する前に、必ず以下のように生HTMLを直接取得してメタタグを確認すること:

```
curl -s -A "Mozilla/5.0" "<記事URL>" | grep -o '<meta[^>]*og:image[^>]*>\|<meta[^>]*twitter:image[^>]*>'
```

取得できた画像URLは追加前に `curl -s -o /dev/null -w "%{http_code}"` 等で200が返ることを確認してから使う。

タグ付けの実際の挙動（`services/tagger.js` / `services/taxonomy.js`）:

- **industryHints / useCaseHints**: title・summary・company本文と合わせてキーワード照合される。ヒントは自由記述でよいが、`services/taxonomy.js` の `INDUSTRIES` / `USE_CASES` のkeywords配列に一致する語を含めると確実にタグが付く。
- **vendorHints / countryHints**: 本文全体からは照合されず、ここに入れた値だけが `VENDORS` / `COUNTRIES` のkeywordsと照合される（導入企業名との衝突を避けるため）。**`services/taxonomy.js` に存在するベンダー名・国名と一致する語を入れること。** 新しいベンダー・国が登場した場合は、先に `services/taxonomy.js` の `VENDORS` / `COUNTRIES` 配列にエントリを追記してからcandidateを追加する。
- **phaseHints**: vendorHints/countryHintsと同様、本文全体からは照合されず`phaseHints`の値だけが`PHASES`（`本番稼働フェーズ` / `実証実験フェーズ` / `フェーズ不明`）と照合される。省略した場合は自動的に`フェーズ不明`になる（`services/tagger.js`のデフォルト挙動）。判定基準は上記参照。
- **ロボットタイプ**: hintsは不要。title・summaryから `ROBOT_TYPES`（ヒューマノイド／ロボットアーム／四足歩行ロボット／AMR・AGV／自動運転車／ドローン）のキーワードで自動検出される。
- 重複判定は `services/dedupe.js` がタイトルの類似度（バイグラムJaccard）またはURL一致で行い、`officialScore`（公式サイト・プレスリリース=3、主要メディア=2、その他=1）がより高い情報だけを残す。同一事例を複数ソースから追加しても問題ない。

## 3. ローカルサーバーを起動する

```
npm start
```

（既に起動していればスキップ）`http://localhost:3000` で待ち受ける。ASCIIパス以外（OneDriveの日本語パスなど）ではnodeがクラッシュするため、必ずこのリポジトリの場所で実行すること。

## 4. 更新パイプラインを実行する

```
curl -X POST http://localhost:3000/api/update
```

`data/source-pool.json` の未取得分を重複排除・自動タグ付けしてSQLite DB（`db/physical-ai.sqlite`）に反映する。レスポンスで追加・更新・スキップ件数を確認する。

## 5. 静的データに書き出す

```
node db/export.js
```

DBの内容が `docs/data.json` に書き出される。

## 6. サーバーを停止し、コミット・プッシュする

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
- **既に登録済みの事例（同一URL）を後から修正したい場合、`data/source-pool.json` を直すだけでは反映されない。** `services/dedupe.js` は同一URLを重複とみなし、`services/updatePipeline.js` は新候補の`officialScore`が既存より**厳密に高い**場合しか上書きしない（同スコアなら無条件スキップ）。画像URLの追加など、スコアが変わらない修正をする場合は、以下のいずれかで対応する:
  - `db/init.js` の `getDb()` を使い、Node一行スクリプトで対象レコードを直接 `UPDATE cases SET ... WHERE url = ?` する（`db.run`実行後は自動でファイルに永続化される）
  - または対象レコードをDBから`DELETE`してから`/api/update`を再実行し、`source-pool.json`の修正済みデータで再登録させる
  - どちらの方法でも、修正後は必ず `node db/export.js` を再実行して `docs/data.json` に反映すること
