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

const MARGIN = { top: 42, right: 20, bottom: 52, left: 48 };
const DOT_RADIUS = 2.6;
const LANDMARK_RADIUS = 4.2;
const MIN_ROW_HEIGHT = 7;

export class DensityChart {
  #root;
  #svg;
  #onHover;
  #bins = [];
  #range;
  #highlight = null;
  #x = null;
  #y = null;
  #bandWidth = 0;
  #rowHeight = 0;
  #activeId = null;

  constructor(root, { range, onHover }) {
    this.#root = root;
    this.#range = range;
    this.#onHover = onHover;

    this.#svg = d3
      .select(root)
      .append("svg")
      .attr("class", "chart-svg")
      .attr("role", "img")
      .attr("aria-label", "Star Trek event density over time");

    // Layers, painted back to front.
    for (const name of ["grid", "area", "dots", "axes", "overlay"]) {
      this.#svg.append("g").attr("class", `layer-${name}`);
    }

    window.addEventListener("resize", () => this.render());
  }

  setData(events) {
    this.#bins = binByYear(events, this.#range);
    return this;
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

    const maxCount = Math.max(1, d3.max(this.#bins, (b) => b.count) ?? 1);
    const plotHeight = Math.max(320, maxCount * MIN_ROW_HEIGHT);
    const height = plotHeight + MARGIN.top + MARGIN.bottom;

    this.#svg.attr("width", width).attr("height", height).attr("viewBox", `0 0 ${width} ${height}`);

    const [minYear, maxYear] = this.#range;
    const x = d3
      .scaleLinear()
      .domain([minYear, maxYear + 1])
      .range([MARGIN.left, width - MARGIN.right]);

    // Counts, not event index — the top of a column is its event count.
    const y = d3
      .scaleLinear()
      .domain([0, maxCount])
      .range([MARGIN.top + plotHeight, MARGIN.top]);

    const bandWidth = x(minYear + 1) - x(minYear);

    this.#x = x;
    this.#y = y;
    this.#bandWidth = bandWidth;
    this.#rowHeight = Math.abs(y(1) - y(0));

    this.#drawGrid(width, y, maxCount);
    this.#drawArea(x, y, bandWidth);
    this.#drawDots(x, y, bandWidth);
    this.#drawAxes(width, height, x, y, plotHeight);
    this.#drawHitLayer(width, plotHeight);
    this.#applyHighlight();

    return this;
  }

  /**
   * A transparent rect over the plot that resolves the pointer to the nearest
   * dot. Individual 2.6px circles are far too small to hover reliably, and the
   * hit target should be bigger than the mark regardless. Keyboard users still
   * focus the circles directly.
   */
  #drawHitLayer(width, plotHeight) {
    const g = this.#svg.select(".layer-overlay");
    g.selectAll("*").remove();

    g.append("rect")
      .attr("class", "hit-layer")
      .attr("x", MARGIN.left)
      .attr("y", MARGIN.top)
      .attr("width", Math.max(0, width - MARGIN.left - MARGIN.right))
      .attr("height", plotHeight)
      .on("pointermove", (event) => {
        const [px, py] = d3.pointer(event);
        const hit = this.#findNearest(px, py);
        if (!hit) return this.#clearActive();

        if (hit.id !== this.#activeId) {
          this.#activeId = hit.id;
          this.#markActive();
        }
        this.#onHover(hit, { currentTarget: this.#dotNode(hit.id) });
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

  #dotNode(id) {
    return this.#svg.select(".layer-dots").selectAll("circle").filter((d) => d.id === id).node();
  }

  #clearActive() {
    if (this.#activeId === null) return;
    this.#activeId = null;
    this.#markActive();
    this.#onHover(null);
  }

  #markActive() {
    this.#svg
      .select(".layer-dots")
      .selectAll("circle")
      .classed("is-active", (d) => d.id === this.#activeId);
  }

  #drawGrid(width, y, maxCount) {
    const ticks = y.ticks(Math.min(6, maxCount));
    const g = this.#svg.select(".layer-grid");

    g.selectAll("line")
      .data(ticks)
      .join("line")
      .attr("class", "grid-line")
      .attr("x1", MARGIN.left)
      .attr("x2", width - MARGIN.right)
      .attr("y1", (d) => y(d))
      .attr("y2", (d) => y(d));
  }

  #drawArea(x, y, bandWidth) {
    // Sampled at column centres so the curve passes through the stack tops.
    const points = this.#bins.map((b) => ({ x: x(b.year) + bandWidth / 2, y: y(b.count) }));

    const area = d3
      .area()
      .x((d) => d.x)
      .y0(y(0))
      .y1((d) => d.y)
      .curve(d3.curveMonotoneX);

    const line = d3
      .line()
      .x((d) => d.x)
      .y((d) => d.y)
      .curve(d3.curveMonotoneX);

    const g = this.#svg.select(".layer-area");
    g.selectAll("path.density-area").data([points]).join("path")
      .attr("class", "density-area")
      .attr("d", area);
    g.selectAll("path.density-line").data([points]).join("path")
      .attr("class", "density-line")
      .attr("d", line);
  }

  #drawDots(x, y, bandWidth) {
    const events = this.#bins.flatMap((b) => b.events);
    const rowHeight = Math.abs(y(1) - y(0));

    this.#svg
      .select(".layer-dots")
      .selectAll("circle")
      .data(events, (d) => d.id)
      .join("circle")
      .attr("class", (d) => `event-dot${d.landmark ? " is-landmark" : ""}`)
      .attr("cx", (d) => x(d.year) + bandWidth / 2)
      // Centre each dot in its row: index 0 sits just above the baseline.
      .attr("cy", (d) => y(d.stackIndex) - rowHeight / 2)
      .attr("r", (d) => (d.landmark ? LANDMARK_RADIUS : DOT_RADIUS))
      // Pointer hits go through the overlay; focus stays on the marks so the
      // chart is still traversable by keyboard.
      .attr("tabindex", 0)
      .attr("role", "button")
      .attr("aria-label", (d) => `${d.year}: ${d.summary}`)
      .on("focus", (event, d) => this.#onHover(d, event))
      .on("blur", () => this.#onHover(null));
  }

  #drawAxes(width, height, x, y, plotHeight) {
    const g = this.#svg.select(".layer-axes");
    g.selectAll("*").remove();

    // Year axis, top.
    const yearAxis = d3.axisTop(x).tickFormat(d3.format("d")).tickSizeOuter(0);
    g.append("g")
      .attr("class", "axis axis-year")
      .attr("transform", `translate(0, ${MARGIN.top})`)
      .call(yearAxis);

    g.append("text")
      .attr("class", "axis-title")
      .attr("x", MARGIN.left)
      .attr("y", 16)
      .text("Year");

    // Stardate axis, bottom — only where a linear mapping exists.
    const epochX = x(STARDATE_EPOCH_YEAR);
    const baseline = MARGIN.top + plotHeight;

    const sdScale = d3
      .scaleLinear()
      .domain([yearToStardate(STARDATE_EPOCH_YEAR), yearToStardate(this.#range[1] + 1)])
      .range([epochX, width - MARGIN.right]);

    g.append("g")
      .attr("class", "axis axis-stardate")
      .attr("transform", `translate(0, ${baseline})`)
      .call(d3.axisBottom(sdScale).tickFormat(d3.format("d")).tickSizeOuter(0));

    // The pre-2323 stretch gets an explicit "no scale here" treatment rather
    // than being left blank, which would read as missing data.
    g.append("line")
      .attr("class", "axis-void")
      .attr("x1", MARGIN.left)
      .attr("x2", epochX)
      .attr("y1", baseline)
      .attr("y2", baseline);

    g.append("text")
      .attr("class", "axis-note")
      .attr("x", (MARGIN.left + epochX) / 2)
      .attr("y", baseline + 26)
      .attr("text-anchor", "middle")
      .text("stardates non-linear before 2323");

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
      .attr("transform", `translate(13, ${MARGIN.top + plotHeight / 2}) rotate(-90)`)
      .attr("text-anchor", "middle")
      .text("Events per year");
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
