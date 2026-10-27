/** Geometry for the readback line (DESIGN.md Shapes): 1px brass elbow routes. */

export interface LinePoint {
  x: number;
  y: number;
}

/**
 * The readback line: a quarter-ellipse elbow from the squiggle's underside to
 * the cited token, 1px brass with a 3px dot at each end. Returns the SVG
 * `d` attribute. `draw` (0..1) animates `stroke-dashoffset` against pathLength=1.
 */
export function elbowPath(from: LinePoint, to: LinePoint): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const r = Math.max(0, Math.min(20, Math.abs(dx) / 2, Math.abs(dy) / 2));
  if (r < 2) return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  const dir = dx >= 0 ? 1 : -1;
  const up = dy < 0;
  const sweep = dir > 0 === up ? 0 : 1;
  const cornerX = to.x - dir * r;
  const endY = up ? from.y - r : from.y + r;
  return [
    `M ${from.x} ${from.y}`,
    `H ${cornerX}`,
    `A ${r} ${r} 0 0 ${sweep} ${to.x} ${endY}`,
    `V ${to.y}`,
  ].join(' ');
}

/**
 * A two-elbow route (vertical, across, vertical) for layouts where the cited
 * token sits directly above or below the reply: it crosses in the gap between
 * the two blocks instead of through text.
 */
export function zPath(from: LinePoint, to: LinePoint, midY: number): string {
  const dx = to.x - from.x;
  const dirY = to.y >= from.y ? 1 : -1;
  const dirX = dx >= 0 ? 1 : -1;
  const r = Math.max(
    0,
    Math.min(10, Math.abs(dx) / 2, Math.abs(midY - from.y), Math.abs(to.y - midY)),
  );
  if (r < 2) return `M ${from.x} ${from.y} V ${to.y}`;
  const s1 = -dirY * dirX > 0 ? 1 : 0;
  const s2 = dirX * dirY > 0 ? 1 : 0;
  return [
    `M ${from.x} ${from.y}`,
    `V ${midY - dirY * r}`,
    `A ${r} ${r} 0 0 ${s1} ${from.x + dirX * r} ${midY}`,
    `H ${to.x - dirX * r}`,
    `A ${r} ${r} 0 0 ${s2} ${to.x} ${midY + dirY * r}`,
    `V ${to.y}`,
  ].join(' ');
}

/**
 * Horizontal, across, horizontal route through a vertical gutter at `midX`:
 * for two panes side by side, so the line crosses the gap instead of text.
 */
export function hvhPath(from: LinePoint, to: LinePoint, midX: number): string {
  const dirX = midX >= from.x ? 1 : -1;
  const dirY = to.y >= from.y ? 1 : -1;
  const r = Math.max(
    0,
    Math.min(10, Math.abs(midX - from.x), Math.abs(to.x - midX), Math.abs(to.y - from.y) / 2),
  );
  if (r < 2) return `M ${from.x} ${from.y} H ${to.x}`;
  const s1 = dirX * dirY > 0 ? 1 : 0;
  const s2 = -dirY * dirX > 0 ? 1 : 0;
  return [
    `M ${from.x} ${from.y}`,
    `H ${midX - dirX * r}`,
    `A ${r} ${r} 0 0 ${s1} ${midX} ${from.y + dirY * r}`,
    `V ${to.y - dirY * r}`,
    `A ${r} ${r} 0 0 ${s2} ${midX + dirX * r} ${to.y}`,
    `H ${to.x}`,
  ].join(' ');
}

/**
 * Down, left to a gutter, down the gutter, then right into the token: for a
 * stacked layout where the cited token sits below the reply. The run down the
 * left padding keeps the line off the thread's text until its last step.
 */
export function gutterPath(from: LinePoint, to: LinePoint, gapY: number, gutterX: number): string {
  const r = 6;
  return [
    `M ${from.x} ${from.y}`,
    `V ${gapY - r}`,
    `A ${r} ${r} 0 0 1 ${from.x - r} ${gapY}`,
    `H ${gutterX + r}`,
    `A ${r} ${r} 0 0 0 ${gutterX} ${gapY + r}`,
    `V ${to.y - r}`,
    `A ${r} ${r} 0 0 0 ${gutterX + r} ${to.y}`,
    `H ${to.x}`,
  ].join(' ');
}
