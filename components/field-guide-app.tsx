"use client";

import clsx from "clsx";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import { startTransition, useDeferredValue, useEffect, useState } from "react";
import { ArchiveBackdrop } from "./archive-backdrop";
import { RelationOrbit } from "./relation-orbit";
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
  sourceRecords,
  type ArchiveMode,
} from "../lib/field-guide";

const modeDeck: Array<{
  id: ArchiveMode;
  code: string;
  label: string;
  summary: string;
}> = [
  {
    id: "field-guide",
    code: "FG-01",
    label: "Field Guide",
    summary: "Cross-linked archive view for browsing species, worlds, ships, and treaty events.",
  },
  {
    id: "first-contact",
    code: "FC-02",
    label: "First Contact",
    summary: "Prioritizes diplomacy posture, cultural profile, and away-team cautions.",
  },
  {
    id: "diplomatic",
    code: "DP-03",
    label: "Diplomatic",
    summary: "Surfaces protocol, strategic posture, and relationship signals first.",
  },
  {
    id: "threat",
    code: "TH-04",
    label: "Threat",
    summary: "Frames the dossier around threat posture, operational caution, and strategic risk.",
  },
];

function formatThreat(value: string) {
  if (!value || value === "n/a") return "Context specific";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatConfidence(value: number) {
  return `${Math.round(value * 100)}%`;
}

function buildStardate() {
  const now = new Date();
  const anchorYear = 2025;
  const startOfYear = Date.UTC(now.getUTCFullYear(), 0, 1);
  const endOfYear = Date.UTC(now.getUTCFullYear() + 1, 0, 1);
  const yearProgress = (Date.now() - startOfYear) / (endOfYear - startOfYear);
  return (78000 + (now.getUTCFullYear() - anchorYear) * 1000 + yearProgress * 1000).toFixed(1);
}

function buildScanBars(primaryFacts: Array<{ importance: number }>) {
  return primaryFacts.slice(0, 6).map((fact, index) => ({
    id: `${fact.importance}-${index}`,
    height: `${28 + Math.round((fact.importance / 100) * 72)}%`,
  }));
}

const revealVariant: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
};

export function FieldGuideApp() {
  const reducedMotion = useReducedMotion();
  const [mode, setMode] = useState<ArchiveMode>("field-guide");
  const [activeSection, setActiveSection] = useState<string | "all">("all");
  const [activeSlug, setActiveSlug] = useState(defaultPrimarySlug);
  const [compareSlug, setCompareSlug] = useState<string | null>(defaultCompareSlug);
  const [query, setQuery] = useState("");
  const [stardate, setStardate] = useState(buildStardate());
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    const update = () => setStardate(buildStardate());
    update();
    const interval = window.setInterval(update, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const activeRecord = getHydratedEntity(activeSlug, mode) ?? featuredRecords[0];
  const compareRecord = compareSlug ? getHydratedEntity(compareSlug, mode) : null;
  const comparison = compareSlug ? buildComparison(activeSlug, compareSlug) : null;
  const searchResults = deferredQuery.trim() ? searchArchive(deferredQuery) : [];
  const browseRecords = (
    activeSection === "all"
      ? featuredRecords
      : listEntitiesByType(activeSection)
          .map((entity) => getHydratedEntity(entity.slug))
          .filter((entity): entity is NonNullable<typeof entity> => entity !== null)
  ).slice(0, 6);
  const relatedTargets = activeRecord.relationTargets
    .map((relationship) => relationship.target)
    .filter((entity): entity is NonNullable<typeof entity> => entity !== null)
    .slice(0, 4);
  const scanBars = buildScanBars(activeRecord.primaryFacts);
  const activeMode = modeDeck.find((entry) => entry.id === mode) ?? modeDeck[0];
  const launchRecords = featuredRecords.slice(0, 4);
  const mastheadMetrics = [
    {
      label: "Indexed entities",
      value: archiveStats.entityCount,
      detail: "species, worlds, ships, captains",
      fill: Math.min(100, archiveStats.entityCount * 6),
    },
    {
      label: "Relation links",
      value: archiveStats.relationCount,
      detail: "cross-referenced across the archive",
      fill: Math.min(100, archiveStats.relationCount * 3),
    },
    {
      label: "Timeline beats",
      value: archiveStats.timelineCount,
      detail: "eras and incidents already staged",
      fill: Math.min(100, archiveStats.timelineCount * 10),
    },
    {
      label: "Source classes",
      value: archiveStats.sourceCount,
      detail: "screen canon, reference, operator notes",
      fill: Math.min(100, archiveStats.sourceCount * 24),
    },
  ];

  function focusEntity(slug: string) {
    startTransition(() => {
      setActiveSlug(slug);
    });
  }

  function dockCompare(slug: string) {
    if (slug === activeSlug) return;

    startTransition(() => {
      setCompareSlug(slug);
    });
  }

  return (
    <main className="archive-root">
      <ArchiveBackdrop />
      <motion.div
        className="archive-shell"
        initial="hidden"
        animate="show"
        transition={{ staggerChildren: reducedMotion ? 0 : 0.06 }}
      >
        <motion.header className="archive-masthead" variants={revealVariant}>
          <div className="masthead-kicker">
            <span className="lcars-chip lcars-chip-primary">Federation archive link stable</span>
            <span className="lcars-chip">stardate {stardate}</span>
            <span className="lcars-chip">alpha quadrant touch wall</span>
          </div>
          <div className="masthead-grid">
            <div className="masthead-copy">
              <p className="eyebrow">Trek Field Guide</p>
              <h1>Federation field guide.</h1>
              <p className="lede">
                Species, worlds, ships, factions, and treaty flashpoints already loaded into a Federation
                archive wall. Tap any dossier, follow the links, and keep moving.
              </p>
              <div className="masthead-highlights">
                <article className="highlight-card">
                  <span>Active dossier</span>
                  <strong>{activeRecord.displayName}</strong>
                  <p>{activeRecord.summary}</p>
                </article>
                <article className="highlight-card">
                  <span>Compare dock</span>
                  <strong>{compareRecord?.displayName ?? "Ready for pin"}</strong>
                  <p>
                    {compareRecord
                      ? `Cross-checking ${compareRecord.entityType} signals and canon trail.`
                      : "Pin a second subject from the launch deck or the relation web."}
                  </p>
                </article>
                <article className="highlight-card">
                  <span>Current lens</span>
                  <strong>{activeMode.label}</strong>
                  <p>{activeMode.summary}</p>
                </article>
              </div>
            </div>
            <div className="masthead-deck">
              <div className="masthead-status">
                {mastheadMetrics.map((metric) => (
                  <article className="masthead-metric" key={metric.label}>
                    <span>{metric.label}</span>
                    <strong>{metric.value}</strong>
                    <small>{metric.detail}</small>
                    <div className="metric-band-track" aria-hidden="true">
                      <span className="metric-band-fill" style={{ width: `${metric.fill}%` }} />
                    </div>
                  </article>
                ))}
              </div>
              <section className="masthead-launch">
                <div className="panel-head panel-head-tight">
                  <p className="eyebrow">Launch subjects</p>
                  <span>tap to load or dock</span>
                </div>
                <div className="launch-grid">
                  {launchRecords.map((record) => (
                    <article className="launch-card" key={record.slug}>
                      <button
                        className="launch-card-main"
                        type="button"
                        onClick={() => focusEntity(record.slug)}
                      >
                        <span>
                          {record.entityType} / {record.era}
                        </span>
                        <strong>{record.displayName}</strong>
                        <p>{record.summary}</p>
                      </button>
                      <div className="launch-card-footer">
                        <span>{record.timelineTrail.at(-1)?.eraLabel ?? record.era}</span>
                        <button type="button" onClick={() => dockCompare(record.slug)}>
                          Dock
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </motion.header>

        <div className="archive-frame">
          <motion.aside className="control-rail" variants={revealVariant}>
            <section className="rail-panel rail-panel-modes">
              <div className="panel-head">
                <p className="eyebrow">Modes</p>
                <span>{activeMode.code}</span>
              </div>
              <div className="mode-stack">
                {modeDeck.map((entry) => (
                  <button
                    className={clsx("mode-button", mode === entry.id && "is-active")}
                    key={entry.id}
                    type="button"
                    onClick={() => setMode(entry.id)}
                  >
                    <span>{entry.code}</span>
                    <strong>{entry.label}</strong>
                    <small>{entry.summary}</small>
                  </button>
                ))}
              </div>
            </section>

            <section className="rail-panel rail-panel-search">
              <div className="panel-head">
                <p className="eyebrow">Archive Jump</p>
                <span>Search by name or alias</span>
              </div>
              <label className="search-shell">
                <span>Target</span>
                <input
                  name="query"
                  type="text"
                  placeholder="Vulcan, Borg, Picard, Khitomer..."
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <div className="search-results">
                {searchResults.length ? (
                  searchResults.map((result) => (
                    <article className="search-result-card" key={result.slug}>
                      <button type="button" onClick={() => focusEntity(result.slug)}>
                        <strong>{result.displayName}</strong>
                        <span>
                          {result.entityType} / {result.canonTier}
                        </span>
                        <p>{result.summary}</p>
                      </button>
                      <div className="search-result-actions">
                        <button type="button" onClick={() => dockCompare(result.slug)}>
                          Compare
                        </button>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="search-placeholder">
                    {query
                      ? "No direct match in the current archive snapshot."
                      : "The wall is already live. Use archive jump when you want a direct handoff."}
                  </p>
                )}
              </div>
            </section>

            <section className="rail-panel rail-panel-sections">
              <div className="panel-head">
                <p className="eyebrow">Archive Strata</p>
                <span>Tap to retune the deck</span>
              </div>
              <div className="section-grid">
                <button
                  className={clsx("section-card", activeSection === "all" && "is-active")}
                  type="button"
                  onClick={() => setActiveSection("all")}
                >
                  <strong>Featured</strong>
                  <span>Curated launch subjects</span>
                </button>
                {archiveSections.map((section) => (
                  <button
                    className={clsx("section-card", activeSection === section.type && "is-active")}
                    key={section.type}
                    type="button"
                    onClick={() => {
                      setActiveSection(section.type);
                      focusEntity(section.leadSlug);
                    }}
                  >
                    <strong>{section.label}</strong>
                    <span>{section.count} indexed records</span>
                  </button>
                ))}
              </div>
            </section>
          </motion.aside>

          <div className="guide-stage">
            <motion.section className="stage-top-grid" variants={revealVariant}>
              <AnimatePresence mode="wait">
                <motion.article
                  className="dossier-panel"
                  initial={{ opacity: 0, y: 28 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -18 }}
                  key={`${activeRecord.slug}-${mode}`}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                >
                  <div className="panel-head">
                    <p className="eyebrow">Loaded Record</p>
                    <span>
                      {activeRecord.entityType} / {activeRecord.era}
                    </span>
                  </div>
                  <div className="dossier-grid">
                    <div className="dossier-copy">
                      <div className="dossier-line">
                        <span className="lcars-badge">{activeMode.label}</span>
                        <span className="lcars-badge lcars-badge-soft">{activeRecord.canonTier} canon</span>
                      </div>
                      <h2>{activeRecord.displayName}</h2>
                      <p className="dossier-summary">{activeRecord.summary}</p>
                      <div className="tag-row">
                        {activeRecord.tags.map((tag) => (
                          <span className="tag-pill" key={tag}>
                            {tag}
                          </span>
                        ))}
                      </div>
                      <div className="dossier-actions">
                        {relatedTargets.slice(0, 2).map((target) => (
                          <button key={target.slug} type="button" onClick={() => focusEntity(target.slug)}>
                            Open {target.displayName}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => dockCompare(activeRecord.slug === "vulcan-species" ? "romulan-species" : "vulcan-species")}
                        >
                          Dock alternate
                        </button>
                      </div>
                    </div>
                    <div className="dossier-sidecar">
                      <div className="metric-grid">
                        <article className="metric-card">
                          <span>Threat index</span>
                          <strong>{formatThreat(activeRecord.threatLevel)}</strong>
                        </article>
                        <article className="metric-card">
                          <span>Archive confidence</span>
                          <strong>{formatConfidence(activeRecord.confidenceScore)}</strong>
                        </article>
                        <article className="metric-card">
                          <span>Linked records</span>
                          <strong>{activeRecord.relationTargets.length}</strong>
                        </article>
                        <article className="metric-card">
                          <span>Source trail</span>
                          <strong>{activeRecord.sourceTrail.length}</strong>
                        </article>
                      </div>

                      <div className="scan-spectrum" aria-hidden="true">
                        {scanBars.map((bar) => (
                          <span className="scan-bar" key={bar.id} style={{ height: bar.height }} />
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.article>
              </AnimatePresence>

              <article className="support-panel">
                <div className="panel-head">
                  <p className="eyebrow">Guide Lens</p>
                  <span>{activeMode.code}</span>
                </div>
                <div className="support-copy">
                  <h3>{activeMode.label} lens</h3>
                  <p>{activeMode.summary}</p>
                </div>
                <div className="support-list">
                  {Object.entries(activeRecord.profile).map(([label, value]) => (
                    <article className="support-row" key={label}>
                      <span>{label.replace(/([A-Z])/g, " $1")}</span>
                      <strong>{value}</strong>
                    </article>
                  ))}
                </div>
                <div className="support-compare">
                  <div className="panel-head panel-head-tight">
                    <p className="eyebrow">Compare Dock</p>
                    <span>{compareRecord ? compareRecord.displayName : "Empty"}</span>
                  </div>
                  {compareRecord ? (
                    <div className="compare-dock-card">
                      <strong>{compareRecord.displayName}</strong>
                      <p>{compareRecord.summary}</p>
                      <div className="dock-actions">
                        <button type="button" onClick={() => focusEntity(compareRecord.slug)}>
                          Open target
                        </button>
                        <button type="button" onClick={() => setCompareSlug(null)}>
                          Clear dock
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="search-placeholder">
                      Tap the plus chip on relation nodes or use a search result to dock a second dossier.
                    </p>
                  )}
                </div>
              </article>
            </motion.section>

            <div className="stage-grid">
              <motion.section className="stage-panel orbit-panel" variants={revealVariant}>
                <div className="panel-head">
                  <p className="eyebrow">Relation Web</p>
                  <span>tap nodes to jump or dock</span>
                </div>
                <RelationOrbit
                  compareSlug={compareSlug}
                  entity={activeRecord}
                  onCompare={dockCompare}
                  onSelect={focusEntity}
                />
              </motion.section>

              <motion.section className="stage-panel facts-panel" variants={revealVariant}>
                <div className="panel-head">
                  <p className="eyebrow">Operational Readout</p>
                  <span>{activeRecord.primaryFacts.length} ranked facts</span>
                </div>
                <div className="facts-layout">
                  <div className="readout-card">
                    <h3>Mode-specific readout</h3>
                    <ul>
                      {activeRecord.readout.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="facts-stack">
                    {activeRecord.primaryFacts.map((fact) => (
                      <article className="fact-card" key={fact.label}>
                        <span>{fact.label}</span>
                        <strong>{fact.value}</strong>
                        <small>{fact.source?.label ?? "Source pending"}</small>
                      </article>
                    ))}
                  </div>
                </div>
              </motion.section>

              <motion.section className="stage-panel timeline-panel" variants={revealVariant}>
                <div className="panel-head">
                  <p className="eyebrow">Timeline Trail</p>
                  <span>{activeRecord.timelineTrail.length || 1} sequence nodes</span>
                </div>
                <div className="timeline-stack">
                  {activeRecord.timelineTrail.length ? (
                    activeRecord.timelineTrail.map((event, index) => (
                      <motion.article
                        className="timeline-card"
                        key={`${event.eraLabel}-${event.headline}`}
                        initial={{ opacity: 0, x: -18 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.35, delay: index * 0.06 }}
                      >
                        <span>{event.eraLabel}</span>
                        <strong>{event.headline}</strong>
                        <p>{event.detail}</p>
                      </motion.article>
                    ))
                  ) : (
                    <article className="timeline-card timeline-card-empty">
                      <span>Archive gap</span>
                      <strong>No discrete timeline events in the current snapshot.</strong>
                      <p>The field guide still carries this entity as an anchor record through relations and facts.</p>
                    </article>
                  )}
                </div>
              </motion.section>

              <motion.section className="stage-panel sources-panel" variants={revealVariant}>
                <div className="panel-head">
                  <p className="eyebrow">Source Trail</p>
                  <span>confidence weighted</span>
                </div>
                <div className="source-stack">
                  {activeRecord.sourceTrail.map((source) => (
                    <article className="source-card" key={source.key}>
                      <div className="source-head">
                        <strong>{source.label}</strong>
                        <span>{source.sourceType}</span>
                      </div>
                      <div className="source-bar-track">
                        <span className="source-bar-fill" style={{ width: `${Math.round(source.canonWeight * 100)}%` }} />
                      </div>
                      <small>{Math.round(source.canonWeight * 100)}% trust weighting</small>
                    </article>
                  ))}
                  <div className="source-legend">
                    {sourceRecords.map((source) => (
                      <span key={source.key}>{source.label}</span>
                    ))}
                  </div>
                </div>
              </motion.section>

              <motion.section className="stage-panel compare-panel" variants={revealVariant}>
                <div className="panel-head">
                  <p className="eyebrow">Compare Deck</p>
                  <span>{comparison ? `${comparison.left.displayName} vs ${comparison.right.displayName}` : "dock another record"}</span>
                </div>
                {comparison ? (
                  <div className="compare-layout">
                    <div className="compare-summary-grid">
                      <article className="compare-summary-card">
                        <span>{comparison.left.entityType}</span>
                        <strong>{comparison.left.displayName}</strong>
                        <p>{comparison.left.summary}</p>
                      </article>
                      <article className="compare-summary-card">
                        <span>{comparison.right.entityType}</span>
                        <strong>{comparison.right.displayName}</strong>
                        <p>{comparison.right.summary}</p>
                      </article>
                    </div>

                    <div className="compare-columns">
                      <article className="compare-column">
                        <h3>Shared</h3>
                        {comparison.shared.length ? (
                          <ul>
                            {comparison.shared.map((item) => (
                              <li key={item.label}>
                                <strong>{item.label}</strong>
                                <span>{item.left}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="search-placeholder">No shared high-weight facts in the current compare window.</p>
                        )}
                      </article>
                      <article className="compare-column">
                        <h3>Contrast</h3>
                        {comparison.contrast.length ? (
                          <ul>
                            {comparison.contrast.map((item) => (
                              <li key={item.label}>
                                <strong>{item.label}</strong>
                                <span>{comparison.left.displayName}: {item.left ?? "n/a"}</span>
                                <span>{comparison.right.displayName}: {item.right ?? "n/a"}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="search-placeholder">No meaningful contrasts surfaced yet.</p>
                        )}
                      </article>
                    </div>
                  </div>
                ) : (
                  <div className="empty-compare-state">
                    <p>Dock a second dossier to light up the compare grid.</p>
                    <div className="dock-actions">
                      {relatedTargets.map((target) => (
                        <button key={target.slug} type="button" onClick={() => dockCompare(target.slug)}>
                          Compare {target.displayName}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </motion.section>

              <motion.section className="stage-panel browse-panel" variants={revealVariant}>
                <div className="panel-head">
                  <p className="eyebrow">Launch Deck</p>
                  <span>{activeSection === "all" ? "featured records" : `${activeSection} deck`}</span>
                </div>
                <div className="browse-grid">
                  {browseRecords.map((record) => (
                    <article className="browse-card" key={record.slug}>
                      <button type="button" onClick={() => focusEntity(record.slug)}>
                        <span>{record.entityType}</span>
                        <strong>{record.displayName}</strong>
                        <p>{record.summary}</p>
                      </button>
                      <div className="browse-card-actions">
                        <button type="button" onClick={() => dockCompare(record.slug)}>
                          Dock compare
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </motion.section>
            </div>
          </div>
        </div>
      </motion.div>
    </main>
  );
}
