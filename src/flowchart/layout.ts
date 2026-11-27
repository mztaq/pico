import type { FlowchartProject } from './model';

const X_GAP = 360;
const Y_GAP = 156;
const LEFT = 64;
const TOP = 48;

// Find the closest ordered positions to the preferred coordinates while
// maintaining separation. Pool adjacent conflicting groups rather than
// shifting every branch to the right.
function separate(preferred: number[], gap: number): number[] {
  const groups: { start: number; end: number; sum: number; count: number }[] = [];
  preferred.forEach((x, index) => {
    groups.push({ start: index, end: index, sum: x - index * gap, count: 1 });
    while (groups.length > 1) {
      const right = groups[groups.length - 1]!;
      const left = groups[groups.length - 2]!;
      if (left.sum / left.count <= right.sum / right.count) break;
      groups.splice(groups.length - 2, 2, {
        start: left.start, end: right.end,
        sum: left.sum + right.sum, count: left.count + right.count,
      });
    }
  });
  const result: number[] = [];
  for (const group of groups) {
    for (let i = group.start; i <= group.end; i++) result[i] = group.sum / group.count + i * gap;
  }
  return result;
}

/** Centre linear paths, split Yes/No symmetrically and centre their joins. */
export function autoLayoutChart(project: FlowchartProject): FlowchartProject {
  if (project.nodes.length < 2) return project;

  const byId = new Map(project.nodes.map(node => [node.id, node]));
  const order = new Map(project.nodes.map((node, i) => [node.id, i]));
  const incoming = new Map(project.nodes.map(node => [node.id, [] as typeof project.edges]));
  const outgoing = new Map(project.nodes.map(node => [node.id, [] as typeof project.edges]));
  for (const edge of project.edges) {
    if (!byId.has(edge.from) || !byId.has(edge.to)) continue;
    incoming.get(edge.to)!.push(edge);
    outgoing.get(edge.from)!.push(edge);
  }
  const portOrder = { yes: 0, next: 1, no: 2 };
  for (const edges of outgoing.values()) edges.sort((a, b) => portOrder[a.port] - portOrder[b.port]);

  // Ignore DFS back-edges for placement only. Start at entry blocks so
  // a loop's return edge does not place its header below the loop body.
  const visiting = new Set<string>(), visited = new Set<string>(), feedback = new Set<string>();
  function visit(id: string) {
    if (visited.has(id)) return;
    visiting.add(id);
    for (const edge of outgoing.get(id)!) {
      if (visiting.has(edge.to)) feedback.add(edge.id);
      else visit(edge.to);
    }
    visiting.delete(id);
    visited.add(id);
  }
  for (const node of project.nodes) if (node.kind === 'start') visit(node.id);
  for (const node of project.nodes) if (!incoming.get(node.id)!.length) visit(node.id);
  for (const node of project.nodes) visit(node.id);

  const parents = (id: string) => incoming.get(id)!.filter(edge => !feedback.has(edge.id));
  const ranks = new Map<string, number>();
  function rank(id: string): number {
    const known = ranks.get(id);
    if (known !== undefined) return known;
    let value = 0;
    for (const edge of parents(id)) value = Math.max(value, rank(edge.from) + 1);
    ranks.set(id, value);
    return value;
  }
  const layers = new Map<number, string[]>();
  for (const node of project.nodes) {
    const level = rank(node.id);
    const layer = layers.get(level) ?? [];
    layer.push(node.id);
    layers.set(level, layer);
  }
  const levels = [...layers.keys()].sort((a, b) => a - b);
  const maxRank = Math.max(0, ...levels);
  const yGap = Math.min(Y_GAP, maxRank > 0 ? 9900 / maxRank : Y_GAP);
  const xPositions = new Map<string, number>();
  for (const level of levels) {
    const desired = layers.get(level)!.map((id, index) => {
      const edges = parents(id);
      const x = edges.length ? edges.reduce((sum, edge) => {
        const parentX = xPositions.get(edge.from)!;
        const shift = edge.port === 'yes' ? -X_GAP / 2 : edge.port === 'no' ? X_GAP / 2 : 0;
        return sum + parentX + shift;
      }, 0) / edges.length : index * X_GAP;
      return { id, x };
    }).sort((a, b) => a.x - b.x || order.get(a.id)! - order.get(b.id)!);
    const placed = separate(desired.map(node => node.x), X_GAP);
    desired.forEach((node, index) => xPositions.set(node.id, placed[index]!));
  }

  // Translate the entire graph once, preserving the relative centre lines.
  // Respect the persisted coordinate range for exceptionally wide charts.
  const minX = Math.min(...xPositions.values());
  const maxX = Math.max(...xPositions.values());
  const scaleX = maxX > minX ? Math.min(1, 9800 / (maxX - minX)) : 1;
  return {
    ...project,
    nodes: project.nodes.map(node => ({
      ...node,
      x: Math.round(LEFT + (xPositions.get(node.id)! - minX) * scaleX),
      y: Math.round(TOP + ranks.get(node.id)! * yGap),
    })),
  };
}
