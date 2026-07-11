// sql.js（WASM版SQLite）のラッパー。
// ネイティブビルド不要でWindows環境でもそのまま動く。
// メモリ上のDBを操作し、書き込みのたびにファイルへ永続化する。

const fs = require("fs");
const path = require("path");
const initSqlJs = require("sql.js");

const DB_PATH = path.join(__dirname, "physical-ai.sqlite");
const SCHEMA_PATH = path.join(__dirname, "schema.sql");
const WASM_PATH = path.join(__dirname, "..", "node_modules", "sql.js", "dist", "sql-wasm.wasm");

let SQL = null;
let db = null;

async function getDb() {
  if (db) return wrap(db);

  SQL = await initSqlJs({ locateFile: () => WASM_PATH });

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  const schema = fs.readFileSync(SCHEMA_PATH, "utf-8");
  db.exec(schema);
  persist();

  return wrap(db);
}

function persist() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// sql.jsの生API（exec/prepare）を、扱いやすい run/all/get 形式に包む薄いラッパー。
// 注意: db.export()（persist内で呼ぶ）はlast_insert_rowid()の状態をリセットしてしまうため、
// INSERT直後・persist前にlast_insert_rowid()を取得して保持しておく。
function wrap(rawDb) {
  let lastInsertIdValue = null;

  return {
    raw: rawDb,

    run(sql, params = []) {
      rawDb.run(sql, params);
      const trimmed = sql.trim().toUpperCase();
      if (trimmed.startsWith("INSERT")) {
        const res = rawDb.exec("SELECT last_insert_rowid() AS id");
        lastInsertIdValue = res.length ? res[0].values[0][0] : null;
      }
      persist();
    },

    all(sql, params = []) {
      const stmt = rawDb.prepare(sql);
      stmt.bind(params);
      const rows = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      stmt.free();
      return rows;
    },

    get(sql, params = []) {
      const rows = this.all(sql, params);
      return rows[0] || null;
    },

    lastInsertId() {
      return lastInsertIdValue;
    },

    persist,
  };
}

module.exports = { getDb };
