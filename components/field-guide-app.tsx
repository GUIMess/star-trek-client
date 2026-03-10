"use client";

import clsx from "clsx";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import { startTransition, useDeferredValue, useEffect, useState } from "react";
import { ArchiveBackdrop } from "./archive-backdrop";
import { CartographyPlate } from "./cartography-plate";
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

type MainScreen = "catalog" | "dossier" | "relations" | "timeline" | "compare" | "sources";
type SidePanel = "readout" | "profile" | "search" | "launch";
type LowerPanel = "timeline" | "compare" | "sources" | "launch";

const modeDeck: Array<{
  id: ArchiveMode;
  code: string;
  label: string;
  summary: string;
  tone: string;
}> = [
  {
    id: "field-guide",
    code: "FG-01",
    label: "Field Guide",
    summary: "General archive lens for species, worlds, ships, factions, and incidents.",
    tone: "lcars-golden-tanoi-bg",
  },
  {
    id: "first-contact",
    code: "FC-02",
    label: "First Contact",
    summary: "Pushes cultural posture, away-team cautions, and contact protocol forward.",
    tone: "lcars-pale-canary-bg",
  },
  {
    id: "diplomatic",
    code: "DP-03",
    label: "Diplomatic",
    summary: "Weights treaty history, negotiation posture, and strategic relationships.",
    tone: "lcars-lilac-bg",
  },
  {
    id: "threat",
    code: "TH-04",
    label: "Threat",
    summary: "Frames the dossier around operational caution, pressure points, and risk.",
    tone: "lcars-periwinkle-bg",
  },
];

const screenDeck: Array<{ id: MainScreen; label: string; code: string; tone: string }> = [
  { id: "catalog", label: "Atlas", code: "A-00", tone: "lcars-orange-peel-bg" },
  { id: "dossier", label: "Dossier", code: "D-01", tone: "lcars-golden-tanoi-bg" },
  { id: "relations", label: "Relations", code: "R-02", tone: "lcars-pale-canary-bg" },
  { id: "timeline", label: "Timeline", code: "T-03", tone: "lcars-lilac-bg" },
  { id: "compare", label: "Compare", code: "C-04", tone: "lcars-blue-bell-bg" },
  { id: "sources", label: "Sources", code: "S-05", tone: "lcars-periwinkle-bg" },
];

const sideDeck: Array<{ id: SidePanel; label: string; tone: string }> = [
  { id: "readout", label: "Readout", tone: "lcars-golden-tanoi-bg" },
  { id: "profile", label: "Profile", tone: "lcars-pale-canary-bg" },
  { id: "search", label: "Search", tone: "lcars-lilac-bg" },
  { id: "launch", label: "Launch", tone: "lcars-periwinkle-bg" },
];

const lowerDeck: Array<{ id: LowerPanel; label: string; tone: string }> = [
  { id: "timeline", label: "Timeline", tone: "lcars-golden-tanoi-bg" },
  { id: "compare", label: "Compare", tone: "lcars-pale-canary-bg" },
  { id: "sources", label: "Sources", tone: "lcars-lilac-bg" },
  { id: "launch", label: "Launch", tone: "lcars-periwinkle-bg" },
];

const sectionToneByType: Record<string, string> = {
  species: "lcars-golden-tanoi-bg",
  person: "lcars-pale-canary-bg",
  ship: "lcars-blue-bell-bg",
  faction: "lcars-lilac-bg",
  world: "lcars-periwinkle-bg",
  event: "lcars-orange-peel-bg",
  collective: "lcars-hopbush-bg",
};

function formatThreat(value: string) {
  if (!value || value === "n/a") return "Context specific";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatConfidence(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatLabel(value: string) {
  return value
    .replace(/([A-Z])/g, " $1")
    .replaceAll("_", " ")
    .trim();
}

function formatType(value: string) {
  return value
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getSectionTone(type: string, fallback = "lcars-blue-bell-bg") {
  return sectionToneByType[type] || fallback;
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
  return primaryFacts.slice(0, 5).map((fact, index) => ({
    id: `${fact.importance}-${index}`,
    height: `${26 + Math.round((fact.importance / 100) * 74)}%`,
  }));
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trimEnd()}...`;
}

const shellVariant: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const panelVariant: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
  },
};

const screenTransition = {
  initial: { opacity: 0.36, clipPath: "inset(0 100% 0 0 round 24px)", filter: "blur(5px)" },
  animate: { opacity: 1, clipPath: "inset(0 0% 0 0 round 24px)", filter: "blur(0px)" },
  exit: { opacity: 0.18, clipPath: "inset(0 0 0 100% round 24px)", filter: "blur(5px)" },
  transition: { duration: 0.26, ease: [0.32, 0, 0.2, 1] as [number, number, number, number] },
};

export function FieldGuideApp() {
  const reducedMotion = useReducedMotion();
  const [mode, setMode] = useState<ArchiveMode>("field-guide");
  const [mainScreen, setMainScreen] = useState<MainScreen>("catalog");
  const [sidePanel, setSidePanel] = useState<SidePanel>("readout");
  const [lowerPanel, setLowerPanel] = useState<LowerPanel>("timeline");
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
  const sectionRecords = (
    activeSection === "all"
      ? featuredRecords
      : listEntitiesByType(activeSection)
          .map((entity) => getHydratedEntity(entity.slug))
          .filter((entity): entity is NonNullable<typeof entity> => entity !== null)
  ).slice(0, 6);
  const launchRecords = sectionRecords;
  const activeSectionMeta = activeSection === "all" ? null : archiveSections.find((section) => section.type === activeSection) ?? null;
  const viewportLead = sectionRecords[0] ?? activeRecord;
  const relatedTargets = activeRecord.relationTargets
    .map((relationship) => relationship.target)
    .filter((entity): entity is NonNullable<typeof entity> => entity !== null)
    .slice(0, 6);
  const scanBars = buildScanBars(activeRecord.primaryFacts);
  const activeMode = modeDeck.find((entry) => entry.id === mode) ?? modeDeck[0];
  const activeMainScreen = screenDeck.find((entry) => entry.id === mainScreen) ?? screenDeck[0];
  const activeSide = sideDeck.find((entry) => entry.id === sidePanel) ?? sideDeck[0];
  const activeLower = lowerDeck.find((entry) => entry.id === lowerPanel) ?? lowerDeck[0];
  const viewportTitle = mainScreen === "catalog" ? activeSectionMeta?.label ?? "Featured dossiers" : activeRecord.displayName;
  const viewportEyebrow =
    mainScreen === "catalog"
      ? `${activeSection === "all" ? "Archive" : formatType(activeSection)} / browse`
      : `${formatType(activeRecord.entityType)} / ${activeRecord.era}`;
  const viewportSubline =
    mainScreen === "catalog"
      ? `${sectionRecords.length} records ready in the viewport`
      : `${activeMode.label} lens active`;

  const topMetrics = [
    { label: "Archive", value: archiveStats.entityCount, detail: "indexed records", tone: "lcars-golden-tanoi-bg" },
    { label: "Links", value: archiveStats.relationCount, detail: "cross-references", tone: "lcars-orange-peel-bg" },
    { label: "Visuals", value: archiveStats.mediaCount, detail: "cached media assets", tone: "lcars-lilac-bg" },
    { label: "Sources", value: archiveStats.citationCount, detail: "linked citations", tone: "lcars-periwinkle-bg" },
  ];

  function focusEntity(slug: string, targetScreen: MainScreen = "dossier") {
    startTransition(() => {
      setActiveSlug(slug);
      setMainScreen(targetScreen);
      const entity = getHydratedEntity(slug, mode);
      if (entity) {
        setActiveSection(entity.entityType);
      }
      setSidePanel("readout");
      if (targetScreen === "timeline") {
        setLowerPanel("timeline");
      }
    });
  }

  function dockCompare(slug: string) {
    if (slug === activeSlug) return;

    startTransition(() => {
      setCompareSlug(slug);
      setMainScreen("compare");
      setLowerPanel("compare");
      setSidePanel("launch");
    });
  }

  function changeMode(nextMode: ArchiveMode) {
    startTransition(() => {
      setMode(nextMode);
      setSidePanel("readout");
    });
  }

  function retuneSection(section: string | "all", leadSlug?: string) {
    startTransition(() => {
      setActiveSection(section);
      setMainScreen("catalog");
      setLowerPanel("launch");
      setSidePanel("launch");
      if (leadSlug) {
        setActiveSlug(leadSlug);
      }
    });
  }

  function openMainScreen(screen: MainScreen) {
    startTransition(() => {
      setMainScreen(screen);
      if (screen === "compare") {
        setLowerPanel("compare");
      } else if (screen === "timeline") {
        setLowerPanel("timeline");
      } else if (screen === "sources") {
        setLowerPanel("sources");
      }
    });
  }

  function renderMainScreen() {
    if (mainScreen === "catalog") {
      return (
        <motion.section className="console-screen atlas-screen" key={`${mainScreen}-${activeSection}-${mode}`} {...screenTransition}>
          <div className="screen-panel screen-panel-atlas">
            <div className="screen-heading">
              <div>
                <p className="eyebrow">Archive atlas</p>
                <h2>{activeSectionMeta?.label ?? "Featured dossiers"}</h2>
              </div>
              <div className="screen-actions">
                <button type="button" onClick={() => focusEntity(viewportLead.slug, "dossier")}>
                  Open dossier
                </button>
                <button type="button" onClick={() => focusEntity(viewportLead.slug, "relations")}>
                  Open map
                </button>
              </div>
            </div>
            <div className="atlas-screen-layout">
              <article className="atlas-preview-card">
                <span>{activeSectionMeta ? `${activeSectionMeta.count} indexed records` : "Featured launch deck"}</span>
                <strong>{viewportLead.displayName}</strong>
                <p>{viewportLead.summary}</p>
                <div className="tag-row">
                  {viewportLead.tags.slice(0, 4).map((tag) => (
                    <span className="tag-pill" key={tag}>
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="atlas-preview-actions">
                  <button type="button" onClick={() => focusEntity(viewportLead.slug, "dossier")}>
                    Dossier
                  </button>
                  <button type="button" onClick={() => focusEntity(viewportLead.slug, "relations")}>
                    Map
                  </button>
                  <button type="button" onClick={() => focusEntity(viewportLead.slug, "timeline")}>
                    Timeline
                  </button>
                </div>
              </article>

              <div className="atlas-card-grid">
                {sectionRecords.map((record) => (
                  <article className={clsx("atlas-card", record.slug === activeSlug && "is-active")} key={`${activeSection}-${record.slug}`}>
                    <button type="button" onClick={() => focusEntity(record.slug, "dossier")}>
                      <span>{formatType(record.entityType)}</span>
                      <strong>{record.displayName}</strong>
                      <p>{truncateText(record.summary, 140)}</p>
                    </button>
                    <div className="atlas-card-actions">
                      <button type="button" onClick={() => focusEntity(record.slug, "relations")}>
                        Map
                      </button>
                      <button type="button" onClick={() => dockCompare(record.slug)}>
                        Dock
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </motion.section>
      );
    }

    if (mainScreen === "relations") {
      return (
        <motion.section className="console-screen map-screen" key={`${mainScreen}-${activeRecord.slug}`} {...screenTransition}>
          <div className="screen-panel screen-panel-map">
            <div className="screen-heading">
              <div>
                <p className="eyebrow">Relation map</p>
                <h2>{activeRecord.displayName}</h2>
              </div>
              <div className="screen-actions">
                <button type="button" onClick={() => openMainScreen("timeline")}>
                  Open timeline
                </button>
                <button type="button" onClick={() => setSidePanel("launch")}>
                  Launch deck
                </button>
              </div>
            </div>
            <div className="map-screen-layout">
              <div className="map-stage">
                <RelationOrbit compareSlug={compareSlug} entity={activeRecord} onCompare={dockCompare} onSelect={focusEntity} />
              </div>
              <div className="map-legend">
                {activeRecord.relationTargets.map((relation) => (
                  <article className="map-legend-row" key={`${activeRecord.slug}-${relation.targetSlug}`}>
                    <div>
                      <span>{relation.typeLabel}</span>
                      <strong>{relation.target?.displayName ?? relation.targetSlug}</strong>
                      <p>{relation.description}</p>
                    </div>
                    <div className="legend-actions">
                      {relation.target ? (
                        <>
                          <button type="button" onClick={() => focusEntity(relation.target!.slug, "dossier")}>
                            Open
                          </button>
                          <button type="button" onClick={() => dockCompare(relation.target!.slug)}>
                            Dock
                          </button>
                        </>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </motion.section>
      );
    }

    if (mainScreen === "timeline") {
      return (
        <motion.section className="console-screen timeline-screen" key={`${mainScreen}-${activeRecord.slug}`} {...screenTransition}>
          <div className="screen-panel">
            <div className="screen-heading">
              <div>
                <p className="eyebrow">Era trail</p>
                <h2>{activeRecord.displayName}</h2>
              </div>
              <div className="screen-meta">
                <span>{activeRecord.timelineTrail.length || 1} indexed events</span>
              </div>
            </div>
            <div className="timeline-screen-grid">
              {activeRecord.timelineTrail.length ? (
                activeRecord.timelineTrail.map((event, index) => (
                  <motion.article
                    className="timeline-screen-card"
                    key={`${event.eraLabel}-${event.headline}`}
                    initial={reducedMotion ? false : { opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.28, delay: reducedMotion ? 0 : index * 0.05 }}
                  >
                    <span>{event.eraLabel}</span>
                    <strong>{event.headline}</strong>
                    <p>{event.detail}</p>
                    <small>{event.source?.label ?? "Archive source"}</small>
                  </motion.article>
                ))
              ) : (
                <article className="timeline-screen-card is-empty">
                  <span>Archive gap</span>
                  <strong>No discrete timeline beats loaded.</strong>
                  <p>The record still anchors through relationships, identity facts, and source trail.</p>
                </article>
              )}
            </div>
          </div>
        </motion.section>
      );
    }

    if (mainScreen === "compare") {
      return (
        <motion.section className="console-screen compare-screen" key={`${mainScreen}-${activeRecord.slug}-${compareSlug ?? "empty"}`} {...screenTransition}>
          <div className="screen-panel">
            <div className="screen-heading">
              <div>
                <p className="eyebrow">Compare deck</p>
                <h2>{comparison ? `${comparison.left.displayName} / ${comparison.right.displayName}` : "Awaiting second dossier"}</h2>
              </div>
              <div className="screen-actions">
                <button type="button" onClick={() => setLowerPanel("compare")}>
                  Lower compare
                </button>
                <button type="button" onClick={() => setSidePanel("launch")}>
                  Open launch
                </button>
              </div>
            </div>
            {comparison ? (
              <div className="compare-screen-grid">
                <article className="compare-hero-card">
                  <span>{comparison.left.entityType}</span>
                  <strong>{comparison.left.displayName}</strong>
                  <p>{comparison.left.summary}</p>
                </article>
                <article className="compare-hero-card">
                  <span>{comparison.right.entityType}</span>
                  <strong>{comparison.right.displayName}</strong>
                  <p>{comparison.right.summary}</p>
                </article>
                <article className="compare-detail-card">
                  <p className="eyebrow">Shared</p>
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
                    <p className="screen-placeholder">No shared high-weight facts in the current compare window.</p>
                  )}
                </article>
                <article className="compare-detail-card">
                  <p className="eyebrow">Contrast</p>
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
                    <p className="screen-placeholder">No contrast surfaced in the current compare window.</p>
                  )}
                </article>
              </div>
            ) : (
              <div className="screen-empty-state">
                <p>Dock a second dossier from the relation map, launch deck, or archive jump panel.</p>
                <div className="screen-actions">
                  {relatedTargets.slice(0, 3).map((target) => (
                    <button key={target.slug} type="button" onClick={() => dockCompare(target.slug)}>
                      Dock {target.displayName}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.section>
      );
    }

    if (mainScreen === "sources") {
      return (
        <motion.section className="console-screen sources-screen" key={`${mainScreen}-${activeRecord.slug}`} {...screenTransition}>
          <div className="screen-panel">
            <div className="screen-heading">
              <div>
                <p className="eyebrow">Source trail</p>
                <h2>{activeRecord.displayName}</h2>
              </div>
              <div className="screen-meta">
                <span>{activeRecord.citations.length} linked citations</span>
              </div>
            </div>
            <div className="sources-screen-grid sources-screen-grid-rich">
              <article className="source-screen-card media-screen-card">
                <div className="source-screen-head">
                  <strong>Visual archive</strong>
                  <span>{activeRecord.media.length ? `${activeRecord.media.length} cached assets` : "signal plate"}</span>
                </div>
                {activeRecord.primaryMedia ? (
                  <div className="media-stage">
                    <img alt={activeRecord.primaryMedia.alt} src={activeRecord.primaryMedia.src} />
                    <div className="media-caption">
                      <strong>{activeRecord.primaryMedia.title}</strong>
                      <p>{activeRecord.primaryMedia.caption}</p>
                    </div>
                    {activeRecord.galleryMedia.length ? (
                      <div className="media-thumb-row">
                        {activeRecord.galleryMedia.map((asset) => (
                          <figure className="media-thumb" key={asset.id}>
                            <img alt={asset.alt} src={asset.src} />
                          </figure>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="media-stage media-stage-empty">
                    <p className="screen-placeholder">No external image cached for this record. Cartography and citations stay live.</p>
                  </div>
                )}
              </article>

              <CartographyPlate entity={activeRecord} />

              <article className="source-screen-card citation-screen-card">
                <div className="source-screen-head">
                  <strong>Citation trail</strong>
                  <span>Linked references</span>
                </div>
                <div className="citation-list">
                  {activeRecord.citations.map((citation) => (
                    <article className="citation-card" key={`${activeRecord.slug}-${citation.label}`}>
                      <div>
                        <span>{citation.source?.label ?? "Archive source"}</span>
                        <strong>{citation.label}</strong>
                        <p>{citation.note}</p>
                      </div>
                      <a href={citation.url} rel="noreferrer" target="_blank">
                        Open source
                      </a>
                    </article>
                  ))}
                </div>
              </article>

              {activeRecord.sourceTrail.map((source) => (
                <article className="source-screen-card" key={source.key}>
                  <div className="source-screen-head">
                    <strong>{source.label}</strong>
                    <span>{source.sourceType}</span>
                  </div>
                  <div className="source-bar-track">
                    <span className="source-bar-fill" style={{ width: `${Math.round(source.canonWeight * 100)}%` }} />
                  </div>
                  <p>{Math.round(source.canonWeight * 100)}% trust weighting</p>
                </article>
              ))}
              <article className="source-screen-card source-index-card">
                <p className="eyebrow">Archive index</p>
                <div className="source-legend">
                  {sourceRecords.map((source) => (
                    <span key={source.key}>{source.label}</span>
                  ))}
                </div>
              </article>
            </div>
          </div>
        </motion.section>
      );
    }

    return (
      <motion.section className="console-screen dossier-screen" key={`${mainScreen}-${activeRecord.slug}-${mode}`} {...screenTransition}>
        <div className="screen-panel">
          <div className="screen-heading">
            <div>
              <p className="eyebrow">Loaded dossier</p>
              <h2>{activeRecord.displayName}</h2>
            </div>
            <div className="screen-meta">
              <span>{formatType(activeRecord.entityType)}</span>
              <span>{activeRecord.era}</span>
            </div>
          </div>
          <div className="dossier-screen-layout">
            <div className="dossier-screen-copy">
              <div className="dossier-line">
                <span className="lcars-badge">{activeMode.label}</span>
                <span className="lcars-badge lcars-badge-soft">{activeRecord.canonTier} canon</span>
                {activeRecord.descriptor ? <span className="lcars-badge lcars-badge-soft">{activeRecord.descriptor}</span> : null}
              </div>
              <p className="dossier-summary">{activeRecord.summary}</p>
              {activeRecord.bioSections[0] ? <p className="dossier-bio-snippet">{truncateText(activeRecord.bioSections[0].body, 280)}</p> : null}
              <div className="tag-row">
                {activeRecord.tags.map((tag) => (
                  <span className="tag-pill" key={tag}>
                    {tag}
                  </span>
                ))}
              </div>
              <div className="dossier-actions">
                <button type="button" onClick={() => openMainScreen("relations")}>
                  Open map
                </button>
                <button type="button" onClick={() => openMainScreen("timeline")}>
                  Open timeline
                </button>
                <button type="button" onClick={() => dockCompare(activeRecord.slug === "vulcan-species" ? "romulan-species" : "vulcan-species")}>
                  Dock alternate
                </button>
              </div>
            </div>

            <div className="dossier-screen-sidecar">
              <article className="dossier-media-card">
                {activeRecord.primaryMedia ? (
                  <>
                    <div className="dossier-media-frame">
                      <img alt={activeRecord.primaryMedia.alt} src={activeRecord.primaryMedia.src} />
                    </div>
                    <div className="dossier-media-copy">
                      <span>{activeRecord.primaryMedia.title}</span>
                      <strong>{activeRecord.displayName}</strong>
                      <p>{activeRecord.bioSections[1]?.body ?? activeRecord.primaryMedia.caption}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="dossier-media-frame dossier-media-frame-empty" aria-hidden="true" />
                    <div className="dossier-media-copy">
                      <span>Archive plate</span>
                      <strong>{activeRecord.displayName}</strong>
                      <p>{activeRecord.cartography?.sector ?? "No portrait cached; use the cartography and source screens for deeper context."}</p>
                    </div>
                  </>
                )}
              </article>
              <div className="console-metric-grid">
                <article className="console-metric-card">
                  <span>Threat index</span>
                  <strong>{formatThreat(activeRecord.threatLevel)}</strong>
                </article>
                <article className="console-metric-card">
                  <span>Confidence</span>
                  <strong>{formatConfidence(activeRecord.confidenceScore)}</strong>
                </article>
                <article className="console-metric-card">
                  <span>Linked records</span>
                  <strong>{activeRecord.relationTargets.length}</strong>
                </article>
                <article className="console-metric-card">
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
          <div className="facts-ribbon">
            {activeRecord.primaryFacts.slice(0, 3).map((fact) => (
              <article className="fact-ribbon-card" key={fact.label}>
                <span>{fact.label}</span>
                <strong>{truncateText(fact.value, 82)}</strong>
              </article>
            ))}
          </div>
        </div>
      </motion.section>
    );
  }

  function renderSidePanel() {
    if (sidePanel === "profile") {
      return (
        <motion.div className="side-panel-body" key={sidePanel} {...screenTransition}>
          <div className="stack-list">
            {activeRecord.primaryMedia ? (
              <article className="side-row-card side-media-card">
                <div className="side-media-frame">
                  <img alt={activeRecord.primaryMedia.alt} src={activeRecord.primaryMedia.src} />
                </div>
                <div className="side-media-copy">
                  <span>{activeRecord.primaryMedia.title}</span>
                  <strong>{activeRecord.displayName}</strong>
                  <p>{activeRecord.primaryMedia.caption}</p>
                </div>
              </article>
            ) : null}
            {activeRecord.bioSections.map((section) => (
              <article className="side-row-card" key={section.heading}>
                <span>{section.heading}</span>
                <p>{section.body}</p>
              </article>
            ))}
            {Object.entries(activeRecord.profile).map(([label, value]) => (
              <article className="side-row-card" key={label}>
                <span>{formatLabel(label)}</span>
                <strong>{value}</strong>
              </article>
            ))}
            {activeRecord.cartography ? (
              <article className="side-row-card">
                <span>Cartography</span>
                <strong>{activeRecord.cartography.quadrant}</strong>
                <p>
                  {activeRecord.cartography.sector} / {activeRecord.cartography.gridLabel}
                </p>
              </article>
            ) : null}
            <article className="side-row-card">
              <span>Diplomatic posture</span>
              <strong>{activeRecord.diplomaticPosture}</strong>
            </article>
            <article className="side-row-card">
              <span>Tags</span>
              <div className="tag-row">
                {activeRecord.tags.map((tag) => (
                  <span className="tag-pill" key={tag}>
                    {tag}
                  </span>
                ))}
              </div>
            </article>
          </div>
        </motion.div>
      );
    }

    if (sidePanel === "search") {
      return (
        <motion.div className="side-panel-body" key={sidePanel} {...screenTransition}>
          <label className="search-shell">
            <span>Archive jump</span>
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
                  <button type="button" onClick={() => focusEntity(result.slug, "dossier")}>
                    <strong>{result.displayName}</strong>
                    <span>
                      {result.entityType} / {result.canonTier}
                    </span>
                    <p>{result.summary}</p>
                  </button>
                  <div className="search-result-actions">
                    <button type="button" onClick={() => dockCompare(result.slug)}>
                      Dock
                    </button>
                    <button type="button" onClick={() => focusEntity(result.slug, "relations")}>
                      Map
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <p className="screen-placeholder">
                {query ? "No direct match in the current archive snapshot." : "Use archive jump for direct handoff."}
              </p>
            )}
          </div>
        </motion.div>
      );
    }

    if (sidePanel === "launch") {
      return (
        <motion.div className="side-panel-body" key={sidePanel} {...screenTransition}>
          <div className="launch-list">
            {launchRecords.map((record) => (
              <article className="launch-side-card" key={record.slug}>
                <button type="button" onClick={() => focusEntity(record.slug, "dossier")}>
                  <span>{record.entityType}</span>
                  <strong>{record.displayName}</strong>
                  <p>{record.summary}</p>
                </button>
                <div className="launch-side-actions">
                  <button type="button" onClick={() => dockCompare(record.slug)}>
                    Dock
                  </button>
                  <button type="button" onClick={() => focusEntity(record.slug, "relations")}>
                    Map
                  </button>
                </div>
              </article>
            ))}
          </div>
        </motion.div>
      );
    }

    return (
      <motion.div className="side-panel-body" key={sidePanel} {...screenTransition}>
        <article className="side-readout-card">
          <p className="eyebrow">Mode readout</p>
          <strong>{activeMode.label}</strong>
          <p>{activeMode.summary}</p>
        </article>
        <article className="side-readout-card">
          <p className="eyebrow">Operational notes</p>
          <ul className="readout-list">
            {activeRecord.readout.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </article>
        <article className="side-readout-card">
          <p className="eyebrow">Quick actions</p>
          <div className="stack-buttons">
            <button type="button" onClick={() => openMainScreen("catalog")}>
              Archive atlas
            </button>
            <button type="button" onClick={() => openMainScreen("relations")}>
              Relation map
            </button>
            <button type="button" onClick={() => openMainScreen("timeline")}>
              Era trail
            </button>
            <button type="button" onClick={() => setSidePanel("search")}>
              Archive jump
            </button>
          </div>
        </article>
        <article className="side-readout-card">
          <p className="eyebrow">Lens controls</p>
          <div className="stack-buttons">
            {modeDeck.map((entry) => (
              <button key={entry.id} type="button" onClick={() => changeMode(entry.id)}>
                {entry.label}
              </button>
            ))}
          </div>
        </article>
      </motion.div>
    );
  }

  function renderLowerPanel() {
    if (lowerPanel === "compare") {
      return (
        <motion.div className="lower-panel-body" key={lowerPanel} {...screenTransition}>
          {comparison ? (
            <div className="lower-compare-grid">
              {comparison.contrast.slice(0, 4).map((item) => (
                <article className="lower-card" key={item.label}>
                  <span>{item.label}</span>
                  <strong>{comparison.left.displayName}</strong>
                  <p>{item.left ?? "n/a"}</p>
                  <strong>{comparison.right.displayName}</strong>
                  <p>{item.right ?? "n/a"}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="screen-placeholder">Dock another dossier to activate the lower compare strip.</p>
          )}
        </motion.div>
      );
    }

    if (lowerPanel === "sources") {
      return (
        <motion.div className="lower-panel-body" key={lowerPanel} {...screenTransition}>
          <div className="lower-source-grid">
            {activeRecord.citations.length ? (
              activeRecord.citations.map((citation) => (
                <article className="lower-card citation-lower-card" key={`${citation.label}-${citation.url}`}>
                  <span>{citation.source?.label ?? "Archive source"}</span>
                  <strong>{citation.label}</strong>
                  <p>{citation.note}</p>
                  <a href={citation.url} rel="noreferrer" target="_blank">
                    Open source
                  </a>
                </article>
              ))
            ) : (
              <article className="lower-card">
                <span>Source trail</span>
                <strong>No linked citations cached.</strong>
                <p>Use the main source screen to inspect canon weighting and archive provenance.</p>
              </article>
            )}
          </div>
        </motion.div>
      );
    }

    if (lowerPanel === "launch") {
      return (
        <motion.div className="lower-panel-body" key={lowerPanel} {...screenTransition}>
          <div className="lower-launch-grid">
            {launchRecords.map((record) => (
              <article className="lower-card lower-launch-card" key={record.slug}>
                <button type="button" onClick={() => focusEntity(record.slug, "dossier")}>
                  <span>{record.entityType}</span>
                  <strong>{record.displayName}</strong>
                </button>
                <div className="launch-side-actions">
                  <button type="button" onClick={() => dockCompare(record.slug)}>
                    Dock
                  </button>
                  <button type="button" onClick={() => focusEntity(record.slug, "timeline")}>
                    Trail
                  </button>
                </div>
              </article>
            ))}
          </div>
        </motion.div>
      );
    }

    return (
      <motion.div className="lower-panel-body" key={lowerPanel} {...screenTransition}>
        <div className="lower-timeline-grid">
          {activeRecord.timelineTrail.length ? (
            activeRecord.timelineTrail.map((event) => (
              <article className="lower-card" key={`${event.eraLabel}-${event.headline}`}>
                <span>{event.eraLabel}</span>
                <strong>{event.headline}</strong>
                <p>{event.detail}</p>
              </article>
            ))
          ) : (
            <article className="lower-card">
              <span>Archive gap</span>
              <strong>No indexed timeline beats.</strong>
              <p>Switch to relations or sources to keep navigating this dossier.</p>
            </article>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <main className="archive-root">
      <ArchiveBackdrop />
      <motion.div className="field-guide-shell" initial="hidden" animate="show" variants={shellVariant}>
        <motion.header className="field-guide-header" variants={panelVariant}>
          <div className="lcars-row field-guide-header-band">
            <div className="lcars-elbow left-bottom lcars-golden-tanoi-bg" />
            <div className="lcars-bar horizontal lcars-golden-tanoi-bg field-guide-header-bar">
              <div className="lcars-title right">Trek Field Guide</div>
            </div>
            <div className="lcars-bar horizontal right-end decorated lcars-hopbush-bg" />
          </div>

          <div className="field-guide-header-grid">
            <div className="field-guide-id-box">
              <p className="eyebrow">LCARS access node</p>
              <h1>Species / worlds / ships / factions / treaty records / cartography</h1>
            </div>

            <div className="field-guide-status-grid">
              <div className="lcars-element right-rounded lcars-golden-tanoi-bg field-guide-status-pill">
                <div className="field-guide-status-copy">
                  <span>Archive link</span>
                  <strong>Stable</strong>
                </div>
              </div>
              <div className="lcars-element right-rounded lcars-pale-canary-bg field-guide-status-pill">
                <div className="field-guide-status-copy">
                  <span>Stardate</span>
                  <strong>{stardate}</strong>
                </div>
              </div>
              <div className={`lcars-element right-rounded ${activeMode.tone} field-guide-status-pill`}>
                <div className="field-guide-status-copy">
                  <span>Mode</span>
                  <strong>{activeMode.label}</strong>
                </div>
              </div>
              <div className={`lcars-element right-rounded ${activeMainScreen.tone} field-guide-status-pill`}>
                <div className="field-guide-status-copy">
                  <span>Viewport</span>
                  <strong>{viewportTitle}</strong>
                </div>
              </div>
              {topMetrics.map((metric) => (
                <div className={clsx("lcars-element right-rounded field-guide-status-pill", metric.tone)} key={metric.label}>
                  <div className="field-guide-status-copy">
                    <span>{metric.label}</span>
                    <strong>{metric.detail}</strong>
                  </div>
                  <div className="lcars-element-addition">{metric.value}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.header>

        <motion.div className="field-guide-body" variants={panelVariant}>
          <aside className="field-guide-sidebar">
            <section className="field-guide-block">
              <div className="lcars-row field-guide-section-head">
                <div className="lcars-bar horizontal lcars-golden-tanoi-bg">
                  <div className="lcars-title">Archive index</div>
                </div>
                <div
                  className={clsx(
                    "lcars-element right-rounded field-guide-head-chip",
                    activeSection === "all" ? "lcars-husk-bg" : getSectionTone(activeSection)
                  )}
                >
                  <span>{activeSection === "all" ? "all" : activeSection}</span>
                </div>
              </div>
              <div className="field-guide-block-body">
                <button
                  className={clsx(
                    "lcars-element button left-rounded field-guide-shell-button",
                    "lcars-husk-bg",
                    activeSection === "all" && "is-active"
                  )}
                  type="button"
                  onClick={() => retuneSection("all", featuredRecords[0]?.slug)}
                >
                  <div className="field-guide-shell-button-code">ALL</div>
                  <div className="field-guide-shell-button-copy">
                    <strong>Featured</strong>
                    <span>Launch records</span>
                  </div>
                </button>
                {archiveSections.map((entry) => (
                  <button
                    className={clsx(
                      "lcars-element button left-rounded field-guide-shell-button",
                      getSectionTone(entry.type),
                      activeSection === entry.type && "is-active"
                    )}
                    key={entry.type}
                    type="button"
                    onClick={() => retuneSection(entry.type, entry.leadSlug)}
                  >
                    <div className="field-guide-shell-button-code">{entry.type.slice(0, 3).toUpperCase()}</div>
                    <div className="field-guide-shell-button-copy">
                      <strong>{entry.label}</strong>
                      <span>{entry.count} records</span>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="field-guide-block">
              <div className="lcars-row field-guide-section-head">
                <div className="lcars-bar horizontal lcars-blue-bell-bg">
                  <div className="lcars-title">Viewport deck</div>
                </div>
                <div className="lcars-element right-rounded lcars-blue-bell-bg field-guide-head-chip">
                  <span>{sectionRecords.length} records</span>
                </div>
              </div>
              <div className="field-guide-block-body">
                {sectionRecords.map((section) => (
                  <button
                    className={clsx(
                      "lcars-element button left-rounded field-guide-shell-button",
                      getSectionTone(section.entityType),
                      activeSlug === section.slug && "is-active"
                    )}
                    key={section.slug}
                    type="button"
                    onClick={() => focusEntity(section.slug, "dossier")}
                  >
                    <div className="field-guide-shell-button-code">{section.entityType.slice(0, 3).toUpperCase()}</div>
                    <div className="field-guide-shell-button-copy">
                      <strong>{section.displayName}</strong>
                      <span>{truncateText(section.summary, 72)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </aside>

          <section className="field-guide-main">
            <section className="field-guide-main-frame">
              <div className="lcars-row field-guide-section-head">
                <div className="lcars-bar horizontal lcars-pale-canary-bg">
                  <div className="lcars-title">Active screen</div>
                </div>
                <div className={clsx("lcars-element right-rounded field-guide-head-chip", activeMainScreen.tone)}>
                  <span>{activeMainScreen.code}</span>
                </div>
              </div>

              <div className="field-guide-screen-head">
                <div className="field-guide-active-box">
                  <p className="eyebrow">{viewportEyebrow}</p>
                  <h2>{viewportTitle}</h2>
                  <p>{viewportSubline}</p>
                </div>

                <div className="field-guide-tab-strip">
                  {screenDeck.map((entry) => (
                    <button
                      className={clsx(
                        "lcars-element button rounded field-guide-tab-button",
                        entry.tone,
                        mainScreen === entry.id && "is-active"
                      )}
                      key={entry.id}
                      type="button"
                      onClick={() => openMainScreen(entry.id)}
                    >
                      <div className="field-guide-shell-button-code">{entry.code}</div>
                      <div className="field-guide-shell-button-copy">
                        <strong>{entry.label}</strong>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="field-guide-screen-body">
                <AnimatePresence mode="wait" initial={false}>
                  {renderMainScreen()}
                </AnimatePresence>
              </div>
            </section>

            <section className="field-guide-lower-frame">
              <div className="lcars-row field-guide-section-head">
                <div className="lcars-bar horizontal lcars-lilac-bg">
                  <div className="lcars-title">Lower strip</div>
                </div>
                <div className={clsx("lcars-element right-rounded field-guide-head-chip", activeLower.tone)}>
                  <span>{activeLower.label}</span>
                </div>
              </div>

              <div className="field-guide-tab-strip field-guide-tab-strip-compact">
                {lowerDeck.map((entry) => (
                  <button
                    className={clsx(
                      "lcars-element button rounded field-guide-tab-button field-guide-lower-button",
                      entry.tone,
                      lowerPanel === entry.id && "is-active"
                    )}
                    key={entry.id}
                    type="button"
                    onClick={() => setLowerPanel(entry.id)}
                  >
                    <div className="field-guide-shell-button-copy">
                      <strong>{entry.label}</strong>
                    </div>
                  </button>
                ))}
              </div>

              <div className="field-guide-lower-body">
                <AnimatePresence mode="wait" initial={false}>
                  {renderLowerPanel()}
                </AnimatePresence>
              </div>
            </section>
          </section>

          <aside className="field-guide-aux">
            <section className="field-guide-block field-guide-aux-frame">
              <div className="lcars-row field-guide-section-head">
                <div className="lcars-bar horizontal lcars-periwinkle-bg">
                  <div className="lcars-title">Auxiliary</div>
                </div>
                <div className={clsx("lcars-element right-rounded field-guide-head-chip", activeSide.tone)}>
                  <span>{activeSide.label}</span>
                </div>
              </div>

              <div className="field-guide-tab-strip field-guide-aux-strip">
                {sideDeck.map((entry) => (
                  <button
                    className={clsx(
                      "lcars-element button rounded field-guide-tab-button field-guide-aux-button",
                      entry.tone,
                      sidePanel === entry.id && "is-active"
                    )}
                    key={entry.id}
                    type="button"
                    onClick={() => setSidePanel(entry.id)}
                  >
                    <div className="field-guide-shell-button-copy">
                      <strong>{entry.label}</strong>
                    </div>
                  </button>
                ))}
              </div>

              <div className="field-guide-aux-body">
                <AnimatePresence mode="wait" initial={false}>
                  {renderSidePanel()}
                </AnimatePresence>
              </div>
            </section>
          </aside>
        </motion.div>
      </motion.div>
    </main>
  );
}
