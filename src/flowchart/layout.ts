import type { FlowchartProject } from './model';

const X_GAP = 300;
const Y_GAP = 156;
const LEFT = 64;
const TOP = 48;

/** Arrange connected blocks in top-to-bottom layers, keeping decision branches together. */
export function autoLayoutChart(project: FlowchartProject): FlowchartProject {
  if (project.nodes.length < 2) return project;

  const byId = new Map(project.nodes.map(node => [node.id, node]));
  const incoming = new Map(project.nodes.map(node => [node.id, [] as typeof project.edges]));
  for (const edge of project.edges) {
    if (byId.has(edge.from) && byId.has(edge.to)) incoming.get(edge.to)!.push(edge);
  }

  // Longest-parent ranks place joins below both branches. A visited set breaks cycles
  // so feedback connections stay as return edges instead of expanding forever.
  const ranks = new Map<string, number>();
  const visiting = new Set<string>();
  function rank(id: string): number {
    const known = ranks.get(id);
    if (known !== undefined) return known;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    let value = 0;
    for (const edge of incoming.get(id) ?? []) {
      if (!visiting.has(edge.from)) value = Math.max(value, rank(edge.from) + 1);
    }
    visiting.delete(id);
    ranks.set(id, value);
    return value;
  }
  project.nodes.forEach(node => rank(node.id));

  const layers = new Map<number, string[]>();
  for (const node of project.nodes) {
    const level = ranks.get(node.id) ?? 0;
    const layer = layers.get(level) ?? [];
    layer.push(node.id);
    layers.set(level, layer);
  }

  // Sort each layer by the position of its parent; Yes stays to the left of No.
  const levelNumbers = [...layers.keys()].sort((a, b) => a - b);
  for (let i = 1; i < levelNumbers.length; i += 1) {
    const level = levelNumbers[i]!;
    const previous = layers.get(levelNumbers[i - 1]!)!;
    const previousIndex = new Map(previous.map((id, index) => [id, index]));
    layers.get(level)!.sort((a, b) => {
      const score = (id: string) => {
        const parents = (incoming.get(id) ?? []).filter(edge => ranks.get(edge.from)! < level && previousIndex.has(edge.from));
        if (!parents.length) return project.nodes.findIndex(node => node.id === id) + previous.length;
        return parents.reduce((sum, edge) => sum + previousIndex.get(edge.from)! + (edge.port === 'yes' ? -0.2 : edge.port === 'no' ? 0.2 : 0), 0) / parents.length;
      };
      return score(a) - score(b) || project.nodes.findIndex(node => node.id === a) - project.nodes.findIndex(node => node.id === b);
    });
  }

  const maxRank = Math.max(0, ...levelNumbers);
  const maxWidth = Math.max(...[...layers.values()].map(layer => layer.length));
  const xGap = Math.min(X_GAP, maxWidth > 1 ? 9800 / (maxWidth - 1) : X_GAP);
  const yGap = Math.min(Y_GAP, maxRank > 0 ? 9900 / maxRank : Y_GAP);
  const positions = new Map<string, { x: number; y: number }>();
  for (const level of levelNumbers) {
    layers.get(level)!.forEach((id, index) => positions.set(id, {
      x: Math.round(LEFT + index * xGap),
      y: Math.round(TOP + level * yGap),
    }));
  }
  return { ...project, nodes: project.nodes.map(node => ({ ...node, ...positions.get(node.id) })) };
}
