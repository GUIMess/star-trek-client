import MiniSearch from "minisearch";
import enrichment from "../data/archive-enrichment.json";
import seed from "../data/seed.json";

export type ArchiveMode = "field-guide" | "first-contact" | "diplomatic" | "threat";

export type GuideSource = {
  key: string;
  label: string;
  sourceType: string;
  url: string | null;
  canonWeight: number;
};

export type GuideFact = {
  section: string;
  label: string;
  value: string;
  importance: number;
  confidence: number;
  sourceKey: string;
};

export type GuideRelationship = {
  targetSlug: string;
  type: string;
  description: string;
  importance: number;
  confidence: number;
  sourceKey: string;
};

export type GuideTimelineEvent = {
  eraLabel: string;
  sortKey: number;
  headline: string;
  detail: string;
  sourceKey: string;
};

export type GuideBioSection = {
  heading: string;
  body: string;
};

export type GuideMediaAsset = {
  id: string;
  kind: "portrait" | "gallery";
  title: string;
  src: string;
  alt: string;
  caption: string;
  credit: string | null;
  sourceKey: string;
};

export type GuideCitation = {
  label: string;
  url: string;
  note: string;
  sourceKey: string;
};

export type GuideCartography = {
  quadrant: string;
  sector: string;
  gridLabel: string;
  rangeLabel: string;
  x: number;
  y: number;
};

export type GuideEntity = {
  slug: string;
  displayName: string;
  entityType: string;
  summary: string;
  canonTier: string;
  threatLevel: string;
  diplomaticPosture: string;
  era: string;
  tags: string[];
  profile: Record<string, string>;
  aliases: string[];
  facts: GuideFact[];
  relationships: GuideRelationship[];
  timeline: GuideTimelineEvent[];
};

export type HydratedRelationship = GuideRelationship & {
  target: GuideEntity | null;
  typeLabel: string;
  source: GuideSource | null;
};

export type HydratedTimelineEvent = GuideTimelineEvent & {
  source: GuideSource | null;
};

export type HydratedFact = GuideFact & {
  source: GuideSource | null;
};

export type HydratedCitation = GuideCitation & {
  source: GuideSource | null;
};

export type HydratedEntity = GuideEntity & {
  descriptor: string | null;
  bioSections: GuideBioSection[];
  media: GuideMediaAsset[];
  primaryMedia: GuideMediaAsset | null;
  galleryMedia: GuideMediaAsset[];
  citations: HydratedCitation[];
  cartography: GuideCartography | null;
  confidenceScore: number;
  sourceTrail: GuideSource[];
  primaryFacts: HydratedFact[];
  relationTargets: HydratedRelationship[];
  timelineTrail: HydratedTimelineEvent[];
  readout: string[];
};

type SeedRecord = {
  sources: GuideSource[];
  entities: GuideEntity[];
};

type EnrichmentRecord = {
  generatedAt: string;
  entities: Record<
    string,
    {
      descriptor: string | null;
      bioSections: GuideBioSection[];
      media: GuideMediaAsset[];
      citations: GuideCitation[];
      cartography: GuideCartography | null;
    }
  >;
};

const archive = seed as unknown as SeedRecord;
const archiveEnrichment = enrichment as EnrichmentRecord;
const typeOrder = ["species", "person", "ship", "faction", "world", "event", "collective"];
const supplementalSources: GuideSource[] = [
  {
    key: "wikipedia",
    label: "Wikipedia",
    sourceType: "encyclopedia",
    url: "https://en.wikipedia.org/wiki/Main_Page",
    canonWeight: 0.7,
  },
  {
    key: "wikidata",
    label: "Wikidata",
    sourceType: "structured",
    url: "https://www.wikidata.org/",
    canonWeight: 0.64,
  },
  {
    key: "wikimedia-commons",
    label: "Wikimedia Commons",
    sourceType: "media",
    url: "https://commons.wikimedia.org/",
    canonWeight: 0.76,
  },
];
const allSources = [...archive.sources, ...supplementalSources.filter((source) => !archive.sources.some((entry) => entry.key === source.key))];
const sourceMap = new Map(allSources.map((source) => [source.key, source]));
const entityMap = new Map(archive.entities.map((entity) => [entity.slug, entity]));

function getEnrichment(slug: string) {
  return (
    archiveEnrichment.entities[slug] ?? {
      descriptor: null,
      bioSections: [],
      media: [],
      citations: [],
      cartography: null,
    }
  );
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

function titleCase(value: string) {
  return value
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function byImportance<T extends { importance: number }>(items: T[]) {
  return [...items].sort((left, right) => right.importance - left.importance);
}

function pickFact(entity: GuideEntity, label: string) {
  return entity.facts.find((fact) => fact.label.toLowerCase() === label.toLowerCase()) ?? null;
}

function buildReadout(entity: GuideEntity, mode: ArchiveMode) {
  const homeworld = pickFact(entity, "Homeworld")?.value;
  const culture = pickFact(entity, "Cultural profile")?.value;
  const posture = pickFact(entity, "Diplomatic posture")?.value ?? entity.diplomaticPosture;
  const caution = pickFact(entity, "Operational caution")?.value;
  const threat = pickFact(entity, "Threat profile")?.value ?? entity.threatLevel;
  const profileNotes = Object.entries(entity.profile)
    .map(([label, value]) => `${titleCase(label)}: ${value}`)
    .slice(0, 2);

  const notes: string[] = [...profileNotes];

  if (mode === "first-contact") {
    if (homeworld) notes.push(`Origin point: ${homeworld}`);
    if (culture) notes.push(`Cultural profile: ${culture}`);
    if (posture) notes.push(`Initial contact posture: ${posture}`);
    if (caution) notes.push(`Away-team caution: ${caution}`);
  } else if (mode === "diplomatic") {
    if (posture) notes.push(`Negotiation posture: ${posture}`);
    if (culture) notes.push(`Protocol baseline: ${culture}`);
    if (entity.relationships[0]) {
      notes.push(`Priority linkage: ${formatLabel(entity.relationships[0].type)} with ${entity.relationships[0].targetSlug.replaceAll("-", " ")}`);
    }
  } else if (mode === "threat") {
    if (threat) notes.push(`Threat posture: ${threat}`);
    if (caution) notes.push(`Operational caution: ${caution}`);
    if (culture) notes.push(`Behavioral pattern: ${culture}`);
  } else {
    if (homeworld) notes.push(`Archive anchor: ${homeworld}`);
    if (culture) notes.push(`Identity read: ${culture}`);
    if (threat) notes.push(`Threat index: ${threat}`);
  }

  return notes.slice(0, 4);
}

function uniqueSources(entity: GuideEntity) {
  const keys = new Set<string>();
  const details = getEnrichment(entity.slug);
  const ordered = [
    ...entity.facts.map((fact) => fact.sourceKey),
    ...entity.relationships.map((relationship) => relationship.sourceKey),
    ...entity.timeline.map((event) => event.sourceKey),
    ...details.media.map((asset) => asset.sourceKey),
    ...details.citations.map((citation) => citation.sourceKey),
  ];

  return ordered
    .map((key) => {
      if (keys.has(key)) return null;
      keys.add(key);
      return sourceMap.get(key) ?? null;
    })
    .filter((value): value is GuideSource => value !== null);
}

function confidenceScore(entity: GuideEntity) {
  const values = entity.facts
    .map((fact) => fact.confidence)
    .filter((value) => Number.isFinite(value) && value > 0);

  return Number(average(values).toFixed(2));
}

export function getEntity(slug: string) {
  return entityMap.get(slug) ?? null;
}

export function getHydratedEntity(slug: string, mode: ArchiveMode = "field-guide"): HydratedEntity | null {
  const entity = getEntity(slug);
  if (!entity) return null;
  const details = getEnrichment(slug);
  const media = details.media;
  const citations = details.citations.map((citation) => ({
    ...citation,
    source: sourceMap.get(citation.sourceKey) ?? null,
  }));

  return {
    ...entity,
    descriptor: details.descriptor,
    bioSections: details.bioSections,
    media,
    primaryMedia: media[0] ?? null,
    galleryMedia: media.slice(1),
    citations,
    cartography: details.cartography,
    confidenceScore: confidenceScore(entity),
    sourceTrail: uniqueSources(entity),
    primaryFacts: byImportance(entity.facts)
      .slice(0, 6)
      .map((fact) => ({
        ...fact,
        source: sourceMap.get(fact.sourceKey) ?? null,
      })),
    relationTargets: byImportance(entity.relationships)
      .slice(0, 6)
      .map((relationship) => ({
        ...relationship,
        target: getEntity(relationship.targetSlug),
        typeLabel: titleCase(formatLabel(relationship.type)),
        source: sourceMap.get(relationship.sourceKey) ?? null,
      })),
    timelineTrail: [...entity.timeline]
      .sort((left, right) => left.sortKey - right.sortKey)
      .map((event) => ({
        ...event,
        source: sourceMap.get(event.sourceKey) ?? null,
      })),
    readout: buildReadout(entity, mode),
  };
}

export function buildComparison(leftSlug: string, rightSlug: string) {
  const left = getHydratedEntity(leftSlug);
  const right = getHydratedEntity(rightSlug);

  if (!left || !right) return null;

  const labels = new Set<string>([
    ...left.facts.map((fact) => fact.label),
    ...right.facts.map((fact) => fact.label),
  ]);

  const rows = [...labels]
    .map((label) => {
      const leftFact = left.facts.find((fact) => fact.label === label);
      const rightFact = right.facts.find((fact) => fact.label === label);

      return {
        label,
        left: leftFact?.value ?? left.profile[label] ?? null,
        right: rightFact?.value ?? right.profile[label] ?? null,
        same: Boolean(leftFact?.value && rightFact?.value && leftFact.value === rightFact.value),
        importance: Math.max(leftFact?.importance ?? 0, rightFact?.importance ?? 0),
      };
    })
    .sort((leftRow, rightRow) => rightRow.importance - leftRow.importance || leftRow.label.localeCompare(rightRow.label));

  return {
    left,
    right,
    shared: rows.filter((row) => row.same).slice(0, 4),
    contrast: rows.filter((row) => !row.same).slice(0, 6),
  };
}

type SearchDocument = {
  slug: string;
  displayName: string;
  entityType: string;
  summary: string;
  bio: string;
  canonTier: string;
  threatLevel: string;
  aliases: string;
  tags: string;
};

const searchIndex = new MiniSearch<SearchDocument>({
  idField: "slug",
  fields: ["displayName", "aliases", "summary", "bio", "tags", "entityType"],
  storeFields: ["slug", "displayName", "entityType", "summary", "canonTier", "threatLevel"],
  searchOptions: {
    boost: {
      displayName: 5,
      aliases: 4,
      tags: 2,
      summary: 1,
    },
    prefix: true,
    fuzzy: 0.15,
  },
});

searchIndex.addAll(
  archive.entities.map((entity) => {
    const details = getEnrichment(entity.slug);
    return {
      slug: entity.slug,
      displayName: entity.displayName,
      entityType: entity.entityType,
      summary: entity.summary,
      bio: details.bioSections.map((section) => section.body).join(" "),
      canonTier: entity.canonTier,
      threatLevel: entity.threatLevel,
      aliases: entity.aliases.join(" "),
      tags: entity.tags.join(" "),
    };
  })
);

export function searchArchive(query: string) {
  const trimmed = query.trim();
  if (!trimmed) return [];

  return searchIndex.search(trimmed).slice(0, 6).map((result) => ({
    slug: result.slug,
    displayName: result.displayName,
    entityType: result.entityType,
    summary: result.summary,
    canonTier: result.canonTier,
    threatLevel: result.threatLevel,
  }));
}

export const featuredSlugs = [
  "vulcan-species",
  "borg-collective",
  "uss-enterprise-d",
  "khitomer-accords",
];

export const defaultPrimarySlug = "vulcan-species";
export const defaultCompareSlug = "romulan-species";

export const archiveStats = {
  entityCount: archive.entities.length,
  sourceCount: allSources.length,
  relationCount: archive.entities.reduce((sum, entity) => sum + entity.relationships.length, 0),
  timelineCount: archive.entities.reduce((sum, entity) => sum + entity.timeline.length, 0),
  mediaCount: Object.values(archiveEnrichment.entities).reduce((sum, entity) => sum + entity.media.length, 0),
  citationCount: Object.values(archiveEnrichment.entities).reduce((sum, entity) => sum + entity.citations.length, 0),
};

export const archiveSections = typeOrder
  .map((type) => {
    const entities = archive.entities.filter((entity) => entity.entityType === type);
    if (!entities.length) return null;

    return {
      type,
      label: titleCase(type),
      count: entities.length,
      leadSlug: entities[0]?.slug ?? "",
      entities,
    };
  })
  .filter((section): section is NonNullable<typeof section> => section !== null);

export const featuredRecords = featuredSlugs
  .map((slug) => getHydratedEntity(slug))
  .filter((entity): entity is HydratedEntity => entity !== null);

export const sourceRecords = allSources;

export function listEntitiesByType(type: string | "all") {
  if (type === "all") {
    return archive.entities;
  }

  return archive.entities.filter((entity) => entity.entityType === type);
}
