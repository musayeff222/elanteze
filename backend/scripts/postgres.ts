import fs from "fs";
import path from "path";
import EmbeddedPostgres from "embedded-postgres";

const dataDir = path.resolve(__dirname, "..", ".pgdata");
const port = Number(process.env.PG_PORT || 5432);

async function main() {
  fs.mkdirSync(dataDir, { recursive: true });
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "alver",
    password: "alver",
    port,
    persistent: true,
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
  });

  if (!fs.existsSync(path.join(dataDir, "PG_VERSION"))) {
    await pg.initialise();
  }
  await pg.start();
  try {
    await pg.createDatabase("alver");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/already exists/i.test(message)) throw error;
  }
  console.log(`PostgreSQL işləyir: postgresql://alver:alver@localhost:${port}/alver`);
  console.log("Dayandırmaq üçün bu pəncərəni bağlayın.");
  await new Promise(() => undefined);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
