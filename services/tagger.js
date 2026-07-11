// キーワードマッチングによる自動タグ付け。
// タイトル・要約・企業名などのテキストを業種/ユースケースのキーワード辞書と照合する。

const { INDUSTRIES, USE_CASES, VENDORS } = require("./taxonomy");

function normalize(text) {
  return (text || "").toLowerCase();
}

function matchAgainst(text, dictionary) {
  const normalized = normalize(text);
  const matched = [];
  for (const entry of dictionary) {
    const hit = entry.keywords.some((kw) => normalized.includes(kw.toLowerCase()));
    if (hit) matched.push(entry.name);
  }
  return matched;
}

// candidate: { title, summary, company, industryHints: [], useCaseHints: [], vendorHints: [] }
// industryHints/useCaseHints/vendorHints はリサーチ時に収集した自由記述タグ（キーワード辞書の補助入力として使う）
function tagCandidate(candidate) {
  const baseText = [candidate.title, candidate.summary, candidate.company].join(" \n ");

  const industries = matchAgainst(
    [baseText, ...(candidate.industryHints || [])].join(" \n "),
    INDUSTRIES
  );
  const useCases = matchAgainst(
    [baseText, ...(candidate.useCaseHints || [])].join(" \n "),
    USE_CASES
  );
  // ベンダー名は導入企業名と衝突しやすい（例:「トヨタ」が顧客企業名にも登場する）ため、
  // 本文全体ではなく収集時に確認したvendorHintsのみと照合する（精度優先）。
  const vendors = matchAgainst((candidate.vendorHints || []).join(" \n "), VENDORS);

  return { industries, useCases, vendors };
}

module.exports = { tagCandidate, matchAgainst, normalize };
