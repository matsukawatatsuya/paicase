// 重複判定と情報源の「公式度」スコアリング。
// 同一事例が複数ソースに存在する場合、より公式情報に近いものだけを残すために使う。

const OFFICIAL_HINT_PATTERNS = ["press", "newsroom", "news.", "investor", "ir.", "prtimes.jp"];

// ドメインに企業名（英語表記の簡易版）が含まれていれば公式サイトとみなす簡易ヒューリスティック
const COMPANY_DOMAIN_HINTS = {
  bmw: ["bmwgroup.com"],
  トヨタ: ["toyota.co.jp", "global.toyota"],
  パナソニック: ["panasonic.com", "panasonic.jp"],
  accenture: ["accenture.com"],
  komatsu: ["komatsu.com", "komatsu.co.jp"],
  jal: ["jal.co.jp"],
  jr東日本: ["jreast.co.jp"],
  ソフトバンク: ["softbank.jp"],
  pudu: ["pudurobotics.com"],
  rwe: ["rwe.com"],
  gxo: ["gxo.com"],
  agility: ["agilityrobotics.com"],
  sanctuary: ["sanctuary.ai"],
  ponyai: ["pony.ai"],
  ussugar: ["ussugar.com"],
  ファミリーマート: ["family.co.jp"],
  国立がん研究センター: ["ncc.go.jp"],
};

// 大手ニュースメディア・業界専門メディアのドメイン（一次情報ではないが信頼度が比較的高い）
const KNOWN_MEDIA_DOMAINS = [
  "bloomberg.com", "reuters.com", "forbes.com", "techcrunch.com", "theverge.com",
  "nikkei.com", "itmedia.co.jp", "response.jp", "robotstart.info", "roboticsandautomationnews.com",
  "interestingengineering.com", "cnevpost.com", "koreaherald.com", "koreatimes.co.kr",
  "caixinglobal.com", "globaltimes.cn", "euronews.com", "electrek.co", "carscoops.com",
  "truckinginfo.com", "sedaily.com", "medicalxpress.com", "digitalhealth.net",
  "newatlas.com", "g-enews.com", "163.com", "mynavi.jp", "innovatopia.jp", "autonomyglobal.co",
  "briefs.co", "ifactoryapp.com", "humanoid.guide", "startupfortune.com", "athenatech.jp",
  "jetro.go.jp", "robohorizon.com",
];

function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function officialScore(url, company = "") {
  const host = hostnameOf(url);
  if (!host) return 1;

  let pathname = "";
  try {
    pathname = new URL(url).pathname.toLowerCase();
  } catch {
    /* noop */
  }
  if (OFFICIAL_HINT_PATTERNS.some((p) => host.includes(p) || pathname.includes(p))) return 3;

  const companyKey = Object.keys(COMPANY_DOMAIN_HINTS).find((key) =>
    (company || "").toLowerCase().includes(key.toLowerCase()) || key === company
  );
  if (companyKey && COMPANY_DOMAIN_HINTS[companyKey].some((d) => host.includes(d))) return 3;
  // 会社名の英字表記がそのままドメインに含まれるケース（例: komatsu.com）
  if (company) {
    const asciiCompany = company.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (asciiCompany.length >= 4 && host.replace(/[^a-z0-9]/g, "").includes(asciiCompany)) return 3;
  }

  if (KNOWN_MEDIA_DOMAINS.some((d) => host === d || host.endsWith("." + d))) return 2;

  return 1;
}

function normalizeForCompare(text) {
  return (text || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[「」『』【】\[\]()（）、。,.!！?？:：\-—・]/g, "");
}

function bigrams(text) {
  const s = normalizeForCompare(text);
  if (s.length < 2) return [s];
  const grams = [];
  for (let i = 0; i < s.length - 1; i++) grams.push(s.slice(i, i + 2));
  return grams;
}

function titleSimilarity(a, b) {
  const A = new Set(bigrams(a));
  const B = new Set(bigrams(b));
  if (A.size === 0 || B.size === 0) return 0;
  let intersection = 0;
  for (const g of A) if (B.has(g)) intersection++;
  return intersection / (A.size + B.size - intersection);
}

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    return (u.hostname.replace(/^www\./, "") + u.pathname).replace(/\/$/, "").toLowerCase();
  } catch {
    return (url || "").toLowerCase();
  }
}

const TITLE_SIMILARITY_THRESHOLD = 0.55;

// existingCases: [{ id, title, url, company, official_score }]
// 戻り値: 最も近い重複候補（なければ null）
function findDuplicate(candidate, existingCases) {
  const candidateUrl = normalizeUrl(candidate.url);
  let best = null;
  let bestSim = 0;

  for (const existing of existingCases) {
    if (normalizeUrl(existing.url) === candidateUrl) {
      return { existing, reason: "same-url", similarity: 1 };
    }
    const sim = titleSimilarity(candidate.title, existing.title);
    if (sim > bestSim) {
      bestSim = sim;
      best = existing;
    }
  }

  if (best && bestSim >= TITLE_SIMILARITY_THRESHOLD) {
    return { existing: best, reason: "similar-title", similarity: bestSim };
  }
  return null;
}

module.exports = { officialScore, titleSimilarity, findDuplicate, normalizeUrl, normalizeForCompare };
