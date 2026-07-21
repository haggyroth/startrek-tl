/**
 * Filter controls: timeline, series, and location.
 *
 * Every control is a toggle button rather than a checkbox so the row reads as
 * one filter bar. All of them re-bin the curve — none merely hide marks — so
 * the waveform reshapes to whatever subset is selected.
 */

const SERIES_LABELS = {
  TOS: "The Original Series",
  TAS: "The Animated Series",
  TNG: "The Next Generation",
  DS9: "Deep Space Nine",
  VOY: "Voyager",
  ENT: "Enterprise",
  DIS: "Discovery",
  PIC: "Picard",
  LD: "Lower Decks",
  PRO: "Prodigy",
  SNW: "Strange New Worlds",
  ST: "Short Treks",
  FILM: "Films",
};

const TIMELINES = [
  ["prime", "Prime"],
  ["kelvin", "Kelvin"],
  ["mirror", "Mirror"],
  ["alternate", "Alternate"],
  ["all", "All"],
];

function button(className, label, { title } = {}) {
  const node = document.createElement("button");
  node.type = "button";
  node.className = className;
  node.setAttribute("aria-pressed", "false");
  if (title) node.title = title;
  node.append(label);
  return node;
}

function withCount(label, count) {
  const wrap = document.createDocumentFragment();
  const text = document.createElement("span");
  text.textContent = label;
  const badge = document.createElement("span");
  badge.className = "chip-count";
  badge.textContent = count;
  wrap.append(text, badge);
  return wrap;
}

/**
 * @param {object} options
 * @param {() => object} options.getState
 * @param {(patch: object) => void} options.update
 */
export function buildControls({
  getState,
  update,
  seriesCounts,
  locationCounts,
  timelineCounts,
  eras,
}) {
  const eraRow = document.querySelector("#era-filter");
  const timelineRow = document.querySelector("#timeline-filter");
  const seriesRow = document.querySelector("#series-filter");
  const locationRow = document.querySelector("#locations");

  // ---- eras (view presets, not filters) ----
  // These set the visible year range. Zoom is a view control, so choosing an
  // era never changes which events are in the filter set.
  const eraButtons = new Map();
  for (const era of eras) {
    const node = button("chip", era.label);
    node.addEventListener("click", () => {
      const current = getState().years;
      const same =
        current && current[0] === era.years[0] && current[1] === era.years[1];
      update({ years: same ? null : [...era.years] });
    });
    eraButtons.set(era.id, node);
    eraRow.appendChild(node);
  }

  // ---- timeline (single-select) ----
  const timelineButtons = new Map();
  for (const [value, label] of TIMELINES) {
    const count = value === "all" ? null : timelineCounts.get(value) ?? 0;
    // Only offer timelines that actually have events.
    if (count === 0) continue;

    const node = button("chip", count == null ? label : withCount(label, count));
    node.addEventListener("click", () => update({ timeline: value }));
    timelineButtons.set(value, node);
    timelineRow.appendChild(node);
  }

  // ---- series (multi-select; empty selection means all) ----
  const seriesButtons = new Map();
  for (const { code, count } of seriesCounts) {
    const node = button("chip", withCount(code, count), { title: SERIES_LABELS[code] ?? code });
    node.addEventListener("click", () => {
      const current = getState().series;
      const next = new Set(current ?? []);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      update({ series: next.size ? next : null });
    });
    seriesButtons.set(code, node);
    seriesRow.appendChild(node);
  }

  const clearSeries = button("chip chip-clear", "All series");
  clearSeries.addEventListener("click", () => update({ series: null }));
  seriesRow.appendChild(clearSeries);

  // ---- location (single-select) ----
  const locationButtons = new Map();
  for (const { name, count } of locationCounts) {
    const node = button("chip", withCount(name, count));
    node.addEventListener("click", () => {
      update({ location: getState().location === name ? null : name });
    });
    locationButtons.set(name, node);
    locationRow.appendChild(node);
  }

  /** Reflect state into the controls. Called after every state change. */
  return function sync(state) {
    for (const era of eras) {
      const active =
        Boolean(state.years) &&
        state.years[0] === era.years[0] &&
        state.years[1] === era.years[1];
      eraButtons.get(era.id).setAttribute("aria-pressed", String(active));
    }
    for (const [value, node] of timelineButtons) {
      node.setAttribute("aria-pressed", String(state.timeline === value));
    }
    for (const [code, node] of seriesButtons) {
      node.setAttribute("aria-pressed", String(Boolean(state.series?.has(code))));
    }
    clearSeries.setAttribute("aria-pressed", String(state.series === null));
    for (const [name, node] of locationButtons) {
      node.setAttribute("aria-pressed", String(state.location === name));
    }
  };
}
