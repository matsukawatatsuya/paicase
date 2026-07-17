// キーワードマッチングによる自動タグ付け。
// タイトル・要約・企業名などのテキストを業種/ユースケースのキーワード辞書と照合する。

const { INDUSTRIES, USE_CASES, VENDORS, COUNTRIES, ROBOT_TYPES } = require("./taxonomy");

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
  // ベンダー名・国名は導入企業名等と衝突しやすいため、本文全体ではなく
  // 収集時に確認したvendorHints/countryHintsのみと照合する（精度優先）。
  const vendors = matchAgainst((candidate.vendorHints || []).join(" \n "), VENDORS);
  const countries = matchAgainst((candidate.countryHints || []).join(" \n "), COUNTRIES);

  // ロボットタイプはタイトル・要約から自動検出
  const robotTypes = matchAgainst(baseText, ROBOT_TYPES);

  return { industries, useCases, vendors, countries, robotTypes };
}

module.exports = { tagCandidate, matchAgainst, normalize };
