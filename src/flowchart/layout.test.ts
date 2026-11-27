import { describe, expect, it } from 'vitest';
import { autoLayoutChart } from './layout';
import { NODE_WIDTH, type ChartNode, type FlowchartProject, type NodeKind, type Port } from './model';

function chart(blocks: [string, NodeKind][], links: [string, string, Port?][]): FlowchartProject {
  return {
    id: 'layout-test', name: 'Layout test', routines: '',
    nodes: blocks.map(([id, kind]): ChartNode => ({ id, kind, text: id, x: 0, y: 0, dataType: 'INTEGER' })),
    edges: links.map(([from, to, port = 'next'], i) => ({ id: 'e' + i, from, to, port })),
  };
}

describe('balanced flowchart auto-layout', () => {
  it('places Yes and No symmetrically around the decision and centres the join', () => {
    const input = chart(
      [['start', 'start'], ['d', 'decision'], ['no', 'process'], ['yes', 'process'], ['join', 'output'], ['end', 'end']],
      [['start', 'd'], ['d', 'no', 'no'], ['d', 'yes', 'yes'], ['yes', 'join'], ['no', 'join'], ['join', 'end']],
    );
    const result = autoLayoutChart(input);
    const [start, d, no, yes, join, end] = result.nodes;
    expect(yes!.x).toBeLessThan(d!.x);
    expect(no!.x).toBeGreaterThan(d!.x);
    expect(d!.x - yes!.x).toBe(no!.x - d!.x);
    expect(yes!.y).toBe(no!.y);
    expect(no!.x - yes!.x).toBeGreaterThan(NODE_WIDTH);
    expect(join!.y).toBeGreaterThan(yes!.y);
    expect([start!.x, join!.x, end!.x]).toEqual([d!.x, d!.x, d!.x]);
    expect(result.edges).toEqual(input.edges);
    expect(autoLayoutChart(result)).toEqual(result);
  });

  it('keeps longer branch paths in their lanes until they merge', () => {
    const result = autoLayoutChart(chart(
      [['s', 'start'], ['d', 'decision'], ['l', 'process'], ['r', 'process'], ['l2', 'process'], ['join', 'output']],
      [['s', 'd'], ['d', 'l', 'yes'], ['d', 'r', 'no'], ['l', 'l2'], ['l2', 'join'], ['r', 'join']],
    ));
    const [, d, l, r, l2, join] = result.nodes;
    expect(l2!.x).toBe(l!.x);
    expect(join!.x).toBe(d!.x);
    expect(join!.x).toBe((l2!.x + r!.x) / 2);
    expect(join!.y).toBeGreaterThan(l2!.y);
  });

  it('keeps nested branches separated on the same layer', () => {
    const result = autoLayoutChart(chart(
      [['s', 'start'], ['outer', 'decision'], ['inner', 'decision'], ['r', 'process'], ['a', 'process'], ['b', 'process'], ['r2', 'process'], ['join', 'process'], ['end', 'end']],
      [['s', 'outer'], ['outer', 'inner', 'yes'], ['outer', 'r', 'no'], ['inner', 'a', 'yes'], ['inner', 'b', 'no'], ['r', 'r2'], ['a', 'join'], ['b', 'join'], ['join', 'end'], ['r2', 'end']],
    ));
    const [, outer, inner, r, a, b, r2, join, end] = result.nodes;
    expect(inner!.x).toBeLessThan(outer!.x);
    expect(r!.x).toBeGreaterThan(outer!.x);
    expect(a!.y).toBe(r2!.y);
    expect(b!.x - a!.x).toBeGreaterThan(NODE_WIDTH);
    expect(r2!.x - b!.x).toBeGreaterThan(NODE_WIDTH);
    expect(join!.x).toBeCloseTo((a!.x + b!.x) / 2, 0);
    expect(end!.y).toBeGreaterThan(join!.y);
  });

  it('keeps the loop header above its body regardless of node ordering', () => {
    const input = chart(
      [['body', 'process'], ['end', 'end'], ['d', 'decision'], ['start', 'start']],
      [['start', 'd'], ['d', 'body', 'yes'], ['body', 'd'], ['d', 'end', 'no']],
    );
    const result = autoLayoutChart(input);
    const [body, end, d, start] = result.nodes;
    expect(start!.y).toBeLessThan(d!.y);
    expect(d!.y).toBeLessThan(body!.y);
    expect(d!.y).toBeLessThan(end!.y);
    expect(body!.x).toBeLessThan(d!.x);
    expect(end!.x).toBeGreaterThan(d!.x);
    expect(result.edges).toEqual(input.edges);
  });

  it('centres every split and merge in a 100-block stress test', () => {
    const blocks: [string, NodeKind][] = [['start', 'start']];
    const links: [string, string, Port?][] = [];
    let prev = 'start';
    for (let i = 0; i < 24; i++) {
      const d = 'd' + i, l = 'l' + i, r = 'r' + i, j = 'j' + i;
      blocks.push([d, 'decision'], [l, 'process'], [r, 'process'], [j, 'output']);
      links.push([prev, d], [d, l, 'yes'], [d, r, 'no'], [l, j], [r, j]);
      prev = j;
    }
    blocks.push(['out1', 'output'], ['out2', 'output'], ['end', 'end']);
    links.push([prev, 'out1'], ['out1', 'out2'], ['out2', 'end']);
    const result = autoLayoutChart(chart(blocks, links));
    expect(result.nodes).toHaveLength(100);
    const nodes = new Map(result.nodes.map(node => [node.id, node]));
    const centre = nodes.get('start')!.x;
    for (let i = 0; i < 24; i++) {
      expect(nodes.get('d' + i)!.x).toBe(centre);
      expect(nodes.get('j' + i)!.x).toBe(centre);
      expect(nodes.get('l' + i)!.x + nodes.get('r' + i)!.x).toBe(2 * centre);
    }
    expect(result.nodes.every(node => node.x >= 0 && node.x <= 10000 && node.y >= 0 && node.y <= 10000)).toBe(true);
  });
});
