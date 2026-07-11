// 「情報更新」ボタンの処理本体。
// 検索アダプタから候補を取得 → 対象期間でフィルタ → 重複排除（公式度優先） → 自動タグ付け → DB反映

const { fetchCandidates } = require("./searchAdapter");
const { officialScore, findDuplicate, normalizeForCompare } = require("./dedupe");
const { tagCandidate } = require("./tagger");

const CUTOFF_DATE = "2026-01-01";

function loadExisting(db) {
  return db.all("SELECT id, title, url, company, official_score FROM cases");
}

const TAG_TABLES = {
  industries: { masterTable: "industries", junctionTable: "case_industries", refCol: "industry_id" },
  useCases: { masterTable: "use_cases", junctionTable: "case_usecases", refCol: "usecase_id" },
  vendors: { masterTable: "vendors", junctionTable: "case_vendors", refCol: "vendor_id" },
  countries: { masterTable: "countries", junctionTable: "case_countries", refCol: "country_id" },
};

function attachTags(db, caseId, tagNames, tagType) {
  const { masterTable, junctionTable, refCol } = TAG_TABLES[tagType];
  const master = db.all(`SELECT id, name FROM ${masterTable}`);

  for (const name of tagNames) {
    const row = master.find((m) => m.name === name);
    if (!row) continue;
    db.run(`INSERT OR IGNORE INTO ${junctionTable} (case_id, ${refCol}) VALUES (?, ?)`, [caseId, row.id]);
  }
}

function attachAllTags(db, caseId, tags) {
  attachTags(db, caseId, tags.industries, "industries");
  attachTags(db, caseId, tags.useCases, "useCases");
  attachTags(db, caseId, tags.vendors, "vendors");
  attachTags(db, caseId, tags.countries, "countries");
}

function insertCase(db, candidate) {
  const score = officialScore(candidate.url, candidate.company);
  const dedupeKey = normalizeForCompare(candidate.title);

  db.run(
    `INSERT INTO cases (title, url, published_date, source_name, official_score, company, summary, image_url, dedupe_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      candidate.title,
      candidate.url,
      candidate.publishedDate || null,
      candidate.sourceName || null,
      score,
      candidate.company || null,
      candidate.summary || null,
      candidate.imageUrl || null,
      dedupeKey,
    ]
  );
  const caseId = db.lastInsertId();

  attachAllTags(db, caseId, tagCandidate(candidate));

  return caseId;
}

function replaceCase(db, existingId, candidate) {
  const score = officialScore(candidate.url, candidate.company);
  const dedupeKey = normalizeForCompare(candidate.title);

  db.run(
    `UPDATE cases SET title=?, url=?, published_date=?, source_name=?, official_score=?, company=?, summary=?, image_url=?, dedupe_key=?
     WHERE id=?`,
    [
      candidate.title,
      candidate.url,
      candidate.publishedDate || null,
      candidate.sourceName || null,
      score,
      candidate.company || null,
      candidate.summary || null,
      candidate.imageUrl || null,
      dedupeKey,
      existingId,
    ]
  );

  db.run("DELETE FROM case_industries WHERE case_id = ?", [existingId]);
  db.run("DELETE FROM case_usecases WHERE case_id = ?", [existingId]);
  db.run("DELETE FROM case_vendors WHERE case_id = ?", [existingId]);
  db.run("DELETE FROM case_countries WHERE case_id = ?", [existingId]);
  attachAllTags(db, existingId, tagCandidate(candidate));
}

async function runUpdate(db) {
  const candidates = await fetchCandidates();
  const inWindow = candidates.filter((c) => !c.publishedDate || c.publishedDate >= CUTOFF_DATE);

  const existing = loadExisting(db);
  const addedTitles = [];
  const updatedTitles = [];
  const skippedTitles = [];

  for (const candidate of inWindow) {
    const dup = findDuplicate(candidate, existing);

    if (!dup) {
      insertCase(db, candidate);
      addedTitles.push(candidate.title);
      existing.push({
        id: -1,
        title: candidate.title,
        url: candidate.url,
        company: candidate.company,
        official_score: officialScore(candidate.url, candidate.company),
      });
      continue;
    }

    const candidateScore = officialScore(candidate.url, candidate.company);
    if (candidateScore > dup.existing.official_score) {
      replaceCase(db, dup.existing.id, candidate);
      updatedTitles.push(candidate.title);
    } else {
      skippedTitles.push(candidate.title);
    }
  }

  return {
    totalCandidates: candidates.length,
    inWindowCount: inWindow.length,
    addedCount: addedTitles.length,
    updatedCount: updatedTitles.length,
    skippedCount: skippedTitles.length,
    addedTitles,
    updatedTitles,
  };
}

module.exports = { runUpdate };
