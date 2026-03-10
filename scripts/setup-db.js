const fs = require("fs");
const path = require("path");
require("dotenv").config();

const { closePool, dbConfigured, withTransaction } = require("../lib/db");

const schemaPath = path.join(__dirname, "..", "db", "schema.sql");
const seedPath = path.join(__dirname, "..", "data", "seed.json");

async function run() {
  if (!dbConfigured()) {
    throw new Error("DATABASE_URL is required before running db setup");
  }

  const schemaSql = fs.readFileSync(schemaPath, "utf8");
  const seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));
  const seedOnly = process.argv.includes("--seed-only");

  await withTransaction(async (client) => {
    if (!seedOnly) {
      await client.query(schemaSql);
    }

    await client.query(`
      TRUNCATE TABLE
        timeline_events,
        relationships,
        facts,
        entity_aliases,
        entities,
        sources
      RESTART IDENTITY CASCADE
    `);

    const sourceIds = new Map();
    for (const source of seed.sources) {
      const result = await client.query(
        `
          INSERT INTO sources (source_key, label, source_type, url, canon_weight)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id
        `,
        [
          source.key,
          source.label,
          source.sourceType,
          source.url,
          source.canonWeight ?? 1,
        ]
      );
      sourceIds.set(source.key, result.rows[0].id);
    }

    const entityIds = new Map();
    for (const entity of seed.entities) {
      const result = await client.query(
        `
          INSERT INTO entities (
            slug,
            display_name,
            entity_type,
            summary,
            canon_tier,
            threat_level,
            diplomatic_posture,
            era,
            tags,
            profile
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::text[], $10::jsonb)
          RETURNING id
        `,
        [
          entity.slug,
          entity.displayName,
          entity.entityType,
          entity.summary,
          entity.canonTier ?? "screen",
          entity.threatLevel ?? null,
          entity.diplomaticPosture ?? null,
          entity.era ?? null,
          entity.tags ?? [],
          JSON.stringify(entity.profile ?? {}),
        ]
      );
      entityIds.set(entity.slug, result.rows[0].id);
    }

    for (const entity of seed.entities) {
      const entityId = entityIds.get(entity.slug);

      for (const alias of entity.aliases ?? []) {
        await client.query(
          `
            INSERT INTO entity_aliases (entity_id, alias)
            VALUES ($1, $2)
          `,
          [entityId, alias]
        );
      }

      for (const fact of entity.facts ?? []) {
        await client.query(
          `
            INSERT INTO facts (
              entity_id,
              source_id,
              section,
              label,
              value_text,
              importance,
              confidence
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `,
          [
            entityId,
            sourceIds.get(fact.sourceKey) ?? null,
            fact.section,
            fact.label,
            fact.value,
            fact.importance ?? 50,
            fact.confidence ?? 0.8,
          ]
        );
      }

      for (const relation of entity.relationships ?? []) {
        await client.query(
          `
            INSERT INTO relationships (
              source_entity_id,
              target_entity_id,
              source_id,
              relation_type,
              description,
              importance,
              confidence
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `,
          [
            entityId,
            entityIds.get(relation.targetSlug),
            sourceIds.get(relation.sourceKey) ?? null,
            relation.type,
            relation.description,
            relation.importance ?? 50,
            relation.confidence ?? 0.8,
          ]
        );
      }

      for (const event of entity.timeline ?? []) {
        await client.query(
          `
            INSERT INTO timeline_events (
              entity_id,
              source_id,
              era_label,
              sort_key,
              headline,
              detail
            )
            VALUES ($1, $2, $3, $4, $5, $6)
          `,
          [
            entityId,
            sourceIds.get(event.sourceKey) ?? null,
            event.eraLabel,
            event.sortKey,
            event.headline,
            event.detail,
          ]
        );
      }
    }
  });

  console.log(
    `[db:setup] Loaded ${seed.entities.length} entities and ${seed.sources.length} sources into Postgres.`
  );
}

run()
  .catch((error) => {
    console.error(`[db:setup] ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
