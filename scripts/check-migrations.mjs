// Does the database actually have what the migrations declare?
//
//   npm run db:check
//
// `src/db/check_migrations.sql` answers the same question and is still the
// authority — but it has to be pasted into the Supabase SQL editor by hand, and
// it checks **one sentinel per migration**: a table name, a column name. That
// leaves two blind spots this script exists to cover.
//
//   1. **A partly-applied migration.** A file pasted into the SQL editor that
//      errors halfway leaves the table created and some of its columns missing.
//      The sentinel is usually the first column, so it reports OK.
//   2. **A migration with no row in the SQL file at all.** That has happened
//      twice — 0021–0023, then 0024–0025 — and a migration the checker does not
//      know about is one it cannot report on. This script reads the .sql files
//      themselves, so a new migration is covered the moment it is written.
//
// Read-only, and free: it uses the anon key, which is public by design
// (NEXT_PUBLIC_), and never writes. The two functions it calls that are not
// plain reads return before touching anything when auth.uid() is null.
//
// **Why `200 []` is the right answer and not a suspicious blank:** RLS gives an
// anonymous reader no rows, but it only gets that far once the table and every
// named column resolve. A table that is not there answers 404/PGRST205 and a
// column that is not there answers 400/42703 — so the run ends by asking for
// one of each on purpose. If those two controls ever come back 200, the whole
// report is meaningless and the script says so and fails.

import fs from "node:fs";
import path from "node:path";

const ENV_FILE = ".env.local";
const MIGRATIONS = "src/db/migrations";

if (!fs.existsSync(ENV_FILE)) {
  console.error(`${ENV_FILE} not found — run this from the repo root.`);
  process.exit(1);
}

const env = Object.fromEntries(
  fs
    .readFileSync(ENV_FILE, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.startsWith("#"))
    .map((line) => {
      const at = line.indexOf("=");
      return [line.slice(0, at).trim(), line.slice(at + 1).trim()];
    }),
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.error(`No Supabase URL or anon key in ${ENV_FILE}.`);
  process.exit(1);
}

const headers = { apikey: key, Authorization: `Bearer ${key}` };
const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

async function select(table, columns) {
  const res = await fetch(
    `${url}/rest/v1/${table}?select=${columns.join(",")}&limit=1`,
    { headers },
  );
  const body = await res.text();
  let code = null;
  try {
    code = JSON.parse(body).code ?? null;
  } catch {
    // A non-JSON body is not a shape this needs to understand.
  }
  return { status: res.status, code, body: body.slice(0, 200) };
}

async function callFunction(name, args) {
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const body = await res.text();
  let code = null;
  try {
    code = JSON.parse(body).code ?? null;
  } catch {
    // As above.
  }
  return { status: res.status, code, body: body.slice(0, 120) };
}

// ---- what the migrations declare ------------------------------------------

// A line inside a create-table body that opens with one of these is a table
// constraint, not a column.
const NOT_A_COLUMN = /^(primary|unique|constraint|check|foreign|exclude|like)$/;

function declaredColumns() {
  const declared = new Map(); // table -> Map(column -> migration)

  const remember = (table, column, migration) => {
    if (!declared.has(table)) declared.set(table, new Map());
    // First declaration wins: that is the migration that introduced it.
    if (!declared.get(table).has(column)) {
      declared.get(table).set(column, migration);
    }
  };

  for (const file of fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
    const migration = file.replace(/\.sql$/, "");
    // Comments are stripped first, so a column name mentioned in prose — and
    // these files are mostly prose — cannot be read as a declaration.
    const sql = fs
      .readFileSync(path.join(MIGRATIONS, file), "utf8")
      .replace(/--[^\n]*/g, "");

    for (const match of sql.matchAll(
      /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z_0-9]+)\s*\(([\s\S]*?)\n\s*\)\s*;/gi,
    )) {
      const table = match[1];

      // Split the body on top-level commas only: `numeric(12, 2)` and
      // `check (x between 1 and 60)` both contain commas that are not
      // separators.
      const lines = [];
      let depth = 0;
      let current = "";
      for (const ch of match[2]) {
        if (ch === "(") depth += 1;
        else if (ch === ")") depth -= 1;
        if (ch === "," && depth === 0) {
          lines.push(current);
          current = "";
        } else {
          current += ch;
        }
      }
      lines.push(current);

      for (const line of lines) {
        const name = line.trim().split(/\s+/)[0];
        if (!name || !/^[a-z_][a-z_0-9]*$/.test(name)) continue;
        if (NOT_A_COLUMN.test(name)) continue;
        remember(table, name, migration);
      }
    }

    for (const match of sql.matchAll(
      /alter\s+table\s+(?:if\s+exists\s+)?public\.([a-z_0-9]+)\s+add\s+column\s+(?:if\s+not\s+exists\s+)?([a-z_0-9]+)/gi,
    )) {
      remember(match[1], match[2], migration);
    }
  }

  return declared;
}

// ---- the run ---------------------------------------------------------------

const problems = [];
let columnCount = 0;

const declared = declaredColumns();

console.log("tables and columns");
for (const [table, columns] of [...declared].sort()) {
  const names = [...columns.keys()].sort();
  columnCount += names.length;
  const all = await select(table, names);

  if (all.status === 200) {
    console.log(`  OK    ${table.padEnd(24)} ${names.length} columns`);
    continue;
  }
  if (all.code === "PGRST205") {
    console.log(`  FAIL  ${table.padEnd(24)} table does not exist`);
    problems.push(
      `${table} is missing entirely — run ${[...columns.values()][0]}`,
    );
    continue;
  }

  // Something in the list did not resolve. Ask column by column so the report
  // names every one of them, not just the first the parser tripped on.
  const missing = [];
  for (const column of names) {
    const one = await select(table, [column]);
    if (one.status !== 200) missing.push(column);
  }
  console.log(
    `  FAIL  ${table.padEnd(24)} ${missing.length}/${names.length} missing: ${missing.join(", ")}`,
  );
  for (const column of missing) {
    problems.push(
      `${table}.${column} is missing — declared in ${columns.get(column)}`,
    );
  }
}

// The functions the RLS policies are written in terms of. A policy that calls a
// function that is not there does not fail loudly — it denies, and every screen
// behind it goes quietly empty.
//
// `expect` is the grant each one is given in 0018/0019, read back as anon:
// "callable" means anon may EXECUTE it, "denied" means the function is there
// and anon may not — which is the correct answer for the two that write. Either
// way it exists; only PGRST202 means it does not.
const FUNCTIONS = [
  ["is_trip_owner", { p_trip_id: ZERO_UUID }, "callable"],
  ["can_view_trip", { p_trip_id: ZERO_UUID }, "callable"],
  ["can_edit_trip", { p_trip_id: ZERO_UUID }, "callable"],
  ["peek_trip_invite", { p_token: "0".repeat(32) }, "callable"],
  ["list_trip_members", { p_trip_id: ZERO_UUID }, "denied"],
  // Returns null immediately when auth.uid() is null, so calling it as anon
  // cannot accept anything — and it is denied to anon anyway.
  ["accept_trip_invite", { p_token: "not-a-token" }, "denied"],
];

console.log("\nfunctions");
for (const [name, args, expect] of FUNCTIONS) {
  const res = await callFunction(name, args);
  const got =
    res.status === 200 ? "callable" : res.code === "42501" ? "denied" : "absent";

  if (got === "absent") {
    console.log(`  FAIL  ${name.padEnd(24)} not found (${res.code})`);
    problems.push(`function ${name} is missing — run 0018_trip_members.sql`);
  } else if (got !== expect) {
    console.log(`  FAIL  ${name.padEnd(24)} exists but is ${got}, expected ${expect}`);
    problems.push(
      `function ${name} is ${got} to anon, expected ${expect} — check the grants in 0018/0019`,
    );
  } else {
    console.log(`  OK    ${name.padEnd(24)} ${got}`);
  }
}

// ---- the controls ----------------------------------------------------------
//
// Without these the run above is a wall of 200s that proves nothing.

const missingTable = await select("table_that_cannot_exist", ["id"]);
const missingColumn = await select("trips", ["column_that_cannot_exist"]);
const missingFunction = await callFunction("function_that_cannot_exist", {});

console.log("\ncontrols (these must fail)");
const controls = [
  ["missing table", missingTable, "PGRST205"],
  ["missing column", missingColumn, "42703"],
  ["missing function", missingFunction, "PGRST202"],
];
for (const [label, res, expected] of controls) {
  const ok = res.status !== 200 && res.code === expected;
  console.log(
    `  ${ok ? "OK   " : "BROKEN"} ${label.padEnd(23)} ${res.status} ${res.code}`,
  );
  if (!ok) {
    problems.push(
      `control "${label}" did not fail as expected (${res.status} ${res.code}) — this run proves nothing`,
    );
  }
}

// ---- what this cannot see --------------------------------------------------

console.log(`
not checkable from outside the database:
  0005_reset_geocode           data only, no schema footprint
  0016_fix_booking_timezones   its applied_migrations row is hidden by RLS on
                               purpose (see the migration) — the SQL editor is
                               the only place that can read it
  handle_new_user()            trigger functions, not reachable over PostgREST
  trips_guard_owner()
  RLS policy bodies            a policy can exist and still be wrong`);

console.log(
  `\n${declared.size} tables, ${columnCount} columns, ${FUNCTIONS.length} functions checked`,
);

if (problems.length > 0) {
  console.log("\nproblems:");
  for (const problem of problems) console.log(`  - ${problem}`);
  process.exit(1);
}
console.log("no problems");
