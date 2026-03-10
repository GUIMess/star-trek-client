const state = {
  mode: "scan",
};

const elements = {
  compareBlock: document.getElementById("compareBlock"),
  factsList: document.getElementById("factsList"),
  primaryInput: document.getElementById("primaryInput"),
  queryForm: document.getElementById("queryForm"),
  relationshipsList: document.getElementById("relationshipsList"),
  resultMeta: document.getElementById("resultMeta"),
  resultSummary: document.getElementById("resultSummary"),
  resultTitle: document.getElementById("resultTitle"),
  briefBlock: document.getElementById("briefBlock"),
  searchResults: document.getElementById("searchResults"),
  secondaryField: document.getElementById("secondaryField"),
  secondaryInput: document.getElementById("secondaryInput"),
  sourcesList: document.getElementById("sourcesList"),
  statusBanner: document.getElementById("statusBanner"),
  timelineList: document.getElementById("timelineList"),
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function setStatus(message, isError = false) {
  elements.statusBanner.textContent = message;
  elements.statusBanner.style.color = isError ? "#ffb4b4" : "#d7edf4";
}

function clearPanels() {
  elements.factsList.innerHTML = '<li class="empty-copy">No entity loaded yet.</li>';
  elements.relationshipsList.innerHTML = '<p class="empty-copy">Related entities will land here.</p>';
  elements.timelineList.innerHTML = '<p class="empty-copy">Timeline events will land here.</p>';
  elements.sourcesList.innerHTML = '<li class="empty-copy">Sources will appear after a scan.</li>';
  elements.compareBlock.innerHTML =
    '<p class="empty-copy">Switch to compare mode and load two entities to populate this deck.</p>';
}

function renderBrief(payload) {
  const { entity, brief, facts, relationships, timeline, sources } = payload;

  elements.resultTitle.textContent = entity.name;
  elements.resultMeta.textContent = `${entity.type} / ${entity.canonTier} / ${entity.era || "era unspecified"}`;
  elements.resultSummary.textContent = entity.summary;

  const notes = brief.operationalNotes.length
    ? `<ul>${brief.operationalNotes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ul>`
    : '<p class="empty-copy">No operational notes assembled.</p>';

  const confidence = brief.confidence
    ? `<p><strong>Confidence:</strong> ${brief.confidence.label} (${Math.round(
        brief.confidence.score * 100
      )}%)</p>`
    : '<p><strong>Confidence:</strong> mixed / source-weighted</p>';

  elements.briefBlock.innerHTML = `
    <div class="compare-card">
      <h4>${escapeHtml(brief.heading)}</h4>
      <p>${escapeHtml(brief.summary)}</p>
      ${confidence}
    </div>
    <div class="compare-card">
      <h4>Operational notes</h4>
      ${notes}
    </div>
  `;

  elements.factsList.innerHTML = facts.length
    ? facts
        .slice(0, 8)
        .map(
          (fact) => `
            <li>
              <strong>${escapeHtml(fact.label)}:</strong>
              ${escapeHtml(fact.value)}
            </li>
          `
        )
        .join("")
    : '<li class="empty-copy">No ranked facts found.</li>';

  elements.relationshipsList.innerHTML = relationships.length
    ? relationships
        .map(
          (relation) => `
            <button class="relation-chip" type="button" data-slug="${escapeHtml(relation.target.slug)}">
              ${escapeHtml(relation.target.name)}
              <small>${escapeHtml(relation.type.replaceAll("_", " "))}</small>
            </button>
          `
        )
        .join("")
    : '<p class="empty-copy">No linked entities in this seed set.</p>';

  elements.timelineList.innerHTML = timeline.length
    ? timeline
        .map(
          (event) => `
            <article class="timeline-card">
              <h4>${escapeHtml(event.eraLabel)} / ${escapeHtml(event.headline)}</h4>
              <p>${escapeHtml(event.detail)}</p>
            </article>
          `
        )
        .join("")
    : '<p class="empty-copy">No timeline events captured for this entity yet.</p>';

  elements.sourcesList.innerHTML = sources.length
    ? sources
        .map((source) => {
          const label = escapeHtml(source.label);
          if (!source.url) {
            return `<li>${label}</li>`;
          }
          return `<li><a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${label}</a></li>`;
        })
        .join("")
    : '<li class="empty-copy">No source trail assembled.</li>';
}

function renderComparison(payload) {
  elements.resultTitle.textContent = `${payload.left.name} vs ${payload.right.name}`;
  elements.resultMeta.textContent = "comparison / canon contrast";
  elements.resultSummary.textContent = payload.summary;

  elements.briefBlock.innerHTML = `
    <div class="compare-card">
      <h4>Left entity</h4>
      <p><strong>${escapeHtml(payload.left.name)}</strong> / ${escapeHtml(payload.left.type)}</p>
    </div>
    <div class="compare-card">
      <h4>Right entity</h4>
      <p><strong>${escapeHtml(payload.right.name)}</strong> / ${escapeHtml(payload.right.type)}</p>
    </div>
  `;

  elements.factsList.innerHTML = payload.different.length
    ? payload.different
        .map(
          (row) => `
            <li>
              <strong>${escapeHtml(row.label)}:</strong>
              ${escapeHtml(row.left || "n/a")} / ${escapeHtml(row.right || "n/a")}
            </li>
          `
        )
        .join("")
    : '<li class="empty-copy">No differentiating facts available.</li>';

  elements.relationshipsList.innerHTML =
    '<p class="empty-copy">Comparison mode suppresses relation drilldown.</p>';
  elements.timelineList.innerHTML =
    '<p class="empty-copy">Run individual scans to inspect each entity timeline.</p>';
  elements.sourcesList.innerHTML =
    '<li class="empty-copy">Comparison uses the same canon seed data as the entity scans.</li>';

  const shared = payload.shared.length
    ? `<ul>${payload.shared
        .map((row) => `<li><strong>${escapeHtml(row.label)}:</strong> ${escapeHtml(row.left || "n/a")}</li>`)
        .join("")}</ul>`
    : '<p class="empty-copy">No shared top facts in the current compare window.</p>';

  const different = payload.different.length
    ? `<ul>${payload.different
        .map(
          (row) => `
            <li>
              <strong>${escapeHtml(row.label)}</strong><br />
              <span>${escapeHtml(payload.left.name)}: ${escapeHtml(row.left || "n/a")}</span><br />
              <span>${escapeHtml(payload.right.name)}: ${escapeHtml(row.right || "n/a")}</span>
            </li>
          `
        )
        .join("")}</ul>`
    : '<p class="empty-copy">No top differences assembled.</p>';

  elements.compareBlock.innerHTML = `
    <div class="compare-grid">
      <article class="compare-card">
        <h4>Shared traits</h4>
        ${shared}
      </article>
      <article class="compare-card">
        <h4>Major differences</h4>
        ${different}
      </article>
    </div>
  `;
}

async function runQuery() {
  const primary = elements.primaryInput.value.trim();
  if (!primary) {
    setStatus("Enter a target to run the console.", true);
    return;
  }

  try {
    setStatus("Running console...");

    if (state.mode === "compare") {
      const secondary = elements.secondaryInput.value.trim();
      if (!secondary) {
        setStatus("Compare mode needs both targets.", true);
        return;
      }

      const res = await fetch(
        `/api/compare?left=${encodeURIComponent(primary)}&right=${encodeURIComponent(secondary)}`
      );
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message || payload.error || "Comparison failed");
      renderComparison(payload.data);
      setStatus("Comparison assembled.");
      return;
    }

    const endpoint =
      state.mode === "scan"
        ? `/api/scan/${encodeURIComponent(primary)}`
        : `/api/brief/${encodeURIComponent(primary)}?mode=${encodeURIComponent(state.mode)}`;

    const res = await fetch(endpoint);
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.message || payload.error || "Scan failed");

    renderBrief(payload.data);
    elements.compareBlock.innerHTML =
      '<p class="empty-copy">Switch to compare mode to load this target against another entity.</p>';
    setStatus(`${payload.data.brief.heading} ready.`);
  } catch (error) {
    clearPanels();
    elements.resultTitle.textContent = "Console error";
    elements.resultMeta.textContent = "query failed";
    elements.resultSummary.textContent = error.message;
    elements.briefBlock.innerHTML =
      '<p class="empty-copy">The query failed. Check DATABASE_URL, seed the database, and try again.</p>';
    setStatus(error.message, true);
  }
}

let searchTimer = null;

async function updateSearchResults() {
  const q = elements.primaryInput.value.trim();
  if (q.length < 2 || state.mode === "compare") {
    elements.searchResults.innerHTML = "";
    return;
  }

  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    const payload = await res.json();
    if (!res.ok || !payload.results?.length) {
      elements.searchResults.innerHTML = "";
      return;
    }

    elements.searchResults.innerHTML = payload.results
      .map(
        (result) => `
          <article class="search-result">
            <button type="button" data-query="${escapeHtml(result.slug)}">
              <h4>${escapeHtml(result.display_name)}</h4>
              <p>${escapeHtml(result.entity_type)} / ${escapeHtml(result.summary)}</p>
            </button>
          </article>
        `
      )
      .join("");
  } catch {
    elements.searchResults.innerHTML = "";
  }
}

function setMode(mode) {
  state.mode = mode;
  document.querySelectorAll(".mode-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mode === mode);
  });

  elements.secondaryField.hidden = mode !== "compare";
  if (mode !== "compare") {
    elements.compareBlock.innerHTML =
      '<p class="empty-copy">Switch to compare mode to load two entities side by side.</p>';
  }
}

async function checkHealth() {
  try {
    const res = await fetch("/api/health");
    const payload = await res.json();
    if (!res.ok) {
      throw new Error(payload.message || "Database link unavailable.");
    }
    setStatus("Database link stable.");
  } catch (error) {
    setStatus(error.message, true);
  }
}

document.querySelectorAll(".mode-button").forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
});

document.querySelectorAll(".example-chip").forEach((button) => {
  button.addEventListener("click", () => {
    elements.primaryInput.value = button.dataset.query || "";
    if (state.mode === "compare") {
      elements.secondaryInput.focus();
    } else {
      void runQuery();
    }
  });
});

elements.queryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void runQuery();
});

elements.primaryInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    void updateSearchResults();
  }, 180);
});

elements.searchResults.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-query]");
  if (!button) return;

  elements.primaryInput.value = button.dataset.query || "";
  elements.searchResults.innerHTML = "";
  void runQuery();
});

elements.relationshipsList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-slug]");
  if (!button) return;

  setMode("scan");
  elements.primaryInput.value = button.dataset.slug || "";
  void runQuery();
});

clearPanels();
void checkHealth();
