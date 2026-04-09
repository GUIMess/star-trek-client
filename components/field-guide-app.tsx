"use client";

import clsx from "clsx";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { startTransition, useDeferredValue, useEffect, useState, type CSSProperties } from "react";
import {
  archiveSections,
  archiveStats,
  buildComparison,
  defaultCompareSlug,
  defaultPrimarySlug,
  featuredRecords,
  getHydratedEntity,
  listEntitiesByType,
  searchArchive,
  type ArchiveMode,
  type HydratedEntity,
} from "../lib/field-guide";

type DetailPanel = "overview" | "timeline" | "relations" | "sources" | "compare";

const modeDeck: Array<{
  id: ArchiveMode;
  code: string;
  label: string;
  summary: string;
  accent: string;
  accentSoft: string;
  accentAlt: string;
  accentMuted: string;
}> = [
  {
    id: "field-guide",
    code: "FG-01",
    label: "Field Guide",
    summary: "Archive-first framing for species, worlds, factions, ships, and incidents.",
    accent: "#f49e2f",
    accentSoft: "#b58cff",
    accentAlt: "#ff8d63",
    accentMuted: "#8d96ff",
  },
  {
    id: "first-contact",
    code: "FC-02",
    label: "First Contact",
    summary: "Surfaces protocol, caution, and cultural posture for first-look briefings.",
    accent: "#f4e267",
    accentSoft: "#89a3ff",
    accentAlt: "#f9a24f",
    accentMuted: "#d794ff",
  },
  {
    id: "diplomatic",
    code: "DP-03",
    label: "Diplomatic",
    summary: "Rebalances the archive around negotiation posture, treaties, and alliances.",
    accent: "#c48bff",
    accentSoft: "#ffb073",
    accentAlt: "#f57b6a",
    accentMuted: "#88b4ff",
  },
  {
    id: "threat",
    code: "TH-04",
    label: "Threat",
    summary: "Tightens the view around pressure points, operational caution, and risk.",
    accent: "#ff7a66",
    accentSoft: "#f29f3c",
    accentAlt: "#c48bff",
    accentMuted: "#8e95ff",
  },
];

const panelDeck: Array<{ id: DetailPanel; code: string; label: string }> = [
  { id: "overview", code: "01", label: "Overview" },
  { id: "timeline", code: "02", label: "Timeline" },
  { id: "relations", code: "03", label: "Relations" },
  { id: "sources", code: "04", label: "Sources" },
  { id: "compare", code: "05", label: "Compare" },
];

function formatType(value: string) {
  return value
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatThreat(value: string) {
  if (!value || value === "n/a") return "Context specific";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatConfidence(value: number) {
  return `${Math.round(value * 100)}% confidence`;
}

function buildStardate() {
  const now = new Date();
  const anchorYear = 2025;
  const startOfYear = Date.UTC(now.getUTCFullYear(), 0, 1);
  const endOfYear = Date.UTC(now.getUTCFullYear() + 1, 0, 1);
  const yearProgress = (now.getTime() - startOfYear) / (endOfYear - startOfYear);
  return (78000 + (now.getUTCFullYear() - anchorYear) * 1000 + yearProgress * 1000).toFixed(1);
}

function hydrateSlugs(slugs: string[], mode: ArchiveMode) {
  return slugs
    .map((slug) => getHydratedEntity(slug, mode))
    .filter((record): record is HydratedEntity => record !== null);
}

function buildSectionCode(index: number) {
  return `${String(index + 2).padStart(2, "0")}-${String((index + 1) * 173).padStart(4, "0")}`;
}

function buildRecordCode(index: number) {
  return `${String(index + 3).padStart(2, "0")}-${String((index + 1) * 917).padStart(4, "0")}`;
}

function buildSystemStats() {
  return [
    { label: "Archive", value: archiveStats.entityCount, detail: "indexed records" },
    { label: "Relations", value: archiveStats.relationCount, detail: "cross-links" },
    { label: "Sources", value: archiveStats.citationCount, detail: "citations" },
    { label: "Media", value: archiveStats.mediaCount, detail: "assets cached" },
  ];
}

export function FieldGuideApp() {
  const reducedMotion = useReducedMotion();
  const [mode, setMode] = useState<ArchiveMode>("field-guide");
  const [panel, setPanel] = useState<DetailPanel>("overview");
  const [activeSection, setActiveSection] = useState<string | "all">("all");
  const [activeSlug, setActiveSlug] = useState(defaultPrimarySlug);
  const [compareSlug, setCompareSlug] = useState(defaultCompareSlug);
  const [query, setQuery] = useState("");
  const [stardate, setStardate] = useState("--.--");
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    const update = () => setStardate(buildStardate());
    update();
    const interval = window.setInterval(update, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const activeMode = modeDeck.find((entry) => entry.id === mode) ?? modeDeck[0];
  const featuredDeck = hydrateSlugs(
    featuredRecords.map((record) => record.slug),
    mode
  );
  const sectionDeck =
    activeSection === "all"
      ? featuredDeck
      : hydrateSlugs(
          listEntitiesByType(activeSection).map((entity) => entity.slug),
          mode
        ).slice(0, 8);
  const activeRecord = getHydratedEntity(activeSlug, mode) ?? featuredDeck[0];
  const activeSectionMeta =
    activeSection === "all"
      ? null
      : archiveSections.find((section) => section.type === activeSection) ?? null;
  const filteredResults = deferredQuery.trim()
    ? hydrateSlugs(
        searchArchive(deferredQuery)
          .map((result) => result.slug)
          .filter((slug) => slug !== activeSlug),
        mode
      )
    : sectionDeck.filter((record) => record.slug !== activeSlug);
  const relatedRecords = hydrateSlugs(
    activeRecord.relationTargets.map((relationship) => relationship.targetSlug),
    mode
  )
    .filter((record) => record.slug !== activeRecord.slug)
    .slice(0, 6);
  const fallbackCompare =
    relatedRecords[0] ?? featuredDeck.find((record) => record.slug !== activeRecord.slug) ?? null;
  const resolvedCompareSlug =
    compareSlug !== activeRecord.slug ? compareSlug : fallbackCompare?.slug ?? defaultCompareSlug;
  const compareRecord =
    resolvedCompareSlug && resolvedCompareSlug !== activeRecord.slug
      ? getHydratedEntity(resolvedCompareSlug, mode)
      : null;
  const comparison =
    resolvedCompareSlug && resolvedCompareSlug !== activeRecord.slug
      ? buildComparison(activeRecord.slug, resolvedCompareSlug)
      : null;
  const systemStats = buildSystemStats();
  const heroNotes = activeRecord.readout.slice(0, 4);
  const panelKey = `${panel}-${activeRecord.slug}-${resolvedCompareSlug}-${mode}`;
  const themeStyle = {
    ["--lcars-accent" as const]: activeMode.accent,
    ["--lcars-accent-soft" as const]: activeMode.accentSoft,
    ["--lcars-accent-alt" as const]: activeMode.accentAlt,
    ["--lcars-accent-muted" as const]: activeMode.accentMuted,
  } as CSSProperties;

  function focusEntity(slug: string) {
    startTransition(() => {
      const entity = getHydratedEntity(slug, mode);
      setActiveSlug(slug);
      setPanel("overview");
      setQuery("");
      if (entity) {
        setActiveSection(entity.entityType);
      }
    });
  }

  function switchMode(nextMode: ArchiveMode) {
    startTransition(() => {
      setMode(nextMode);
    });
  }

  function switchSection(section: string | "all", leadSlug?: string) {
    startTransition(() => {
      setActiveSection(section);
      setPanel("overview");
      setQuery("");
      if (leadSlug) {
        setActiveSlug(leadSlug);
      }
    });
  }

  function openCompare(slug: string) {
    if (slug === activeRecord.slug) return;
    startTransition(() => {
      setCompareSlug(slug);
      setPanel("compare");
    });
  }

  function renderPanel() {
    if (panel === "timeline") {
      return (
        <div className="lcars-log-panel-grid">
          <section className="lcars-log-card">
            <div className="lcars-log-card-head">
              <span>Timeline</span>
              <strong>{activeRecord.timelineTrail.length} entries</strong>
            </div>
            {activeRecord.timelineTrail.length ? (
              <div className="lcars-log-event-list">
                {activeRecord.timelineTrail.map((event) => (
                  <article className="lcars-log-event-row" key={`${event.sortKey}-${event.headline}`}>
                    <p className="lcars-log-event-era">{event.eraLabel}</p>
                    <h3>{event.headline}</h3>
                    <p>{event.detail}</p>
                    <span>{event.source?.label ?? "Source pending"}</span>
                  </article>
                ))}
              </div>
            ) : (
              <p className="lcars-log-empty">Timeline detail is still being expanded for this record.</p>
            )}
          </section>
        </div>
      );
    }

    if (panel === "relations") {
      return (
        <div className="lcars-log-panel-grid lcars-log-panel-grid-wide">
          <section className="lcars-log-card">
            <div className="lcars-log-card-head">
              <span>Relationship graph</span>
              <strong>{activeRecord.relationTargets.length} live links</strong>
            </div>
            {activeRecord.relationTargets.length ? (
              <div className="lcars-log-relation-list">
                {activeRecord.relationTargets.map((relationship) => (
                  <article className="lcars-log-relation-row" key={`${relationship.type}-${relationship.targetSlug}`}>
                    <div>
                      <p className="lcars-log-relation-type">{relationship.typeLabel}</p>
                      <h3>{relationship.target?.displayName ?? relationship.targetSlug.replaceAll("-", " ")}</h3>
                      <p>{relationship.description}</p>
                    </div>
                    <div className="lcars-log-relation-actions">
                      {relationship.target ? (
                        <>
                          <button onClick={() => focusEntity(relationship.target!.slug)} type="button">
                            Open record
                          </button>
                          <button onClick={() => openCompare(relationship.target!.slug)} type="button">
                            Compare
                          </button>
                        </>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="lcars-log-empty">Cross-links are not available for this entry yet.</p>
            )}
          </section>
        </div>
      );
    }

    if (panel === "sources") {
      return (
        <div className="lcars-log-panel-grid lcars-log-panel-grid-split">
          <section className="lcars-log-card">
            <div className="lcars-log-card-head">
              <span>Source trail</span>
              <strong>{activeRecord.sourceTrail.length} supporting sources</strong>
            </div>
            <div className="lcars-log-source-list">
              {activeRecord.sourceTrail.map((source) => (
                <article className="lcars-log-source-row" key={source.key}>
                  <div>
                    <p className="lcars-log-source-type">{source.sourceType}</p>
                    <h3>{source.label}</h3>
                  </div>
                  <div className="lcars-log-source-meta">
                    <span>{Math.round(source.canonWeight * 100)}% weight</span>
                    {source.url ? (
                      <a href={source.url} rel="noreferrer" target="_blank">
                        Open
                      </a>
                    ) : (
                      <span>Internal only</span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="lcars-log-card">
            <div className="lcars-log-card-head">
              <span>Linked citations</span>
              <strong>{activeRecord.citations.length} references</strong>
            </div>
            {activeRecord.citations.length ? (
              <div className="lcars-log-source-list">
                {activeRecord.citations.map((citation) => (
                  <article className="lcars-log-source-row" key={citation.label}>
                    <div>
                      <p className="lcars-log-source-type">{citation.source?.label ?? citation.sourceKey}</p>
                      <h3>{citation.label}</h3>
                      <p>{citation.note}</p>
                    </div>
                    <div className="lcars-log-source-meta">
                      <a href={citation.url} rel="noreferrer" target="_blank">
                        Visit source
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="lcars-log-empty">No outward citations have been attached to this record yet.</p>
            )}
          </section>
        </div>
      );
    }

    if (panel === "compare") {
      return (
        <div className="lcars-log-panel-grid">
          <section className="lcars-log-card">
            <div className="lcars-log-card-head">
              <span>Comparison target</span>
              <strong>{compareRecord?.displayName ?? "Select a related record"}</strong>
            </div>
            <div className="lcars-log-chip-grid">
              {relatedRecords.map((record) => (
                <button
                  className={clsx("lcars-log-chip-button", resolvedCompareSlug === record.slug && "is-active")}
                  key={record.slug}
                  onClick={() => openCompare(record.slug)}
                  type="button"
                >
                  <span>{formatType(record.entityType)}</span>
                  <strong>{record.displayName}</strong>
                </button>
              ))}
            </div>

            {comparison && compareRecord ? (
              <div className="lcars-log-compare-layout">
                <article className="lcars-log-compare-hero">
                  <p>{activeRecord.displayName}</p>
                  <h3>against {compareRecord.displayName}</h3>
                  <p>{compareRecord.summary}</p>
                </article>

                <div className="lcars-log-compare-rows">
                  {comparison.contrast.map((row) => (
                    <article className="lcars-log-compare-row" key={row.label}>
                      <span>{row.label}</span>
                      <div>
                        <strong>{comparison.left.displayName}</strong>
                        <p>{row.left ?? "No entry"}</p>
                      </div>
                      <div>
                        <strong>{comparison.right.displayName}</strong>
                        <p>{row.right ?? "No entry"}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : (
              <p className="lcars-log-empty">Choose a linked record to compare the archive brief side by side.</p>
            )}
          </section>
        </div>
      );
    }

    return (
      <div className="lcars-log-panel-grid lcars-log-panel-grid-overview">
        <section className="lcars-log-card lcars-log-card-emphasis">
          <div className="lcars-log-card-head">
            <span>Operator readout</span>
            <strong>{activeRecord.descriptor ?? activeRecord.displayName}</strong>
          </div>
          <ul className="lcars-log-note-list">
            {heroNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>

        <section className="lcars-log-card">
          <div className="lcars-log-card-head">
            <span>Primary facts</span>
            <strong>{activeRecord.primaryFacts.length} high-priority signals</strong>
          </div>
          <div className="lcars-log-fact-list">
            {activeRecord.primaryFacts.map((fact) => (
              <article className="lcars-log-fact-row" key={fact.label}>
                <div>
                  <p>{fact.label}</p>
                  <h3>{fact.value}</h3>
                </div>
                <span>{formatConfidence(fact.confidence)}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="lcars-log-card">
          <div className="lcars-log-card-head">
            <span>Profile</span>
            <strong>{formatType(activeRecord.entityType)}</strong>
          </div>
          <div className="lcars-log-profile-list">
            <article className="lcars-log-profile-row">
              <span>Threat</span>
              <strong>{formatThreat(activeRecord.threatLevel)}</strong>
            </article>
            <article className="lcars-log-profile-row">
              <span>Canon tier</span>
              <strong>{activeRecord.canonTier}</strong>
            </article>
            <article className="lcars-log-profile-row">
              <span>Posture</span>
              <strong>{activeRecord.diplomaticPosture}</strong>
            </article>
            {Object.entries(activeRecord.profile).map(([label, value]) => (
              <article className="lcars-log-profile-row" key={label}>
                <span>{formatType(label)}</span>
                <strong>{value}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="lcars-log-card">
          <div className="lcars-log-card-head">
            <span>Briefing</span>
            <strong>{activeRecord.bioSections[0]?.heading ?? "Archive summary"}</strong>
          </div>
          <div className="lcars-log-copy-stack">
            {(activeRecord.bioSections.length ? activeRecord.bioSections : [{ heading: "Summary", body: activeRecord.summary }])
              .slice(0, 2)
              .map((section) => (
                <article key={section.heading}>
                  <p className="lcars-log-copy-kicker">{section.heading}</p>
                  <p>{section.body}</p>
                </article>
              ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <main className="lcars-log-root" style={themeStyle}>
      <div className="lcars-log-shell">
        <motion.header
          animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
          className="lcars-log-header"
          initial={reducedMotion ? undefined : { opacity: 0, y: 18 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="lcars-log-brand">
            <div className="lcars-log-brand-block lcars-log-brand-block-primary">
              <span>Trek</span>
              <strong>Field Guide</strong>
            </div>
            <div className="lcars-log-brand-block lcars-log-brand-block-secondary">
              <span>02-site map</span>
              <strong>{activeSectionMeta?.label ?? "Featured deck"}</strong>
            </div>
          </div>

          <div className="lcars-log-heading">
            <p className="lcars-log-overline">Archive log {activeMode.code}</p>
            <h1>LCARS archive, simplified.</h1>
            <p>{activeMode.summary}</p>
          </div>

          <div className="lcars-log-mode-grid">
            {modeDeck.map((entry) => (
              <button
                className={clsx("lcars-log-mode-button", entry.id === mode && "is-active")}
                key={entry.id}
                onClick={() => switchMode(entry.id)}
                type="button"
              >
                <span>{entry.code}</span>
                <strong>{entry.label}</strong>
              </button>
            ))}
          </div>
        </motion.header>

        <div className="lcars-log-divider" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>

        <div className="lcars-log-grid">
          <aside className="lcars-log-rail">
            <button
              className={clsx("lcars-log-rail-button lcars-log-rail-button-featured", activeSection === "all" && "is-active")}
              onClick={() => switchSection("all", featuredDeck[0]?.slug ?? defaultPrimarySlug)}
              type="button"
            >
              <span>01-0001</span>
              <strong>Featured deck</strong>
            </button>

            {archiveSections.map((section, index) => (
              <button
                className={clsx("lcars-log-rail-button", activeSection === section.type && "is-active")}
                key={section.type}
                onClick={() => switchSection(section.type, section.leadSlug)}
                type="button"
              >
                <span>{buildSectionCode(index)}</span>
                <strong>{section.label}</strong>
              </button>
            ))}
          </aside>

          <section className="lcars-log-main">
            <AnimatePresence mode="wait" initial={false}>
              <motion.article
                animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
                className="lcars-log-hero"
                initial={reducedMotion ? undefined : { opacity: 0, y: 24 }}
                key={`${activeRecord.slug}-${mode}`}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="lcars-log-hero-topline">
                  <p className="lcars-log-overline">
                    {formatType(activeRecord.entityType)} archive / {activeRecord.era}
                  </p>
                  <div className="lcars-log-hero-stamps">
                    <span>Stardate {stardate}</span>
                    <span>{activeRecord.canonTier} canon</span>
                  </div>
                </div>

                <div className="lcars-log-hero-bars" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                  <span />
                </div>

                <h2>{activeRecord.displayName}</h2>
                <p className="lcars-log-hero-copy">{activeRecord.summary}</p>

                <div className="lcars-log-tag-row">
                  <span>{formatThreat(activeRecord.threatLevel)} threat</span>
                  <span>{formatType(activeRecord.entityType)}</span>
                  <span>{activeRecord.era}</span>
                </div>

                <div className="lcars-log-action-row">
                  <button onClick={() => setPanel("overview")} type="button">
                    Open brief
                  </button>
                  <button onClick={() => setPanel("timeline")} type="button">
                    Timeline
                  </button>
                  {relatedRecords[0] ? (
                    <button onClick={() => openCompare(relatedRecords[0].slug)} type="button">
                      Compare with {relatedRecords[0].displayName}
                    </button>
                  ) : null}
                </div>
              </motion.article>
            </AnimatePresence>

            <section className="lcars-log-detail">
              <div className="lcars-log-tab-row">
                {panelDeck.map((entry) => (
                  <button
                    className={clsx("lcars-log-tab-button", panel === entry.id && "is-active")}
                    key={entry.id}
                    onClick={() => setPanel(entry.id)}
                    type="button"
                  >
                    <span>{entry.code}</span>
                    <strong>{entry.label}</strong>
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait" initial={false}>
                <motion.section
                  animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
                  className="lcars-log-detail-surface"
                  initial={reducedMotion ? undefined : { opacity: 0, y: 18 }}
                  key={panelKey}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                >
                  {renderPanel()}
                </motion.section>
              </AnimatePresence>
            </section>
          </section>

          <aside className="lcars-log-side">
            <section className="lcars-log-side-block">
              <div className="lcars-log-card-head">
                <span>{deferredQuery.trim() ? "Search results" : "Browse deck"}</span>
                <strong>{activeSectionMeta?.label ?? "Featured"}</strong>
              </div>

              <label className="lcars-log-search">
                <span>Search archive</span>
                <input
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Vulcan, Khitomer, Borg..."
                  type="search"
                  value={query}
                />
              </label>

              <div className="lcars-log-record-list">
                {filteredResults.length ? (
                  filteredResults.slice(0, 6).map((record, index) => (
                    <button
                      className="lcars-log-record-button"
                      key={record.slug}
                      onClick={() => focusEntity(record.slug)}
                      type="button"
                    >
                      <span>{buildRecordCode(index)}</span>
                      <strong>{record.displayName}</strong>
                      <p>{record.summary}</p>
                    </button>
                  ))
                ) : (
                  <p className="lcars-log-empty">No matching records on the current deck yet.</p>
                )}
              </div>
            </section>

            <section className="lcars-log-side-block">
              <div className="lcars-log-card-head">
                <span>System status</span>
                <strong>Archive stable</strong>
              </div>

              <div className="lcars-log-stat-grid">
                {systemStats.map((stat) => (
                  <article className="lcars-log-stat-card" key={stat.label}>
                    <span>{stat.label}</span>
                    <strong>{stat.value}</strong>
                    <p>{stat.detail}</p>
                  </article>
                ))}
              </div>

              {relatedRecords.length ? (
                <div className="lcars-log-chip-grid">
                  {relatedRecords.slice(0, 4).map((record) => (
                    <button
                      className={clsx("lcars-log-chip-button", resolvedCompareSlug === record.slug && "is-active")}
                      key={record.slug}
                      onClick={() => openCompare(record.slug)}
                      type="button"
                    >
                      <span>{formatType(record.entityType)}</span>
                      <strong>{record.displayName}</strong>
                    </button>
                  ))}
                </div>
              ) : null}
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
