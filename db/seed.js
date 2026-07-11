// マスタデータ（業種・ユースケース）を投入する。既存があればスキップ。
const { getDb } = require("./init");
const { INDUSTRIES, USE_CASES, VENDORS, COUNTRIES } = require("../services/taxonomy");

async function seedMaster() {
  const db = await getDb();

  INDUSTRIES.forEach((ind, i) => {
    const existing = db.get("SELECT id FROM industries WHERE name = ?", [ind.name]);
    if (!existing) {
      db.run("INSERT INTO industries (name, sort_order) VALUES (?, ?)", [ind.name, i]);
    }
  });

  USE_CASES.forEach((uc, i) => {
    const existing = db.get("SELECT id FROM use_cases WHERE name = ?", [uc.name]);
    if (!existing) {
      db.run("INSERT INTO use_cases (name, sort_order) VALUES (?, ?)", [uc.name, i]);
    }
  });

  VENDORS.forEach((v, i) => {
    const existing = db.get("SELECT id FROM vendors WHERE name = ?", [v.name]);
    if (!existing) {
      db.run("INSERT INTO vendors (name, sort_order) VALUES (?, ?)", [v.name, i]);
    }
  });

  COUNTRIES.forEach((c, i) => {
    const existing = db.get("SELECT id FROM countries WHERE name = ?", [c.name]);
    if (!existing) {
      db.run("INSERT INTO countries (name, sort_order) VALUES (?, ?)", [c.name, i]);
    }
  });

  console.log("マスタデータ投入完了");
  return db;
}

if (require.main === module) {
  seedMaster().then(() => process.exit(0));
}

module.exports = { seedMaster };
