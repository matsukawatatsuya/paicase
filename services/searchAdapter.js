// 検索アダプタ: 「情報更新」ボタンが呼び出す、Web上の候補事例を取得するインターフェース。
//
// 現在の実装は data/source-pool.json （リサーチ済みの候補プール）から読み込むダミー実装。
// 実際の検索APIキーを取得したら、下記 fetchCandidates() の中身だけを差し替えれば良い。
//
// --- Google Custom Search API に差し替える場合の例 ---
//   const res = await fetch(
//     `https://www.googleapis.com/customsearch/v1?key=${API_KEY}&cx=${CX}&q=${encodeURIComponent(query)}`
//   );
//   const json = await res.json();
//   return json.items.map(item => ({
//     title: item.title,
//     url: item.link,
//     summary: item.snippet,
//     sourceName: item.displayLink,
//     imageUrl: item.pagemap?.cse_image?.[0]?.src || null,
//     publishedDate: null, // 別途ページ側のog:published_timeなどから取得
//     company: null,
//     industryHints: [],
//     useCaseHints: [],
//     vendorHints: [], // ロボットベンダー名は本文から自動検出しないため、ここに正確な値を入れる必要がある
//   }));
// --- Bing Web Search API の場合も同様に webPages.value を同じ形へマッピングする ---
//
// 戻り値は候補オブジェクトの配列。各要素は下記の形を満たす必要がある:
// { title, url, publishedDate(YYYY-MM-DD), sourceName, company, summary, imageUrl, industryHints[], useCaseHints[], vendorHints[] }

const fs = require("fs");
const path = require("path");

const POOL_PATH = path.join(__dirname, "..", "data", "source-pool.json");

async function fetchCandidates() {
  if (!fs.existsSync(POOL_PATH)) return [];
  const raw = fs.readFileSync(POOL_PATH, "utf-8");
  return JSON.parse(raw);
}

module.exports = { fetchCandidates };
