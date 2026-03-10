"use client";

import clsx from "clsx";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import { startTransition, useDeferredValue, useEffect, useState, type CSSProperties } from "react";
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

type MainScreen = "dossier" | "relations" | "timeline" | "compare" | "sources";
type SidePanel = "readout" | "profile" | "search" | "launch";
type LowerPanel = "timeline" | "compare" | "sources" | "launch";

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
    summary: "General archive lens for species, worlds, ships, factions, and incidents.",
  },
  {
    id: "first-contact",
    code: "FC-02",
    label: "First Contact",
    summary: "Pushes cultural posture, away-team cautions, and contact protocol forward.",
  },
  {
    id: "diplomatic",
    code: "DP-03",
    label: "Diplomatic",
    summary: "Weights treaty history, negotiation posture, and strategic relationships.",
  },
  {
    id: "threat",
    code: "TH-04",
    label: "Threat",
    summary: "Frames the dossier around operational caution, pressure points, and risk.",
  },
];

const screenDeck: Array<{ id: MainScreen; label: string; code: string }> = [
  { id: "dossier", label: "Dossier", code: "D-01" },
  { id: "relations", label: "Relations", code: "R-02" },
  { id: "timeline", label: "Timeline", code: "T-03" },
  { id: "compare", label: "Compare", code: "C-04" },
  { id: "sources", label: "Sources", code: "S-05" },
];

const sideDeck: Array<{ id: SidePanel; label: string }> = [
  { id: "readout", label: "Readout" },
  { id: "profile", label: "Profile" },
  { id: "search", label: "Jump" },
  { id: "launch", label: "Launch" },
];

const lowerDeck: Array<{ id: LowerPanel; label: string }> = [
  { id: "timeline", label: "Timeline" },
  { id: "compare", label: "Compare" },
  { id: "sources", label: "Sources" },
  { id: "launch", label: "Launch" },
];

const DESKTOP_STAGE_WIDTH = 1480;
const DESKTOP_STAGE_HEIGHT = 900;
const DESKTOP_STAGE_BREAKPOINT = 1360;

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
  const [mainScreen, setMainScreen] = useState<MainScreen>("dossier");
  const [sidePanel, setSidePanel] = useState<SidePanel>("readout");
  const [lowerPanel, setLowerPanel] = useState<LowerPanel>("timeline");
  const [activeSection, setActiveSection] = useState<string | "all">("all");
  const [activeSlug, setActiveSlug] = useState(defaultPrimarySlug);
  const [compareSlug, setCompareSlug] = useState<string | null>(defaultCompareSlug);
  const [query, setQuery] = useState("");
  const [stardate, setStardate] = useState(buildStardate());
  const [desktopStage, setDesktopStage] = useState({
    enabled: false,
    scale: 1,
    width: 0,
    height: 0,
  });
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    const update = () => setStardate(buildStardate());
    update();
    const interval = window.setInterval(update, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const updateDesktopStage = () => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const enableFit = viewportWidth > DESKTOP_STAGE_BREAKPOINT;

      if (!enableFit) {
        setDesktopStage((current) => (
          current.enabled
            ? { enabled: false, scale: 1, width: 0, height: 0 }
            : current
        ));
        return;
      }

      const gutterX = Math.max(10, Math.round(viewportWidth * 0.012));
      const gutterY = Math.max(10, Math.round(viewportHeight * 0.012));
      const availableWidth = Math.max(viewportWidth - gutterX * 2, 320);
      const availableHeight = Math.max(viewportHeight - gutterY * 2, 320);
      const scale = Math.min(
        availableWidth / DESKTOP_STAGE_WIDTH,
        availableHeight / DESKTOP_STAGE_HEIGHT,
        1
      );
      const next = {
        enabled: true,
        scale: Number(scale.toFixed(4)),
        width: Math.round(DESKTOP_STAGE_WIDTH * scale),
        height: Math.round(DESKTOP_STAGE_HEIGHT * scale),
      };

      setDesktopStage((current) => (
        current.enabled === next.enabled &&
        current.scale === next.scale &&
        current.width === next.width &&
        current.height === next.height
          ? current
          : next
      ));
    };

    updateDesktopStage();
    window.addEventListener("resize", updateDesktopStage);
    return () => window.removeEventListener("resize", updateDesktopStage);
  }, []);

  const activeRecord = getHydratedEntity(activeSlug, mode) ?? featuredRecords[0];
  const compareRecord = compareSlug ? getHydratedEntity(compareSlug, mode) : null;
  const comparison = compareSlug ? buildComparison(activeSlug, compareSlug) : null;
  const searchResults = deferredQuery.trim() ? searchArchive(deferredQuery) : [];
  const launchRecords = (
    activeSection === "all"
      ? featuredRecords
      : listEntitiesByType(activeSection)
          .map((entity) => getHydratedEntity(entity.slug))
          .filter((entity): entity is NonNullable<typeof entity> => entity !== null)
  ).slice(0, 6);
  const relatedTargets = activeRecord.relationTargets
    .map((relationship) => relationship.target)
    .filter((entity): entity is NonNullable<typeof entity> => entity !== null)
    .slice(0, 6);
  const scanBars = buildScanBars(activeRecord.primaryFacts);
  const activeMode = modeDeck.find((entry) => entry.id === mode) ?? modeDeck[0];
  const activeMainScreen = screenDeck.find((entry) => entry.id === mainScreen) ?? screenDeck[0];
  const desktopStageStyle = desktopStage.enabled ? ({
    "--archive-fit-scale": String(desktopStage.scale),
    "--archive-fit-width": `${desktopStage.width}px`,
    "--archive-fit-height": `${desktopStage.height}px`,
  } as CSSProperties) : undefined;

  const topMetrics = [
    { label: "Archive", value: archiveStats.entityCount, detail: "indexed records" },
    { label: "Links", value: archiveStats.relationCount, detail: "cross-references" },
    { label: "Visuals", value: archiveStats.mediaCount, detail: "cached media assets" },
    { label: "Sources", value: archiveStats.citationCount, detail: "linked citations" },
  ];

  function focusEntity(slug: string, targetScreen: MainScreen = "dossier") {
    startTransition(() => {
      setActiveSlug(slug);
      setMainScreen(targetScreen);
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
      setLowerPanel("launch");
      setSidePanel("launch");
      if (leadSlug) {
        setActiveSlug(leadSlug);
        setMainScreen("dossier");
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
    <main className={clsx("archive-root", desktopStage.enabled && "is-fitted")} style={desktopStageStyle}>
      <ArchiveBackdrop />
      <div className={clsx("archive-stage", desktopStage.enabled && "is-fitted")}>
        <motion.div className="archive-shell" initial="hidden" animate="show" variants={shellVariant}>
          <motion.header className="console-header panel-chrome" variants={panelVariant}>
            <div className="console-id">
              <div className="console-title-block">
                <p className="eyebrow">LCARS access node</p>
                <h1>Trek Field Guide</h1>
              </div>
              <p className="console-subline">
                Species / worlds / ships / factions / treaty records / cartography
              </p>
            </div>
            <div className="console-statusband">
              <span className="lcars-chip lcars-chip-primary">archive link stable</span>
              <span className="lcars-chip">stardate {stardate}</span>
              <span className="lcars-chip">{activeRecord.displayName}</span>
              <span className="lcars-chip">{activeMainScreen.label}</span>
            </div>
            <div className="console-topmetrics">
              {topMetrics.map((metric) => (
                <article className="topmetric-card" key={metric.label}>
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                  <small>{metric.detail}</small>
                </article>
              ))}
            </div>
          </motion.header>

          <motion.div className="lcars-workstation" variants={panelVariant}>
            <aside className="lcars-rail panel-chrome">
              <div className="rail-group">
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
                      onClick={() => changeMode(entry.id)}
                    >
                      <span>{entry.code}</span>
                      <strong>{entry.label}</strong>
                      <small>{entry.summary}</small>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rail-group">
                <div className="panel-head">
                  <p className="eyebrow">Archive strata</p>
                  <span>{activeSection === "all" ? "featured" : activeSection}</span>
                </div>
                <div className="section-grid">
                  <button
                    className={clsx("section-card", activeSection === "all" && "is-active")}
                    type="button"
                    onClick={() => retuneSection("all", featuredRecords[0]?.slug)}
                  >
                    <strong>Featured</strong>
                    <span>Launch records</span>
                  </button>
                  {archiveSections.map((section) => (
                    <button
                      className={clsx("section-card", activeSection === section.type && "is-active")}
                      key={section.type}
                      type="button"
                      onClick={() => retuneSection(section.type, section.leadSlug)}
                    >
                      <strong>{section.label}</strong>
                      <span>{section.count} records</span>
                    </button>
                  ))}
                </div>
              </div>
            </aside>

            <section className="lcars-core panel-chrome">
              <div className="console-pane-header">
                <div>
                  <p className="eyebrow">Active screen</p>
                  <div className="active-stamp">
                    <strong>{activeRecord.displayName}</strong>
                    <span>
                      {formatType(activeRecord.entityType)} / {activeRecord.era}
                    </span>
                  </div>
                </div>
                <div className="screen-tabbar">
                  {screenDeck.map((entry) => (
                    <button
                      className={clsx("tab-button", mainScreen === entry.id && "is-active")}
                      key={entry.id}
                      type="button"
                      onClick={() => openMainScreen(entry.id)}
                    >
                      <span>{entry.code}</span>
                      <strong>{entry.label}</strong>
                    </button>
                  ))}
                </div>
              </div>

              <div className="console-pane-body">
                <AnimatePresence mode="wait" initial={false}>
                  {renderMainScreen()}
                </AnimatePresence>
              </div>
            </section>

            <aside className="lcars-aux panel-chrome">
              <div className="panel-head">
                <p className="eyebrow">Auxiliary</p>
                <span>{sidePanel}</span>
              </div>
              <div className="aux-tabbar">
                {sideDeck.map((entry) => (
                  <button
                    className={clsx("aux-button", sidePanel === entry.id && "is-active")}
                    key={entry.id}
                    type="button"
                    onClick={() => setSidePanel(entry.id)}
                  >
                    {entry.label}
                  </button>
                ))}
              </div>
              <div className="aux-panel-scroll">
                <AnimatePresence mode="wait" initial={false}>
                  {renderSidePanel()}
                </AnimatePresence>
              </div>
            </aside>

            <section className="lcars-lower panel-chrome">
              <div className="lower-header">
                <div className="panel-head panel-head-tight">
                  <p className="eyebrow">Lower strip</p>
                  <span>{lowerPanel}</span>
                </div>
                <div className="lower-tabbar">
                  {lowerDeck.map((entry) => (
                    <button
                      className={clsx("lower-button", lowerPanel === entry.id && "is-active")}
                      key={entry.id}
                      type="button"
                      onClick={() => setLowerPanel(entry.id)}
                    >
                      {entry.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="lower-panel-scroll">
                <AnimatePresence mode="wait" initial={false}>
                  {renderLowerPanel()}
                </AnimatePresence>
              </div>
            </section>
          </motion.div>
        </motion.div>
      </div>
    </main>
  );
}
