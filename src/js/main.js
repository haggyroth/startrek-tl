/**
 * Wiring: load the dataset, render the chart, and hook up the location panel
 * and the accessible table view.
 *
 * Series filtering and zoom belong to Phase 4; the chart already accepts a
 * filtered event list, so those hook in here without touching chart.js.
 */

import { loadEvents, locationsByFrequency } from "./data.js";
import { DensityChart } from "./chart.js";
import { Tooltip } from "./tooltip.js";

const RANGE = [2233, 2402];

const chartRoot = document.querySelector("#chart");
const statusNode = document.querySelector("#status");

function setStatus(message, isError = false) {
  statusNode.textContent = message;
  statusNode.classList.toggle("is-error", isError);
  statusNode.hidden = !message;
}

function renderStats(events, meta) {
  const withDate = events.filter((e) => e.date).length;
  const landmarks = events.filter((e) => e.landmark).length;
  const stats = [
    ["Events", events.length.toLocaleString()],
    ["Years", `${RANGE[0]}–${RANGE[1]}`],
    ["Landmarks", landmarks],
    ["Dated", withDate],
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

  document.querySelector("#generated").textContent = meta.generated;
}

/**
 * The location panel. `group` is Memory Alpha's per-year ship/station
 * subheading — about three quarters of events carry one — which makes it a
 * usable second axis alongside series.
 */
function renderLocations(events, chart) {
  const panel = document.querySelector("#locations");
  panel.replaceChildren();

  let active = null;

  for (const { name, count } of locationsByFrequency(events)) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.setAttribute("aria-pressed", "false");

    const label = document.createElement("span");
    label.textContent = name;
    const badge = document.createElement("span");
    badge.className = "chip-count";
    badge.textContent = count;
    chip.append(label, badge);

    chip.addEventListener("click", () => {
      const isActive = active === name;
      active = isActive ? null : name;

      for (const other of panel.querySelectorAll(".chip")) {
        other.setAttribute("aria-pressed", String(!isActive && other === chip));
      }
      chart.setHighlight(active ? (d) => d.group === active : null);
    });

    panel.appendChild(chip);
  }
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

  // Prime timeline only by default. Kelvin, Mirror and alternate-timeline
  // events must never be binned into the same curve as prime canon.
  const events = data.events.filter((e) => e.timeline === "prime");

  const tooltip = new Tooltip(document.body);
  const chart = new DensityChart(chartRoot, {
    range: RANGE,
    onHover: (event, domEvent) => {
      if (!event) tooltip.hide();
      else tooltip.show(event, domEvent.currentTarget);
    },
  });

  chart.setData(events).render();

  renderStats(events, data.meta);
  renderLocations(events, chart);
  renderTable(events);

  const toggle = document.querySelector("#table-toggle");
  const tableWrap = document.querySelector("#table-view");
  toggle.addEventListener("click", () => {
    const showing = tableWrap.hidden;
    tableWrap.hidden = !showing;
    toggle.setAttribute("aria-expanded", String(showing));
    toggle.textContent = showing ? "Hide data table" : "Show data table";
  });
}

init();
