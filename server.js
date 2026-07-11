const express = require("express");
const path = require("path");
const { getDb } = require("./db/init");
const { seedMaster } = require("./db/seed");
const { runUpdate } = require("./services/updatePipeline");

const PORT = process.env.PORT || 3000;

async function main() {
  await seedMaster();
  const db = await getDb();

  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, "docs")));

  // 業種・ユースケース・ベンダーのマスタ一覧
  app.get("/api/meta", (req, res) => {
    const industries = db.all("SELECT name FROM industries ORDER BY sort_order").map((r) => r.name);
    const useCases = db.all("SELECT name FROM use_cases ORDER BY sort_order").map((r) => r.name);
    const totalCases = db.get("SELECT COUNT(*) AS cnt FROM cases").cnt;
    res.json({ industries, useCases, totalCases });
  });

  // ロボットベンダー一覧（事例が1件以上ひも付くものだけ、件数付き）
  // 並び順: アルファベット始まりを英字順、それ以外（日本語など）を五十音順で後ろに続ける
  app.get("/api/vendors", (req, res) => {
    const vendors = db.all(`
      SELECT v.name AS name, COUNT(DISTINCT cv.case_id) AS cnt
      FROM case_vendors cv JOIN vendors v ON v.id = cv.vendor_id
      GROUP BY v.name
    `);
    res.json(sortVendorNames(vendors));
  });

  // 国一覧（事例が1件以上ひも付くものだけ、件数付き）
  app.get("/api/countries", (req, res) => {
    const countries = db.all(`
      SELECT c.name AS name, COUNT(DISTINCT cc.case_id) AS cnt
      FROM case_countries cc JOIN countries c ON c.id = cc.country_id
      GROUP BY c.name
    `);
    res.json(sortVendorNames(countries));
  });

  // 業種×ユースケースのクロス集計
  app.get("/api/matrix", (req, res) => {
    const cellRows = db.all(`
      SELECT i.name AS industry, u.name AS usecase, COUNT(DISTINCT ci.case_id) AS cnt
      FROM case_industries ci
      JOIN case_usecases cu ON cu.case_id = ci.case_id
      JOIN industries i ON i.id = ci.industry_id
      JOIN use_cases u ON u.id = cu.usecase_id
      GROUP BY i.name, u.name
    `);
    const industryTotals = db.all(`
      SELECT i.name AS industry, COUNT(DISTINCT ci.case_id) AS cnt
      FROM case_industries ci JOIN industries i ON i.id = ci.industry_id
      GROUP BY i.name
    `);
    const usecaseTotals = db.all(`
      SELECT u.name AS usecase, COUNT(DISTINCT cu.case_id) AS cnt
      FROM case_usecases cu JOIN use_cases u ON u.id = cu.usecase_id
      GROUP BY u.name
    `);

    const cells = {};
    cellRows.forEach((r) => {
      if (!cells[r.industry]) cells[r.industry] = {};
      cells[r.industry][r.usecase] = r.cnt;
    });
    const industryTotalMap = {};
    industryTotals.forEach((r) => (industryTotalMap[r.industry] = r.cnt));
    const usecaseTotalMap = {};
    usecaseTotals.forEach((r) => (usecaseTotalMap[r.usecase] = r.cnt));

    res.json({ cells, industryTotals: industryTotalMap, usecaseTotals: usecaseTotalMap });
  });

  // 事例一覧（業種／ユースケース／ロボットベンダー／国で絞り込み可能）
  app.get("/api/cases", (req, res) => {
    const { industry, usecase, vendor, country } = req.query;

    let sql = `SELECT DISTINCT c.id, c.title, c.url, c.published_date, c.source_name,
                      c.official_score, c.company, c.image_url
               FROM cases c`;
    const conditions = [];
    const params = [];

    if (industry) {
      sql += ` JOIN case_industries ci ON ci.case_id = c.id JOIN industries i ON i.id = ci.industry_id`;
      conditions.push("i.name = ?");
      params.push(industry);
    }
    if (usecase) {
      sql += ` JOIN case_usecases cu ON cu.case_id = c.id JOIN use_cases u ON u.id = cu.usecase_id`;
      conditions.push("u.name = ?");
      params.push(usecase);
    }
    if (vendor) {
      sql += ` JOIN case_vendors cv ON cv.case_id = c.id JOIN vendors v ON v.id = cv.vendor_id`;
      conditions.push("v.name = ?");
      params.push(vendor);
    }
    if (country) {
      sql += ` JOIN case_countries cc ON cc.case_id = c.id JOIN countries co ON co.id = cc.country_id`;
      conditions.push("co.name = ?");
      params.push(country);
    }
    if (conditions.length) sql += " WHERE " + conditions.join(" AND ");
    sql += " ORDER BY c.published_date DESC, c.id DESC";

    const cases = db.all(sql, params);
    const withTags = cases.map((c) => attachTagNames(db, c));
    res.json(withTags);
  });

  // 事例詳細（サマリー含む）
  app.get("/api/cases/:id", (req, res) => {
    const c = db.get("SELECT * FROM cases WHERE id = ?", [req.params.id]);
    if (!c) return res.status(404).json({ error: "not found" });
    res.json(attachTagNames(db, c));
  });

  // 情報更新: まだ取得していない事例を検索アダプタ経由で取得し、重複排除・タグ付けしてDBに反映
  app.post("/api/update", async (req, res) => {
    try {
      const result = await runUpdate(db);
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: String(err) });
    }
  });

  app.listen(PORT, () => {
    console.log(`Physical AI Tracker running at http://localhost:${PORT}`);
  });
}

// アルファベット始まりの名前を英字順（先頭）に、それ以外（日本語など）を五十音順でその後ろに並べる
function sortVendorNames(rows) {
  const isAlphabetic = (name) => /^[A-Za-z]/.test(name);
  const alphabetic = rows.filter((r) => isAlphabetic(r.name)).sort((a, b) => a.name.localeCompare(b.name, "en"));
  const other = rows.filter((r) => !isAlphabetic(r.name)).sort((a, b) => a.name.localeCompare(b.name, "ja"));
  return [...alphabetic, ...other];
}

function attachTagNames(db, c) {
  const industries = db
    .all(
      `SELECT i.name FROM case_industries ci JOIN industries i ON i.id = ci.industry_id WHERE ci.case_id = ?`,
      [c.id]
    )
    .map((r) => r.name);
  const useCases = db
    .all(
      `SELECT u.name FROM case_usecases cu JOIN use_cases u ON u.id = cu.usecase_id WHERE cu.case_id = ?`,
      [c.id]
    )
    .map((r) => r.name);
  const vendors = db
    .all(
      `SELECT v.name FROM case_vendors cv JOIN vendors v ON v.id = cv.vendor_id WHERE cv.case_id = ?`,
      [c.id]
    )
    .map((r) => r.name);
  const countries = db
    .all(
      `SELECT co.name FROM case_countries cc JOIN countries co ON co.id = cc.country_id WHERE cc.case_id = ?`,
      [c.id]
    )
    .map((r) => r.name);
  return { ...c, industries, useCases, vendors, countries };
}

main().catch((err) => {
  console.error("起動に失敗しました:", err);
  process.exit(1);
});
