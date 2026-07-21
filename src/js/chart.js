/**
 * The density chart.
 *
 * Layout: one column per year. Each event is a dot stacked upward within its
 * year, so the smoothed curve traced over the column tops IS the density curve
 * — the wave and the dots are the same data, not two representations of it.
 *
 * A note on the two X axes: year (top) and stardate (bottom) are the same
 * dimension in two notations, not two different measures. That is a unit
 * conversion, not the dual-axis anti-pattern. The stardate axis is drawn only
 * from 2323 onward, because no linear mapping exists before it.
 */

import { binByYear, yearToStardate, STARDATE_EPOCH_YEAR } from "./data.js";

const MARGIN = { top: 42, right: 20, bottom: 52, left: 52 };
const MAX_PLOT_HEIGHT = 520;
const MIN_PLOT_HEIGHT = 170;
/** Ceiling on one stack row. Without it a max-of-1 view puts a lone dot
    halfway up a 520px plot; instead the plot shrinks to fit the data. */
const MAX_ROW_HEIGHT = 26;
const MAX_DOT_RADIUS = 7;
/** Deepest zoom. Sized so the floor stays about a decade across the full
    2063-3269 range; the old 24x cap bottomed out at fifty years. */
const MAX_ZOOM = 120;

let clipSeq = 0;

export class DensityChart {
  #root;
  #svg;
  #onHover;
  #onDomainChange;
  #bins = [];
  #range;
  #domain;
  #defaultDomain;
  #highlight = null;
  #x = null;
  #y = null;
  #bandWidth = 0;
  #rowHeight = 0;
  #dotRadius = 2.6;
  #plotHeight = MAX_PLOT_HEIGHT;
  #activeId = null;
  #cursorId = null;
  #zoom = null;
  #clipId = `plot-clip-${clipSeq++}`;

  constructor(root, { range, defaultDomain, onHover, onDomainChange }) {
    this.#root = root;
    this.#range = range;
    this.#defaultDomain = defaultDomain ? [...defaultDomain] : [...range];
    this.#domain = [...this.#defaultDomain];
    this.#onHover = onHover;
    this.#onDomainChange = onDomainChange ?? (() => {});

    this.#svg = d3
      .select(root)
      .append("svg")
      .attr("class", "chart-svg")
      // "group", not "img": role="img" makes assistive tech treat the subtree
      // as a single opaque graphic, which would hide the focusable marks.
      .attr("role", "group")
      .attr(
        "aria-label",
        "Star Trek event density over time. Use arrow keys to move between events.",
      );

    this.#svg
      .append("defs")
      .append("clipPath")
      .attr("id", this.#clipId)
      .append("rect");

    // Layers, painted back to front. Marks are clipped so a zoomed-in view
    // can't paint dots over the axes.
    for (const name of ["grid", "area", "dots"]) {
      this.#svg.append("g").attr("class", `layer-${name}`).attr("clip-path", `url(#${this.#clipId})`);
    }
    for (const name of ["axes", "overlay"]) {
      this.#svg.append("g").attr("class", `layer-${name}`);
    }

    this.#initZoom();
    this.#initKeyboard();

    // d3-zoom stores its transform in pixels, so a resize would otherwise
    // reinterpret the same transform as a different year range.
    window.addEventListener("resize", () => {
      this.#syncZoomTransform();
      this.render();
    });
  }

  setData(events) {
    this.#bins = binByYear(events, this.#range);
    return this;
  }

  /** Visible year range. Pass null to return to the default view. */
  setDomain(domain) {
    this.#domain = domain ? [...domain] : [...this.#defaultDomain];
    this.#syncZoomTransform();
    return this;
  }

  get domain() {
    return [...this.#domain];
  }

  /** True when the view differs from the default the chart opens on. */
  isZoomed() {
    return (
      this.#domain[0] !== this.#defaultDomain[0] || this.#domain[1] !== this.#defaultDomain[1]
    );
  }

  /** Dim everything not matching the predicate. Null clears the highlight. */
  setHighlight(predicate) {
    this.#highlight = predicate;
    this.#applyHighlight();
    return this;
  }

  render() {
    const width = this.#root.clientWidth;
    if (!width) return this;

    // The y domain follows the *filtered* data, so a narrow filter fills the
    // plot instead of hugging the baseline.
    const maxCount = Math.max(1, d3.max(this.#bins, (b) => b.count) ?? 1);

    const plotHeight = Math.max(
      MIN_PLOT_HEIGHT,
      Math.min(MAX_PLOT_HEIGHT, maxCount * MAX_ROW_HEIGHT),
    );
    this.#plotHeight = plotHeight;

    const height = plotHeight + MARGIN.top + MARGIN.bottom;
    this.#svg.attr("width", width).attr("height", height).attr("viewBox", `0 0 ${width} ${height}`);

    this.#svg
      .select(`#${this.#clipId} rect`)
      .attr("x", MARGIN.left)
      .attr("y", MARGIN.top - 8)
      .attr("width", Math.max(0, width - MARGIN.left - MARGIN.right))
      .attr("height", plotHeight + 8);

    const x = d3
      .scaleLinear()
      .domain([this.#domain[0], this.#domain[1] + 1])
      .range([MARGIN.left, width - MARGIN.right]);

    const y = d3
      .scaleLinear()
      .domain([0, maxCount])
      .range([MARGIN.top + plotHeight, MARGIN.top]);

    this.#x = x;
    this.#y = y;
    this.#bandWidth = x(this.#domain[0] + 1) - x(this.#domain[0]);
    this.#rowHeight = Math.abs(y(1) - y(0));
    // Dots grow as the data thins out, but never past the column or the row.
    this.#dotRadius = Math.min(
      MAX_DOT_RADIUS,
      Math.max(1.6, this.#rowHeight / 2.2),
      Math.max(1.6, this.#bandWidth / 2.2),
    );

    this.#drawGrid(width, y, maxCount);
    this.#drawArea(x, y);
    this.#drawDots(x, y);
    this.#drawAxes(width, height, x, y);
    this.#drawHitLayer(width);
    this.#applyHighlight();
    this.#markActive();

    return this;
  }

  // ---------- zoom ----------

  #initZoom() {
    this.#zoom = d3
      .zoom()
      .scaleExtent([1, MAX_ZOOM])
      .filter((event) => !event.button && event.type !== "dblclick")
      .on("zoom", (event) => {
        if (event.sourceEvent == null) return; // programmatic sync, not a gesture
        this.#applyZoomTransform(event.transform);
      });

    this.#svg.call(this.#zoom);
    this.#svg.on("dblclick.zoom", null);
  }

  #baseScale(width) {
    return d3
      .scaleLinear()
      .domain([this.#range[0], this.#range[1] + 1])
      .range([MARGIN.left, width - MARGIN.right]);
  }

  #applyZoomTransform(transform) {
    const width = this.#root.clientWidth;
    if (!width) return;

    const rescaled = transform.rescaleX(this.#baseScale(width));
    const [from, to] = rescaled.domain();

    const next = [
      Math.max(this.#range[0], Math.round(from)),
      Math.min(this.#range[1], Math.round(to) - 1),
    ];
    if (next[1] <= next[0]) return;
    if (next[0] === this.#domain[0] && next[1] === this.#domain[1]) return;

    this.#domain = next;
    this.render();
    this.#onDomainChange(this.isZoomed() ? this.domain : null);
  }

  /** Keep d3-zoom's internal transform in step when the domain is set in code. */
  #syncZoomTransform() {
    const width = this.#root.clientWidth;
    if (!width || !this.#zoom) return;

    const base = this.#baseScale(width);
    const span = this.#range[1] + 1 - this.#range[0];
    const visible = this.#domain[1] + 1 - this.#domain[0];
    const k = Math.min(MAX_ZOOM, Math.max(1, span / visible));
    // rescaleX maps x -> tx + k·base(x); pin the domain start to the left edge.
    const tx = MARGIN.left - k * base(this.#domain[0]);

    this.#svg.call(this.#zoom.transform, d3.zoomIdentity.translate(tx, 0).scale(k));
  }

  // ---------- drawing ----------

  #drawGrid(width, y, maxCount) {
    const ticks = y.ticks(Math.min(6, maxCount));

    this.#svg
      .select(".layer-grid")
      .selectAll("line")
      .data(ticks)
      .join("line")
      .attr("class", "grid-line")
      .attr("x1", MARGIN.left)
      .attr("x2", width - MARGIN.right)
      .attr("y1", (d) => y(d))
      .attr("y2", (d) => y(d));
  }

  #visibleBins() {
    // One year of overscan each side so the curve enters and leaves cleanly.
    return this.#bins.filter(
      (b) => b.year >= this.#domain[0] - 1 && b.year <= this.#domain[1] + 1,
    );
  }

  #drawArea(x, y) {
    const half = this.#bandWidth / 2;
    const points = this.#visibleBins().map((b) => ({ x: x(b.year) + half, y: y(b.count) }));

    const area = d3.area().x((d) => d.x).y0(y(0)).y1((d) => d.y).curve(d3.curveMonotoneX);
    const line = d3.line().x((d) => d.x).y((d) => d.y).curve(d3.curveMonotoneX);

    const g = this.#svg.select(".layer-area");
    g.selectAll("path.density-area").data([points]).join("path")
      .attr("class", "density-area")
      .attr("d", area);
    g.selectAll("path.density-line").data([points]).join("path")
      .attr("class", "density-line")
      .attr("d", line);
  }

  #drawDots(x, y) {
    const events = this.#visibleBins().flatMap((b) => b.events);
    const half = this.#bandWidth / 2;
    const rowHeight = this.#rowHeight;
    const r = this.#dotRadius;

    this.#svg
      .select(".layer-dots")
      .selectAll("circle")
      .data(events, (d) => d.id)
      .join("circle")
      .attr("class", (d) => `event-dot${d.landmark ? " is-landmark" : ""}`)
      .attr("cx", (d) => x(d.year) + half)
      // Centre each dot in its row: index 0 sits just above the baseline.
      .attr("cy", (d) => y(d.stackIndex) - rowHeight / 2)
      .attr("r", (d) => (d.landmark ? r * 1.5 : r))
      // Pointer hits go through the overlay; focus stays on the marks so the
      // chart is still traversable by keyboard. Tabindex is roving — see
      // #applyRovingTabIndex — because 1,486 tab stops is not navigation.
      .attr("role", "button")
      .attr("aria-label", (d) => this.#describeEvent(d))
      .on("focus", (event, d) => {
        this.#cursorId = d.id;
        this.#applyRovingTabIndex();
        // Look the node up rather than reading it off the event: target and
        // currentTarget are only populated during a real dispatch, which made
        // the tooltip silently skip rendering on keyboard focus.
        this.#onHover(d, this.#dotNode(d.id));
      })
      .on("blur", () => this.#onHover(null, null));

    this.#applyRovingTabIndex();
  }

  #drawAxes(width, height, x, y) {
    const g = this.#svg.select(".layer-axes");
    g.selectAll("*").remove();

    const span = this.#domain[1] - this.#domain[0];
    const tickCount = Math.max(4, Math.min(14, Math.round(width / 110)));

    // Year axis, top.
    g.append("g")
      .attr("class", "axis axis-year")
      .attr("transform", `translate(0, ${MARGIN.top})`)
      .call(
        d3
          .axisTop(x)
          .ticks(tickCount)
          // Whole years only — zooming in must not invent "2374.5".
          .tickValues(yearTicks(this.#domain, tickCount))
          .tickFormat(d3.format("d"))
          .tickSizeOuter(0),
      );

    g.append("text").attr("class", "axis-title").attr("x", MARGIN.left).attr("y", 16).text("Year");

    // Stardate axis, bottom — only where a linear mapping exists.
    const baseline = MARGIN.top + this.#plotHeight;
    const epochX = Math.max(MARGIN.left, Math.min(width - MARGIN.right, x(STARDATE_EPOCH_YEAR)));
    const showStardates = this.#domain[1] >= STARDATE_EPOCH_YEAR;
    const showVoid = this.#domain[0] < STARDATE_EPOCH_YEAR;

    if (showStardates) {
      const sdScale = d3
        .scaleLinear()
        .domain([
          yearToStardate(Math.max(this.#domain[0], STARDATE_EPOCH_YEAR)),
          yearToStardate(this.#domain[1] + 1),
        ])
        .range([epochX, width - MARGIN.right]);

      g.append("g")
        .attr("class", "axis axis-stardate")
        .attr("transform", `translate(0, ${baseline})`)
        .call(
          d3
            .axisBottom(sdScale)
            .ticks(Math.max(3, tickCount - 2))
            .tickFormat(d3.format("d"))
            .tickSizeOuter(0),
        );
    }

    if (showVoid) {
      // The pre-2323 stretch gets an explicit "no scale here" treatment rather
      // than being left blank, which would read as missing data.
      g.append("line")
        .attr("class", "axis-void")
        .attr("x1", MARGIN.left)
        .attr("x2", epochX)
        .attr("y1", baseline)
        .attr("y2", baseline);

      if (epochX - MARGIN.left > 190) {
        g.append("text")
          .attr("class", "axis-note")
          .attr("x", (MARGIN.left + epochX) / 2)
          .attr("y", baseline + 26)
          .attr("text-anchor", "middle")
          .text("stardates non-linear before 2323");
      }
    }

    g.append("text")
      .attr("class", "axis-title")
      .attr("x", MARGIN.left)
      .attr("y", height - 8)
      .text("Stardate");

    // Count axis, left.
    g.append("g")
      .attr("class", "axis axis-count")
      .attr("transform", `translate(${MARGIN.left}, 0)`)
      .call(d3.axisLeft(y).ticks(6).tickFormat(d3.format("d")).tickSizeOuter(0));

    g.append("text")
      .attr("class", "axis-title")
      .attr("transform", `translate(15, ${MARGIN.top + this.#plotHeight / 2}) rotate(-90)`)
      .attr("text-anchor", "middle")
      .text(span > 40 ? "Events per year" : "Events");
  }

  /**
   * A transparent rect over the plot that resolves the pointer to the nearest
   * dot. Individual dots are only a few pixels across and cannot be hovered
   * reliably; the hit target should be bigger than the mark regardless.
   */
  #drawHitLayer(width) {
    const g = this.#svg.select(".layer-overlay");
    g.selectAll("*").remove();

    g.append("rect")
      .attr("class", "hit-layer")
      .attr("x", MARGIN.left)
      .attr("y", MARGIN.top)
      .attr("width", Math.max(0, width - MARGIN.left - MARGIN.right))
      .attr("height", this.#plotHeight)
      .on("pointermove", (event) => {
        const [px, py] = d3.pointer(event);
        const hit = this.#findNearest(px, py);
        if (!hit) return this.#clearActive();

        if (hit.id !== this.#activeId) {
          this.#activeId = hit.id;
          this.#markActive();
        }
        this.#onHover(hit, this.#dotNode(hit.id));
      })
      .on("pointerleave", () => this.#clearActive());
  }

  /** Nearest event to a plot-space point, or null if the pointer is off-column. */
  #findNearest(px, py) {
    const year = Math.floor(this.#x.invert(px));
    const bin = this.#bins.find((b) => b.year === year);
    if (!bin?.count) return null;

    // Stack index runs bottom-up; row centres sit half a row below each tick.
    const approx = Math.round(this.#y.invert(py + this.#rowHeight / 2));
    const index = Math.max(0, Math.min(bin.count - 1, approx));
    return bin.events[index] ?? null;
  }

  // ---------- keyboard navigation ----------

  /**
   * Exactly one mark is in the tab order at a time; arrow keys move the cursor
   * within the chart. Tabbing through ~1,500 focusable circles would be
   * unusable, and skipping the chart entirely would make it unreachable.
   */
  #applyRovingTabIndex() {
    const dots = this.#svg.select(".layer-dots").selectAll("circle");
    const ids = dots.data().map((d) => d.id);
    if (!ids.length) return;

    // If the cursor's event was filtered or scrolled out, adopt the first mark.
    if (!this.#cursorId || !ids.includes(this.#cursorId)) this.#cursorId = ids[0];

    dots.attr("tabindex", (d) => (d.id === this.#cursorId ? 0 : -1));
  }

  #describeEvent(d) {
    const bits = [`${d.year}`];
    if (d.stardate) bits.push(`stardate ${d.stardate}`);
    if (d.group) bits.push(d.group);
    if (d.landmark) bits.push("landmark");
    return `${bits.join(", ")}. ${d.summary}`;
  }

  #initKeyboard() {
    this.#svg.on("keydown", (event) => {
      const handled = this.#moveCursor(event.key);
      if (!handled) return;
      event.preventDefault();

      const node = this.#dotNode(this.#cursorId);
      if (!node) return;

      this.#applyRovingTabIndex();
      node.focus();

      // Drive the tooltip and the active mark directly rather than relying on
      // the focus event as a side channel. Idempotent with the focus handler.
      const target = this.#bins
        .flatMap((b) => b.events)
        .find((e) => e.id === this.#cursorId);
      this.#activeId = this.#cursorId;
      this.#markActive();
      this.#onHover(target, node);
    });
  }

  /** @returns {boolean} whether the key was a navigation key we consumed. */
  #moveCursor(key) {
    const current = this.#bins.flatMap((b) => b.events).find((e) => e.id === this.#cursorId);
    if (!current) return false;

    // Only bins with marks on screen are navigable; the rest have no DOM node.
    const populated = this.#visibleBins().filter((b) => b.count);
    if (!populated.length) return false;

    const binIndex = populated.findIndex((b) => b.year === current.year);
    const bin = populated[binIndex];

    const pick = (b, stackIndex) => {
      const i = Math.max(0, Math.min(b.count - 1, stackIndex));
      this.#cursorId = b.events[i].id;
      return true;
    };

    switch (key) {
      case "ArrowUp":
        return pick(bin, current.stackIndex + 1);
      case "ArrowDown":
        return pick(bin, current.stackIndex - 1);
      case "ArrowRight":
        return binIndex < populated.length - 1
          ? pick(populated[binIndex + 1], current.stackIndex)
          : true;
      case "ArrowLeft":
        return binIndex > 0 ? pick(populated[binIndex - 1], current.stackIndex) : true;
      case "Home":
        return pick(populated[0], 0);
      case "End":
        return pick(populated[populated.length - 1], 0);
      default:
        return false;
    }
  }

  #dotNode(id) {
    return this.#svg.select(".layer-dots").selectAll("circle").filter((d) => d.id === id).node();
  }

  #clearActive() {
    if (this.#activeId === null) return;
    this.#activeId = null;
    this.#markActive();
    this.#onHover(null, null);
  }

  #markActive() {
    this.#svg
      .select(".layer-dots")
      .selectAll("circle")
      .classed("is-active", (d) => d.id === this.#activeId);
  }

  #applyHighlight() {
    const predicate = this.#highlight;
    this.#svg
      .select(".layer-dots")
      .selectAll("circle")
      .classed("is-dimmed", predicate ? (d) => !predicate(d) : false)
      .classed("is-emphasised", predicate ? (d) => predicate(d) : false);
  }
}

/** Whole-year ticks at a readable step for the visible span. */
function yearTicks([from, to], target) {
  const span = to - from;
  const steps = [1, 2, 5, 10, 20, 25, 50, 100];
  const step = steps.find((s) => span / s <= target) ?? 100;

  const ticks = [];
  for (let y = Math.ceil(from / step) * step; y <= to; y += step) ticks.push(y);
  return ticks.length ? ticks : [from, to];
}
