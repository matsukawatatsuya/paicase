// DBの全データをdocs/data.jsonへ書き出す。GitHub Pages等の静的ホスティング用。
// 「情報更新」パイプラインでDBを更新した後、このスクリプトを実行してから再デプロイする。
const fs = require("fs");
const path = require("path");
const { getDb } = require("./init");

const OUT_PATH = path.join(__dirname, "..", "docs", "data.json");

async function exportData() {
  const db = await getDb();

  const industries = db.all("SELECT name FROM industries ORDER BY sort_order").map((r) => r.name);
  const useCases = db.all("SELECT name FROM use_cases ORDER BY sort_order").map((r) => r.name);
  const robotTypes = db.all("SELECT name FROM robot_types ORDER BY sort_order").map((r) => r.name);
  const phases = db.all("SELECT name FROM phases ORDER BY sort_order").map((r) => r.name);

  const cases = db.all(`
    SELECT id, title, url, published_date, source_name, official_score, company, summary, image_url
    FROM cases
    ORDER BY published_date DESC, id DESC
  `);

  const withTags = cases.map((c) => {
    const caseIndustries = db
      .all(`SELECT i.name FROM case_industries ci JOIN industries i ON i.id = ci.industry_id WHERE ci.case_id = ?`, [c.id])
      .map((r) => r.name);
    const caseUseCases = db
      .all(`SELECT u.name FROM case_usecases cu JOIN use_cases u ON u.id = cu.usecase_id WHERE cu.case_id = ?`, [c.id])
      .map((r) => r.name);
    const caseVendors = db
      .all(`SELECT v.name FROM case_vendors cv JOIN vendors v ON v.id = cv.vendor_id WHERE cv.case_id = ?`, [c.id])
      .map((r) => r.name);
    const caseCountries = db
      .all(`SELECT co.name FROM case_countries cc JOIN countries co ON co.id = cc.country_id WHERE cc.case_id = ?`, [c.id])
      .map((r) => r.name);
    const caseRobotTypes = db
      .all(`SELECT rt.name FROM case_robot_types crt JOIN robot_types rt ON rt.id = crt.robot_type_id WHERE crt.case_id = ?`, [c.id])
      .map((r) => r.name);
    const casePhases = db
      .all(`SELECT p.name FROM case_phases cp JOIN phases p ON p.id = cp.phase_id WHERE cp.case_id = ?`, [c.id])
      .map((r) => r.name);
    return { ...c, industries: caseIndustries, useCases: caseUseCases, vendors: caseVendors, countries: caseCountries, robotTypes: caseRobotTypes, phases: casePhases };
  });

  const data = {
    generatedAt: new Date().toISOString(),
    industries,
    useCases,
    robotTypes,
    phases,
    cases: withTags,
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(data));
  console.log(`書き出し完了: ${OUT_PATH}（事例${withTags.length}件）`);
}

exportData().then(() => process.exit(0));
