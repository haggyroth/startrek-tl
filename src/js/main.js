/**
 * Wiring: load the dataset, hold filter state, and keep the chart, controls,
 * summary and table in sync with it.
 *
 * State flows one way — update() mutates state, then re-derives everything from
 * it — so the URL, the controls and the chart can never disagree.
 */

import { loadEvents, locationsByFrequency, seriesByFrequency } from "./data.js";
import { DensityChart } from "./chart.js";
import { Tooltip } from "./tooltip.js";
import { buildControls } from "./controls.js";
import { applyFilters, readHash, writeHash, scheduleHashWrite, FULL_RANGE } from "./state.js";

const chartRoot = document.querySelector("#chart");
const statusNode = document.querySelector("#status");
const summaryNode = document.querySelector("#summary");
const resetNode = document.querySelector("#reset-zoom");

function setStatus(message, isError = false) {
  statusNode.textContent = message;
  statusNode.classList.toggle("is-error", isError);
  statusNode.hidden = !message;
}

function renderStats(events) {
  const stats = [
    ["Events", events.length.toLocaleString()],
    ["Landmarks", events.filter((e) => e.landmark).length],
    ["Dated", events.filter((e) => e.date).length],
  ];

  const list = document.querySelector("#stats");
  list.replaceChildren();
  for (const [label, value] of stats) {
    const item = document.createElement("div");
    item.className = "stat";
    const v = document.createElement("span");
    v.className = "stat-value";
    v.textContent = value;
    const l = document.createElement("span");
    l.className = "stat-label";
    l.textContent = label;
    item.append(v, l);
    list.appendChild(item);
  }
}

/**
 * A plain-language description of the current view, for sighted and AT users.
 *
 * Zoom is a view control, not a filter, so the counts are kept distinct: the
 * filter total first, then how many of those the zoomed window actually shows.
 */
function describe(state, events, domain, isZoomed) {
  const parts = [`${events.length.toLocaleString()} event${events.length === 1 ? "" : "s"}`];

  parts.push(state.timeline === "all" ? "across all timelines" : `on the ${state.timeline} timeline`);
  if (state.series) parts.push(`in ${[...state.series].sort().join(", ")}`);
  if (state.location) parts.push(`at ${state.location}`);

  let text = `${parts.join(" ")}.`;

  if (isZoomed) {
    const inView = events.filter((e) => e.year >= domain[0] && e.year <= domain[1]).length;
    text += ` Showing ${inView.toLocaleString()} in ${domain[0]}–${domain[1]}.`;
  }

  return text;
}

function renderTable(events) {
  const body = document.querySelector("#event-table tbody");
  const rows = events.map((e) => {
    const tr = document.createElement("tr");
    for (const value of [
      e.year,
      e.date ?? "—",
      e.stardate ?? "—",
      e.group ?? "—",
      e.series.join(", ") || "—",
      e.summary,
    ]) {
      const td = document.createElement("td");
      td.textContent = value;
      tr.appendChild(td);
    }
    return tr;
  });
  body.replaceChildren(...rows);
}

async function init() {
  setStatus("Loading events…");

  let data;
  try {
    data = await loadEvents();
  } catch (err) {
    setStatus(
      `Could not load the dataset (${err.message}). Serve the repository root — ` +
        `run "npm run serve" and open /src/ — so that ../data/events.json resolves.`,
      true,
    );
    return;
  }

  setStatus("");
  document.querySelector("#generated").textContent = data.meta.generated;

  let state = readHash();

  const tooltip = new Tooltip(document.body);
  const chart = new DensityChart(chartRoot, {
    range: FULL_RANGE,
    onHover: (event, node) => {
      if (!event || !node) tooltip.hide();
      else tooltip.show(event, node);
    },
    // Zoom gestures write straight back into state so the URL keeps up.
    onDomainChange: (years) => {
      state = { ...state, years };
      // Zoom fires continuously; coalesce so the browser's replaceState rate
      // limit is never reached.
      scheduleHashWrite(state);
      refreshChrome();
    },
  });

  // Control options are derived from the whole dataset, not the filtered view,
  // so filtering never makes a control disappear out from under the pointer.
  const timelineCounts = new Map();
  for (const e of data.events) {
    timelineCounts.set(e.timeline, (timelineCounts.get(e.timeline) ?? 0) + 1);
  }

  const sync = buildControls({
    getState: () => state,
    update: (patch) => {
      state = { ...state, ...patch };
      apply();
    },
    seriesCounts: seriesByFrequency(data.events),
    locationCounts: locationsByFrequency(data.events),
    timelineCounts,
  });

  let filtered = [];
  let tableStale = true;
  const toggle = document.querySelector("#table-toggle");
  const tableWrap = document.querySelector("#table-view");

  function refreshChrome() {
    const zoomed = chart.isZoomed();
    summaryNode.textContent = describe(state, filtered, chart.domain, zoomed);
    resetNode.hidden = !zoomed;
  }

  function apply() {
    filtered = applyFilters(data.events, state);

    chart.setData(filtered).setDomain(state.years).render();

    sync(state);
    renderStats(filtered);
    // The table is built on demand: rendering ~9,000 hidden cells on every
    // filter change was about half the cost of the interaction.
    tableStale = true;
    if (!tableWrap.hidden) renderTable(filtered);
    writeHash(state);
    refreshChrome();

    document.querySelector("#empty").hidden = filtered.length > 0;
  }

  resetNode.addEventListener("click", () => {
    state = { ...state, years: null };
    apply();
  });

  // A pasted link or a back/forward step changes the hash without reloading the
  // document. Our own writeHash uses replaceState, which does not fire this, so
  // there is no feedback loop.
  window.addEventListener("hashchange", () => {
    state = readHash();
    apply();
  });

  toggle.addEventListener("click", () => {
    const showing = tableWrap.hidden;
    tableWrap.hidden = !showing;
    toggle.setAttribute("aria-expanded", String(showing));
    toggle.textContent = showing ? "Hide data table" : "Show data table";
    if (showing && tableStale) {
      renderTable(filtered);
      tableStale = false;
    }
  });

  apply();
}

init();
