import { readFile, writeFile } from "node:fs/promises";

const sourcePath = new URL("../wrangler.jsonc", import.meta.url);
const sourceConfig = JSON.parse(await readFile(sourcePath, "utf8"));
const databaseId = sourceConfig.d1_databases?.find((database) => database.binding === "DB")?.database_id;
if (!databaseId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(databaseId)) {
  throw new Error("The DB binding in wrangler.jsonc must contain a D1 database UUID.");
}

const path = new URL("../dist/server/wrangler.json", import.meta.url);
const config = JSON.parse(await readFile(path, "utf8"));
for (const database of config.d1_databases ?? []) {
  if (database.binding === "DB") {
    database.database_id = databaseId;
    delete database.migrations_dir;
  }
}
await writeFile(path, `${JSON.stringify(config, null, 2)}\n`);
