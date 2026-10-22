import Database from "better-sqlite3";
const db = new Database("vigia_control.db");
const lastShift = db.prepare("SELECT * FROM shifts ORDER BY id DESC LIMIT 1").get();
console.log("Last Shift:", JSON.stringify(lastShift, null, 2));
const lastLogs = db.prepare("SELECT * FROM logs ORDER BY id DESC LIMIT 5").all();
console.log("Last Logs:", JSON.stringify(lastLogs, null, 2));
