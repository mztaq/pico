import { NODE_WIDTH, nodeHeight, type CircuitDocument } from './model';

const LEFT = 64;
const TOP = 48;
const X_GAP = 240;
const Y_GAP = 136;

/** Arrange circuit components from signal sources to their downstream consumers. */
export function autoLayoutCircuit(doc: CircuitDocument): CircuitDocument {
  if (doc.nodes.length < 2) return doc;

  const byId = new Map(doc.nodes.map(node => [node.id, node]));
  const incoming = new Map(doc.nodes.map(node => [node.id, [] as typeof doc.wires]));
  for (const wire of doc.wires) {
    if (byId.has(wire.from) && byId.has(wire.to)) incoming.get(wire.to)!.push(wire);
  }

  // Longest-parent ranks keep joins downstream. Ignore a back-edge while walking
  // a cycle so feedback circuits still get a finite, repeatable arrangement.
  const ranks = new Map<string, number>();
  const visiting = new Set<string>();
  function rank(id: string): number {
    const known = ranks.get(id);
    if (known !== undefined) return known;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    let value = 0;
    for (const wire of incoming.get(id) ?? []) {
      if (!visiting.has(wire.from)) value = Math.max(value, rank(wire.from) + 1);
    }
    visiting.delete(id);
    ranks.set(id, value);
    return value;
  }
  doc.nodes.forEach(node => rank(node.id));

  const layers = new Map<number, string[]>();
  for (const node of doc.nodes) {
    const level = ranks.get(node.id) ?? 0;
    const layer = layers.get(level) ?? [];
    layer.push(node.id);
    layers.set(level, layer);
  }

  const levels = [...layers.keys()].sort((a, b) => a - b);
  // Keep branches from a shared parent close together and retain source ordering
  // for disconnected components, labels, and feedback-only nodes.
  for (let i = 1; i < levels.length; i += 1) {
    const level = levels[i]!;
    const previous = layers.get(levels[i - 1]!)!;
    const previousIndex = new Map(previous.map((id, index) => [id, index]));
    layers.get(level)!.sort((a, b) => {
      const score = (id: string) => {
        const parents = (incoming.get(id) ?? []).filter(wire => (ranks.get(wire.from) ?? 0) < level && previousIndex.has(wire.from));
        if (!parents.length) return doc.nodes.findIndex(node => node.id === id) + previous.length;
        return parents.reduce((sum, wire) => sum + previousIndex.get(wire.from)!, 0) / parents.length;
      };
      return score(a) - score(b) || doc.nodes.findIndex(node => node.id === a) - doc.nodes.findIndex(node => node.id === b);
    });
  }

  const maxRank = Math.max(...levels);
  const maxRows = Math.max(...[...layers.values()].map(layer => layer.length));
  const xGap = Math.min(X_GAP, maxRank > 0 ? 98000 / maxRank : X_GAP);
  const yGap = Math.min(Y_GAP, maxRows > 1 ? 98000 / (maxRows - 1) : Y_GAP);
  const positions = new Map<string, { x: number; y: number }>();
  for (const level of levels) {
    layers.get(level)!.forEach((id, index) => {
      positions.set(id, { x: Math.round(LEFT + level * xGap), y: Math.round(TOP + index * yGap) });
    });
  }

  return {
    ...doc,
    nodes: doc.nodes.map(node => {
      const position = positions.get(node.id)!;
      // Avoid placing the footprint of long multi-pin components beyond the
      // persisted canvas bounds, even for unusually large imported circuits.
      const maxX = Math.max(LEFT, 99900 - NODE_WIDTH);
      const maxY = Math.max(TOP, 99900 - nodeHeight(node));
      return { ...node, x: Math.min(position.x, maxX), y: Math.min(position.y, maxY) };
    }),
  };
}

