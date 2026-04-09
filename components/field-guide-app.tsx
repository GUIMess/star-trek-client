"use client";

import clsx from "clsx";
import { startTransition, useDeferredValue, useEffect, useState } from "react";
import {
  archiveSections,
  archiveStats,
  defaultPrimarySlug,
  featuredRecords,
  getHydratedEntity,
  listEntitiesByType,
  searchArchive,
  type ArchiveMode,
  type HydratedEntity,
} from "../lib/field-guide";

type Screen = "briefing" | "records" | "timeline" | "sources";

const screenDeck: Array<{
  id: Screen;
  code: string;
  label: string;
  tone: string;
}> = [
  { id: "briefing", code: "home", label: "Briefing", tone: "lcars-classic-tone-bluey" },
  { id: "records", code: "menu", label: "Records", tone: "lcars-classic-tone-orange" },
  { id: "timeline", code: "news", label: "Timeline", tone: "lcars-classic-tone-gold" },
  { id: "sources", code: "comms", label: "Sources", tone: "lcars-classic-tone-red" },
];

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
    summary: "Archive-first lens for species, worlds, factions, ships, and incidents.",
    tone: "lcars-classic-tone-violet",
  },
  {
    id: "first-contact",
    code: "FC-02",
    label: "First Contact",
    summary: "Pushes protocol, caution, and cultural baseline to the front of the record.",
    tone: "lcars-classic-tone-bluey",
  },
  {
    id: "diplomatic",
    code: "DP-03",
    label: "Diplomatic",
    summary: "Weights the record around alliances, posture, and treaty context.",
    tone: "lcars-classic-tone-almond",
  },
  {
    id: "threat",
    code: "TH-04",
    label: "Threat",
    summary: "Frames the record around pressure points, escalation, and operational risk.",
    tone: "lcars-classic-tone-red",
  },
];

const dataCascade = [
  ["93", "1853", "24109", "7", "7024", "322", "4149"],
  ["21509", "68417", "80", "2048", "319825", "46233", "30986"],
  ["585101", "25403", "31219", "752", "0604", "21048", "534082"],
  ["2107853", "12201972", "24487255", "30412", "98", "4024161", "41520257"],
  ["33", "56", "04", "69", "41", "15", "25"],
  ["0223", "688", "28471", "21366", "8654", "31", "1984"],
  ["633", "51166", "41699", "6188", "15033", "21094", "32881"],
  ["406822", "81205", "91007", "38357", "110", "2041", "57104"],
  ["12073", "688", "21982", "20254", "55", "38447", "26921"],
  ["21604", "15421", "25", "3808", "582031", "62311", "85799"],
];

const sectionToneDeck = [
  "lcars-classic-tone-violet",
  "lcars-classic-tone-red",
  "lcars-classic-tone-orange",
  "lcars-classic-tone-almond",
  "lcars-classic-tone-bluey",
  "lcars-classic-tone-peach",
  "lcars-classic-tone-gold",
];

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
    .filter((entity): entity is HydratedEntity => entity !== null);
}

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

function buildSectionCode(index: number) {
  return `${String(index + 3).padStart(2, "0")}-${String((index + 1) * 173).padStart(5, "0")}`;
}

function buildRecordCode(index: number) {
  return `${String(index + 5).padStart(2, "0")}-${String((index + 1) * 917).padStart(5, "0")}`;
}

function buildEntryCode(record: HydratedEntity) {
  const seed = record.slug.length * 137 + record.timelineTrail.length * 31 + record.primaryFacts.length * 19;
  const left = String(20 + (seed % 80)).padStart(2, "0");
  const right = String(100 + (seed % 900)).padStart(3, "0");
  return `${left}${right}`;
}

function buildPrimaryFactsCopy(record: HydratedEntity) {
  return record.primaryFacts.slice(0, 4).map((fact) => `${fact.label}: ${fact.value}`);
}

export function FieldGuideApp() {
  const [mode, setMode] = useState<ArchiveMode>("field-guide");
  const [screen, setScreen] = useState<Screen>("briefing");
  const [activeSection, setActiveSection] = useState<string | "all">("all");
  const [activeSlug, setActiveSlug] = useState(defaultPrimarySlug);
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
  const activeRecord = getHydratedEntity(activeSlug, mode) ?? featuredDeck[0];
  const activeSectionMeta =
    activeSection === "all"
      ? null
      : archiveSections.find((section) => section.type === activeSection) ?? null;
  const sectionRecords =
    activeSection === "all"
      ? featuredDeck
      : hydrateSlugs(
          listEntitiesByType(activeSection).map((entity) => entity.slug),
          mode
        ).slice(0, 7);
  const visibleRecords = deferredQuery.trim()
    ? hydrateSlugs(
        searchArchive(deferredQuery)
          .map((result) => result.slug)
          .filter((slug) => slug !== activeSlug),
        mode
      )
    : sectionRecords.filter((record) => record.slug !== activeSlug);
  const relatedRecords = hydrateSlugs(
    activeRecord.relationTargets.map((relationship) => relationship.targetSlug),
    mode
  )
    .filter((record) => record.slug !== activeRecord.slug)
    .slice(0, 4);
  const primaryFactsCopy = buildPrimaryFactsCopy(activeRecord);
  const contentKey = `${screen}-${mode}-${activeRecord.slug}-${activeSection}`;

  function focusEntity(slug: string) {
    startTransition(() => {
      const entity = getHydratedEntity(slug, mode);
      setActiveSlug(slug);
      setScreen("briefing");
      setQuery("");
      if (entity) {
        setActiveSection(entity.entityType);
      }
    });
  }

  function switchSection(section: string | "all", leadSlug?: string) {
    startTransition(() => {
      setActiveSection(section);
      setScreen("records");
      setQuery("");
      if (leadSlug) {
        setActiveSlug(leadSlug);
      }
    });
  }

  function switchMode(nextMode: ArchiveMode) {
    startTransition(() => {
      setMode(nextMode);
    });
  }

  function renderMainContent() {
    if (screen === "records") {
      return (
        <>
          <h2>{activeSectionMeta?.label ?? "Featured deck"}</h2>
          <p>
            Browse the current archive deck, jump directly to a live record, or search the wider index
            without leaving the frame.
          </p>

          <div className="lcars-classic-search-row">
            <label className="lcars-classic-search-label" htmlFor="archive-search">
              Search archive
            </label>
            <input
              className="lcars-classic-search-input"
              id="archive-search"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Vulcan, Khitomer, Borg..."
              type="search"
              value={query}
            />
          </div>

          <div className="lcars-classic-records-list">
            {visibleRecords.length ? (
              visibleRecords.slice(0, 6).map((record, index) => (
                <article className="lcars-classic-record-row" key={record.slug}>
                  <div className="lcars-classic-record-code">{buildRecordCode(index)}</div>
                  <div className="lcars-classic-record-copy">
                    <h3>{record.displayName}</h3>
                    <p>{record.summary}</p>
                  </div>
                  <button className="lcars-classic-inline-button" onClick={() => focusEntity(record.slug)} type="button">
                    open record
                  </button>
                </article>
              ))
            ) : (
              <p>No matching records in the current archive view.</p>
            )}
          </div>
        </>
      );
    }

    if (screen === "timeline") {
      return (
        <>
          <h2>Chronology trace</h2>
          <p>
            Timeline events stay in one reading column so the eye moves through the log the way an LCARS
            article does, instead of bouncing between panels.
          </p>

          {activeRecord.timelineTrail.length ? (
            <div className="lcars-classic-block-list">
              {activeRecord.timelineTrail.map((event) => (
                <section className="lcars-classic-copy-block" key={`${event.sortKey}-${event.headline}`}>
                  <p className="lcars-classic-kicker">{event.eraLabel}</p>
                  <h3>{event.headline}</h3>
                  <p>{event.detail}</p>
                </section>
              ))}
            </div>
          ) : (
            <p>This entry does not yet have a deeper chronology trail attached to it.</p>
          )}
        </>
      );
    }

    if (screen === "sources") {
      return (
        <>
          <h2>Source trail</h2>
          <p>
            Every supporting source and outward citation is kept in the same article flow instead of being
            scattered across a separate stats dashboard.
          </p>

          <div className="lcars-classic-block-list">
            {activeRecord.sourceTrail.map((source) => (
              <section className="lcars-classic-copy-block" key={source.key}>
                <p className="lcars-classic-kicker">{source.sourceType}</p>
                <h3>{source.label}</h3>
                <p>Canon weight {Math.round(source.canonWeight * 100)}%.</p>
                {source.url ? (
                  <p>
                    <a href={source.url} rel="noreferrer" target="_blank">
                      Open source record
                    </a>
                  </p>
                ) : null}
              </section>
            ))}

            {activeRecord.citations.map((citation) => (
              <section className="lcars-classic-copy-block" key={citation.label}>
                <p className="lcars-classic-kicker">{citation.source?.label ?? citation.sourceKey}</p>
                <h3>{citation.label}</h3>
                <p>{citation.note}</p>
                <p>
                  <a href={citation.url} rel="noreferrer" target="_blank">
                    Visit citation
                  </a>
                </p>
              </section>
            ))}
          </div>
        </>
      );
    }

    return (
      <>
        <h2>{activeRecord.descriptor ?? "Archive abstract"}</h2>
        <p>{activeRecord.summary}</p>

        <h3>Operational read</h3>
        <p>{activeRecord.readout.join(" ")}</p>

        <h3>Primary factors</h3>
        <ul className="lcars-classic-list">
          {primaryFactsCopy.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>

        <h3>Relationship context</h3>
        <p>
          {relatedRecords.length
            ? relatedRecords
                .map((record) => `${record.displayName} remains a live cross-reference in this archive.`)
                .join(" ")
            : "No immediate live links are attached to this record yet."}
        </p>

        <h3>Profile note</h3>
        <p>
          Threat posture is {formatThreat(activeRecord.threatLevel).toLowerCase()}, diplomatic posture is{" "}
          {activeRecord.diplomaticPosture}, and the record is tracked as {activeRecord.canonTier} canon.
        </p>
      </>
    );
  }

  return (
    <main className="lcars-classic-root">
      <section className="lcars-classic-shell">
        <div className="lcars-classic-top">
          <div className="lcars-classic-left-top">
            <button className="lcars-classic-brand-button" onClick={() => setScreen("briefing")} type="button">
              <span>Trek</span>
              Field Guide
            </button>
            <div className="lcars-classic-site-map">
              <span>02-site map</span>
              <strong>{activeSectionMeta?.label ?? "Featured deck"}</strong>
            </div>
          </div>

          <div className="lcars-classic-right-top">
            <div className="lcars-classic-banner">Archive Entry {buildEntryCode(activeRecord)}</div>

            <div className="lcars-classic-top-band">
              <div className="lcars-classic-data-cascade" aria-hidden="true">
                {dataCascade.map((column, index) => (
                  <div className="lcars-classic-data-column" key={`${column[0]}-${index}`}>
                    {column.map((value, rowIndex) => (
                      <span key={`${value}-${rowIndex}`}>{value}</span>
                    ))}
                  </div>
                ))}
              </div>

              <nav className="lcars-classic-screen-nav" aria-label="Archive screens">
                {screenDeck.map((entry) => (
                  <button
                    className={clsx("lcars-classic-screen-button", entry.tone, screen === entry.id && "is-active")}
                    key={entry.id}
                    onClick={() => setScreen(entry.id)}
                    type="button"
                  >
                    <span>{entry.code}</span>
                    <strong>{entry.label}</strong>
                  </button>
                ))}
              </nav>
            </div>

            <div className="lcars-classic-bar-panel lcars-classic-bar-panel-top" aria-hidden="true">
              <span className="lcars-classic-bar-a" />
              <span className="lcars-classic-bar-b" />
              <span className="lcars-classic-bar-c" />
              <span className="lcars-classic-bar-d" />
              <span className="lcars-classic-bar-e" />
            </div>
          </div>
        </div>

        <div className="lcars-classic-bottom">
          <aside className="lcars-classic-left-frame">
            <button className="lcars-classic-frame-top-button" onClick={() => setScreen("briefing")} type="button">
              <span>screen</span> top
            </button>

            <div className="lcars-classic-frame-stack">
              <button
                className={clsx("lcars-classic-frame-panel", "lcars-classic-tone-violet", activeSection === "all" && "is-active")}
                onClick={() => switchSection("all", featuredDeck[0]?.slug ?? defaultPrimarySlug)}
                type="button"
              >
                <span>01-00001</span>
                <strong>Featured</strong>
              </button>

              {archiveSections.map((section, index) => (
                <button
                  className={clsx(
                    "lcars-classic-frame-panel",
                    sectionToneDeck[index % sectionToneDeck.length],
                    activeSection === section.type && "is-active"
                  )}
                  key={section.type}
                  onClick={() => switchSection(section.type, section.leadSlug)}
                  type="button"
                >
                  <span>{buildSectionCode(index)}</span>
                  <strong>{section.label}</strong>
                </button>
              ))}
            </div>

            <div className="lcars-classic-mode-summary">
              <span>{activeMode.code}</span>
              <strong>{activeMode.label}</strong>
            </div>
          </aside>

          <section className="lcars-classic-right-frame">
            <div className="lcars-classic-bar-panel lcars-classic-bar-panel-bottom" aria-hidden="true">
              <span className="lcars-classic-bar-f" />
              <span className="lcars-classic-bar-g" />
              <span className="lcars-classic-bar-h" />
              <span className="lcars-classic-bar-i" />
              <span className="lcars-classic-bar-j" />
            </div>

            <article className="lcars-classic-article" key={contentKey}>
              <header className="lcars-classic-article-head">
                <h1>{activeRecord.displayName}</h1>
                <p className="lcars-classic-postmeta">
                  Posted on Stardate {stardate} • {activeRecord.era} • {activeMode.label} lens
                </p>
              </header>

              {renderMainContent()}

              <p className="lcars-classic-endcap">END ARCHIVE ENTRY</p>

              <div className="lcars-classic-button-row">
                <button className="lcars-classic-end-button lcars-classic-tone-violet" onClick={() => setScreen("records")} type="button">
                  browse /<br />
                  current deck
                </button>

                <button
                  className="lcars-classic-end-button lcars-classic-tone-almond"
                  onClick={() => {
                    if (relatedRecords[0]) {
                      focusEntity(relatedRecords[0].slug);
                    } else {
                      setScreen("sources");
                    }
                  }}
                  type="button"
                >
                  <span className="lcars-classic-button-kicker">
                    {relatedRecords[0] ? "related record" : "archive sources"}
                  </span>
                  {relatedRecords[0] ? relatedRecords[0].displayName : "open source trail"}
                </button>
              </div>

              <div className="lcars-classic-mode-row">
                {modeDeck.map((entry) => (
                  <button
                    className={clsx("lcars-classic-mode-pill", entry.tone, entry.id === mode && "is-active")}
                    key={entry.id}
                    onClick={() => switchMode(entry.id)}
                    type="button"
                  >
                    <span>{entry.code}</span>
                    <strong>{entry.label}</strong>
                  </button>
                ))}
              </div>
            </article>

            <footer className="lcars-classic-footer">
              <p>
                Archive index {archiveStats.entityCount} records • {archiveStats.relationCount} live links •{" "}
                {archiveStats.citationCount} citations.
              </p>
              <p>
                Active profile {formatType(activeRecord.entityType)} • threat {formatThreat(activeRecord.threatLevel)} •{" "}
                {activeRecord.tags.join(" / ")}.
              </p>
              <p>{activeMode.summary}</p>
            </footer>
          </section>
        </div>
      </section>
    </main>
  );
}
