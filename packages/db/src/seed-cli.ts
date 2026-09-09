import { buildDemoStore, metricsFromStore } from "./seed.js";
import { createDb, hasDatabaseUrl } from "./client.js";
import { runMigrations } from "./migrate.js";
import { seedPostgresFromDemo } from "./repository.js";

async function main() {
  const days = Number(process.env.SEED_DAYS ?? 90);
  const store = await buildDemoStore({ days });

  if (hasDatabaseUrl()) {
    console.log("Seeding Postgres…");
    await runMigrations();
    const db = createDb();
    await seedPostgresFromDemo(db, store);
    console.log(
      JSON.stringify(
        {
          backend: "postgres",
          project: store.project,
          chats: store.chats.length,
          brands: metricsFromStore(store).sort(
            (a, b) => b.visibility - a.visibility,
          ),
        },
        null,
        2,
      ),
    );
    process.exit(0);
  }

  console.log(
    JSON.stringify(
      {
        backend: "memory",
        project: store.project.name,
        chats: store.chats.length,
        mentions: store.mentions.length,
        sources: store.sources.length,
        brands: metricsFromStore(store).sort(
          (a, b) => b.visibility - a.visibility,
        ),
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
