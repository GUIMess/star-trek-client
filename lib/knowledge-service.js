const { query } = require("./db");

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeRef(value) {
  const trimmed = String(value || "").trim();
  return {
    raw: trimmed,
    slug: slugify(trimmed),
  };
}

function average(numbers) {
  if (!numbers.length) return null;
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

function sourceConfidenceLabel(value) {
  if (value >= 0.95) return "high";
  if (value >= 0.75) return "medium";
  return "low";
}

function indexFactsByLabel(facts) {
  return facts.reduce((map, fact) => {
    map.set(fact.label.toLowerCase(), fact);
    return map;
  }, new Map());
}

async function resolveEntity(ref) {
  const { raw, slug } = normalizeRef(ref);

  const result = await query(
    `
      SELECT DISTINCT e.id,
        e.slug,
        e.display_name,
        e.entity_type,
        e.summary,
        e.canon_tier,
        e.threat_level,
        e.diplomatic_posture,
        e.era,
        e.profile,
        e.tags
      FROM entities e
      LEFT JOIN entity_aliases a ON a.entity_id = e.id
      WHERE e.slug = $1
         OR LOWER(e.display_name) = LOWER($2)
         OR LOWER(a.alias) = LOWER($2)
      LIMIT 1
    `,
    [slug, raw]
  );

  return result.rows[0] || null;
}

async function searchEntities(searchTerm, limit = 8) {
  const value = String(searchTerm || "").trim();
  if (!value) return [];

  const like = `%${value.toLowerCase()}%`;
  const result = await query(
    `
      SELECT DISTINCT e.slug,
        e.display_name,
        e.entity_type,
        e.summary,
        e.canon_tier,
        COALESCE(MAX(CASE WHEN LOWER(e.display_name) = LOWER($1) THEN 3 ELSE 0 END), 0) +
        COALESCE(MAX(CASE WHEN e.slug = $2 THEN 2 ELSE 0 END), 0) +
        COALESCE(MAX(CASE WHEN LOWER(a.alias) = LOWER($1) THEN 2 ELSE 0 END), 0) AS exact_score
      FROM entities e
      LEFT JOIN entity_aliases a ON a.entity_id = e.id
      WHERE LOWER(e.display_name) LIKE $3
         OR e.slug LIKE $4
         OR LOWER(COALESCE(a.alias, '')) LIKE $3
      GROUP BY e.id
      ORDER BY exact_score DESC, e.display_name ASC
      LIMIT $5
    `,
    [value, slugify(value), like, `%${slugify(value)}%`, limit]
  );

  return result.rows;
}

async function getFacts(entityId) {
  const result = await query(
    `
      SELECT f.section,
        f.label,
        f.value_text,
        f.importance,
        f.confidence,
        s.label AS source_label,
        s.url AS source_url,
        s.source_type
      FROM facts f
      LEFT JOIN sources s ON s.id = f.source_id
      WHERE f.entity_id = $1
      ORDER BY f.importance DESC, f.section ASC, f.label ASC
    `,
    [entityId]
  );

  return result.rows.map((row) => ({
    section: row.section,
    label: row.label,
    value: row.value_text,
    importance: Number(row.importance) || 0,
    confidence: Number(row.confidence) || 0,
    source: row.source_label,
    sourceUrl: row.source_url,
    sourceType: row.source_type,
  }));
}

async function getRelationships(entityId) {
  const result = await query(
    `
      SELECT r.relation_type,
        r.description,
        r.confidence,
        target.slug AS target_slug,
        target.display_name AS target_name,
        target.entity_type AS target_type,
        s.label AS source_label,
        s.url AS source_url
      FROM relationships r
      JOIN entities target ON target.id = r.target_entity_id
      LEFT JOIN sources s ON s.id = r.source_id
      WHERE r.source_entity_id = $1
      ORDER BY r.importance DESC, target.display_name ASC
    `,
    [entityId]
  );

  return result.rows.map((row) => ({
    type: row.relation_type,
    description: row.description,
    confidence: Number(row.confidence) || 0,
    target: {
      slug: row.target_slug,
      name: row.target_name,
      type: row.target_type,
    },
    source: row.source_label,
    sourceUrl: row.source_url,
  }));
}

async function getTimeline(entityId) {
  const result = await query(
    `
      SELECT era_label,
        sort_key,
        headline,
        detail,
        s.label AS source_label,
        s.url AS source_url
      FROM timeline_events t
      LEFT JOIN sources s ON s.id = t.source_id
      WHERE t.entity_id = $1
      ORDER BY t.sort_key ASC, t.era_label ASC
    `,
    [entityId]
  );

  return result.rows.map((row) => ({
    eraLabel: row.era_label,
    headline: row.headline,
    detail: row.detail,
    source: row.source_label,
    sourceUrl: row.source_url,
  }));
}

function pickFact(factsByLabel, label) {
  return factsByLabel.get(label.toLowerCase())?.value || null;
}

function buildOperationalNotes(entity, facts, relationships, mode) {
  const factsByLabel = indexFactsByLabel(facts);
  const notes = [];
  const homeworld = pickFact(factsByLabel, "Homeworld");
  const posture = entity.diplomatic_posture || pickFact(factsByLabel, "Diplomatic posture");
  const caution = pickFact(factsByLabel, "Operational caution");
  const culture = pickFact(factsByLabel, "Cultural profile");
  const threat = entity.threat_level || pickFact(factsByLabel, "Threat profile");
  const notableContact = relationships[0]?.target?.name || null;

  if (mode === "first-contact") {
    if (culture) notes.push(`Cultural read: ${culture}`);
    if (posture) notes.push(`Diplomatic posture: ${posture}`);
    if (caution) notes.push(`Away-team caution: ${caution}`);
    if (homeworld) notes.push(`Primary point of origin: ${homeworld}`);
  } else if (mode === "threat") {
    if (threat) notes.push(`Threat profile: ${threat}`);
    if (caution) notes.push(`Observed risk pattern: ${caution}`);
    if (posture) notes.push(`Negotiation posture: ${posture}`);
  } else if (mode === "diplomacy") {
    if (posture) notes.push(`Diplomatic posture: ${posture}`);
    if (culture) notes.push(`Protocol baseline: ${culture}`);
    if (notableContact) notes.push(`Known reference link: ${notableContact}`);
  } else {
    if (homeworld) notes.push(`Origin: ${homeworld}`);
    if (culture) notes.push(`Cultural profile: ${culture}`);
    if (threat) notes.push(`Threat profile: ${threat}`);
  }

  return notes.slice(0, 4);
}

function buildBrief(entity, facts, relationships, timeline, mode = "scan") {
  const confidence = average(
    facts
      .map((fact) => Number(fact.confidence) || 0)
      .filter((value) => value > 0)
  );

  return {
    mode,
    heading:
      mode === "first-contact"
        ? "First Contact Brief"
        : mode === "threat"
          ? "Threat Assessment"
          : mode === "diplomacy"
            ? "Diplomatic Brief"
            : "Entity Scan",
    summary: entity.summary,
    operationalNotes: buildOperationalNotes(entity, facts, relationships, mode),
    confidence:
      confidence === null
        ? null
        : {
            score: Number(confidence.toFixed(2)),
            label: sourceConfidenceLabel(confidence),
          },
    relatedCount: relationships.length,
    timelineCount: timeline.length,
  };
}

async function getEntityPayload(ref, mode = "scan") {
  const entity = await resolveEntity(ref);
  if (!entity) return null;

  const [facts, relationships, timeline] = await Promise.all([
    getFacts(entity.id),
    getRelationships(entity.id),
    getTimeline(entity.id),
  ]);

  const sourcesMap = new Map();
  [...facts, ...relationships, ...timeline].forEach((item) => {
    if (!item.source) return;
    sourcesMap.set(item.source, {
      label: item.source,
      url: item.sourceUrl || null,
      sourceType: item.sourceType || null,
    });
  });

  return {
    entity: {
      slug: entity.slug,
      name: entity.display_name,
      type: entity.entity_type,
      summary: entity.summary,
      canonTier: entity.canon_tier,
      threatLevel: entity.threat_level,
      diplomaticPosture: entity.diplomatic_posture,
      era: entity.era,
      profile: entity.profile || {},
      tags: entity.tags || [],
    },
    brief: buildBrief(entity, facts, relationships, timeline, mode),
    facts,
    relationships,
    timeline,
    sources: Array.from(sourcesMap.values()),
  };
}

function compareFactSets(leftFacts, rightFacts) {
  const leftByLabel = indexFactsByLabel(leftFacts);
  const rightByLabel = indexFactsByLabel(rightFacts);
  const labels = Array.from(
    new Set([...leftByLabel.keys(), ...rightByLabel.keys()])
  );

  const rows = labels
    .map((labelKey) => {
      const left = leftByLabel.get(labelKey) || null;
      const right = rightByLabel.get(labelKey) || null;
      return {
        label: left?.label || right?.label || labelKey,
        left: left?.value || null,
        right: right?.value || null,
        same: Boolean(left?.value && right?.value && left.value === right.value),
        importance: Math.max(left?.importance || 0, right?.importance || 0),
      };
    })
    .sort((a, b) => b.importance - a.importance || a.label.localeCompare(b.label));

  return {
    shared: rows.filter((row) => row.same).slice(0, 6),
    different: rows.filter((row) => !row.same).slice(0, 8),
  };
}

async function compareEntities(leftRef, rightRef) {
  const [left, right] = await Promise.all([
    getEntityPayload(leftRef, "scan"),
    getEntityPayload(rightRef, "scan"),
  ]);

  if (!left || !right) {
    return null;
  }

  const comparison = compareFactSets(left.facts, right.facts);

  return {
    left: left.entity,
    right: right.entity,
    summary: `${left.entity.name} and ${right.entity.name} compared across canon facts, posture, and operational profile.`,
    shared: comparison.shared,
    different: comparison.different,
  };
}

module.exports = {
  compareEntities,
  getEntityPayload,
  searchEntities,
};
