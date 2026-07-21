/**
 * Hover tooltip for individual events.
 *
 * Date and stardate are optional on most events — only ~40 and ~90 of 1,533
 * carry them — so every field degrades rather than rendering an empty row.
 * Dates are also variable-precision ("2364-03-15" or "2364-03") and are
 * formatted to whatever precision is actually present.
 */

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatDate(iso) {
  if (!iso) return null;
  const [year, month, day] = iso.split("-");
  if (!month) return year;
  const name = MONTHS[Number(month) - 1];
  return day ? `${name} ${Number(day)}, ${year}` : `${name} ${year}`;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export class Tooltip {
  #node;

  constructor(parent) {
    this.#node = el("div", "tooltip");
    this.#node.setAttribute("role", "tooltip");
    this.#node.hidden = true;
    parent.appendChild(this.#node);
  }

  hide() {
    this.#node.hidden = true;
  }

  show(event, target) {
    const n = this.#node;
    n.replaceChildren();

    const head = el("div", "tooltip-head");
    head.appendChild(el("span", "tooltip-year", String(event.year)));
    if (event.timeline !== "prime") {
      head.appendChild(el("span", `tooltip-timeline t-${event.timeline}`, event.timeline));
    }
    if (event.landmark) head.appendChild(el("span", "tooltip-landmark", "landmark"));
    n.appendChild(head);

    n.appendChild(el("p", "tooltip-summary", event.summary));

    const meta = el("dl", "tooltip-meta");
    const row = (label, value) => {
      if (!value) return;
      meta.appendChild(el("dt", null, label));
      meta.appendChild(el("dd", null, value));
    };
    row("Date", formatDate(event.date));
    row("Stardate", event.stardate);
    row("Location", event.group);
    if (meta.childElementCount) n.appendChild(meta);

    if (event.episodes.length) {
      const list = el("ul", "tooltip-episodes");
      for (const ep of event.episodes) {
        const item = el("li");
        item.appendChild(el("span", "badge", ep.series));
        item.appendChild(el("span", "episode-title", ep.title));
        list.appendChild(item);
      }
      n.appendChild(list);
    }

    n.hidden = false;
    this.#position(target);
  }

  /** Keep the tooltip inside the viewport, flipping sides near the edges. */
  #position(target) {
    const n = this.#node;
    const dot = target.getBoundingClientRect();
    const box = n.getBoundingClientRect();
    const pad = 12;

    let left = dot.left + dot.width / 2 - box.width / 2;
    left = Math.max(pad, Math.min(left, window.innerWidth - box.width - pad));

    let top = dot.top - box.height - pad;
    if (top < pad) top = dot.bottom + pad;

    n.style.left = `${left + window.scrollX}px`;
    n.style.top = `${top + window.scrollY}px`;
  }
}
