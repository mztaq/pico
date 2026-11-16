import { useMemo, useState } from 'react';

export const visualizedTopics = new Set(['number-systems', 'text-media', 'transmission', 'error-detection']);

export function LearningVisual({ topicId }: { topicId: string }) {
  if (topicId === 'number-systems') return <BinaryModel />;
  if (topicId === 'text-media') return <SoundModel />;
  if (topicId === 'transmission') return <PacketNetworkModel />;
  if (topicId === 'error-detection') return <ParityModel />;
  return null;
}

function BinaryModel() {
  const [value, setValue] = useState(45);
  const weights = [128, 64, 32, 16, 8, 4, 2, 1];
  return <div className="learning-model" aria-label="Interactive eight-bit number">
    <p>Switch a bit on or off. Add the values above the active bits to get the denary number.</p>
    <div className="learning-bits">{weights.map(weight => <div key={weight}><small>{weight}</small><button type="button" aria-pressed={Boolean(value & weight)} aria-label={`Bit worth ${weight}`} onClick={() => setValue(current => current ^ weight)}>{value & weight ? '1' : '0'}</button></div>)}</div>
    <div className="learning-model-readout"><span>Binary <strong>{value.toString(2).padStart(8, '0')}</strong></span><span>Denary <strong>{value}</strong></span><span>Hex <strong>{value.toString(16).toUpperCase().padStart(2, '0')}</strong></span></div>
  </div>;
}

function SoundModel() {
  const [count, setCount] = useState(8);
  const [bits, setBits] = useState(3);
  const waveY = (x: number) => 70 - Math.sin(x / 360 * Math.PI * 3) * 43;
  const samples = Array.from({ length: count }, (_, index) => {
    const x = index * 360 / count;
    const normalized = (70 - waveY(x)) / 86 + .5;
    const level = Math.round(normalized * ((1 << bits) - 1));
    return { x, level, y: 70 - (level / ((1 << bits) - 1) - .5) * 86 };
  });
  const analogue = Array.from({ length: 181 }, (_, index) => `${index ? 'L' : 'M'} ${index * 2} ${waveY(index * 2).toFixed(1)}`).join(' ');
  const digital = samples.map((sample, index) => `${index ? `V ${sample.y.toFixed(1)}` : `M ${sample.x} ${sample.y.toFixed(1)}`} H ${((index + 1) * 360 / count).toFixed(1)}`).join(' ');
  return <div className="learning-model" aria-label="Interactive sound sampling model">
    <p>The smooth line represents an analogue wave. The dots are samples; the steps show a simplified reconstruction from their values. This model does not play audio.</p>
    <svg className="learning-sound-chart" viewBox="0 0 360 140" role="img" aria-label={`Analogue wave and ${count} digital samples at ${bits} bits each`}>
      <path className="learning-analogue-line" d={analogue} /><path className="learning-digital-line" d={digital} />
      {samples.map((sample, index) => <circle key={index} cx={sample.x} cy={sample.y} r="3.5" />)}
    </svg>
    <div className="learning-sound-legend"><span>— Analogue wave</span><span>— Digital samples</span></div>
    <div className="learning-model-controls"><label>Samples in this window <strong>{count}</strong><input type="range" min="4" max="20" step="4" value={count} onChange={event => setCount(Number(event.target.value))} /></label><label>Bits per sample <strong>{bits}</strong><input type="range" min="2" max="5" step="1" value={bits} onChange={event => setBits(Number(event.target.value))} /></label></div>
    <p className="learning-model-note">For one channel, these {count} sample values need {count * bits} bits before any file format overhead. More samples or more bits per sample increase the amount stored.</p>
  </div>;
}

type Node = { id: string; label: string; x: number; y: number; fixed?: boolean };
const NODES: Node[] = [
  { id: 'S', label: 'Sender', x: 7, y: 50, fixed: true },
  { id: 'R1', label: 'R1', x: 28, y: 24 },
  { id: 'R2', label: 'R2', x: 28, y: 76 },
  { id: 'R3', label: 'R3', x: 50, y: 10 },
  { id: 'R4', label: 'R4', x: 50, y: 50 },
  { id: 'R5', label: 'R5', x: 50, y: 90 },
  { id: 'R6', label: 'R6', x: 72, y: 24 },
  { id: 'R7', label: 'R7', x: 72, y: 76 },
  { id: 'REC', label: 'Receiver', x: 93, y: 50, fixed: true },
];
const EDGES: [string, string][] = [
  ['S', 'R1'], ['S', 'R2'],
  ['R1', 'R3'], ['R1', 'R4'],
  ['R2', 'R4'], ['R2', 'R5'],
  ['R3', 'R4'], ['R4', 'R5'],
  ['R3', 'R6'], ['R4', 'R6'], ['R4', 'R7'], ['R5', 'R7'],
  ['R6', 'R7'],
  ['R6', 'REC'], ['R7', 'REC'],
];
// Routing only follows an edge sender-to-receiver-wards, so paths move forward and stay readable.
function forwardNeighboursOf(id: string) {
  return EDGES.filter(([a]) => a === id).map(([, b]) => b);
}

function findAllRoutes(broken: Set<string>): string[][] {
  const routes: string[][] = [];
  const walk = (current: string, path: string[]) => {
    if (current === 'REC') { routes.push(path); return; }
    if (path.length > NODES.length) return;
    for (const next of forwardNeighboursOf(current)) {
      if (path.includes(next)) continue;
      if (next !== 'REC' && broken.has(next)) continue;
      walk(next, [...path, next]);
    }
  };
  walk('S', ['S']);
  return routes;
}

type SentPacket = { number: number; data: string; route: string[] | null };

function PacketNetworkModel() {
  const [message, setMessage] = useState('HELLO PICO');
  const [size, setSize] = useState(3);
  const [broken, setBroken] = useState<Set<string>>(new Set());
  const [sent, setSent] = useState<SentPacket[] | null>(null);
  const [assembled, setAssembled] = useState(false);

  const routes = useMemo(() => findAllRoutes(broken), [broken]);

  function toggleRouter(id: string) {
    setBroken(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function send() {
    const text = message.trim();
    if (!text) return;
    const chunkSize = Math.max(1, size);
    const chunks: string[] = [];
    for (let index = 0; index < text.length; index += chunkSize) chunks.push(text.slice(index, index + chunkSize));
    const available = findAllRoutes(broken);
    const packets: SentPacket[] = chunks.map((data, index) => ({
      number: index + 1,
      data,
      route: available.length ? available[index % available.length] : null,
    }));
    setSent(packets);
    setAssembled(false);
  }

  function reset() {
    setSent(null);
    setAssembled(false);
  }

  const arrival = sent ? [...sent].filter(packet => packet.route).sort((a, b) => {
    const costA = a.route!.length, costB = b.route!.length;
    return costA - costB || a.number - b.number;
  }) : [];
  const lost = sent ? sent.filter(packet => !packet.route) : [];
  const rebuilt = sent ? [...sent].sort((a, b) => a.number - b.number).map(packet => packet.route ? packet.data : '␀').join('') : '';

  return <div className="learning-model" aria-label="Interactive packet-switching network">
    <p>A message is split into numbered packets. Routers forward each packet independently, so packets can take different routes and arrive in a different order than they were sent. Click a router to break or repair it and see how the network reacts.</p>
    <div className="learning-packet-controls">
      <label>Message<input type="text" value={message} maxLength={40} onChange={event => setMessage(event.target.value)} /></label>
      <label>Characters per packet<input type="number" min={1} max={8} value={size} onChange={event => setSize(Math.max(1, Math.min(8, Number(event.target.value) || 1)))} /></label>
      <button type="button" className="learning-primary" onClick={send}>Send message</button>
    </div>
    <div className="learning-packet-net" role="group" aria-label="Network diagram. Click a router to break or repair it.">
      <svg className="learning-packet-net-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {EDGES.map(([a, b], index) => {
          const from = NODES.find(node => node.id === a)!, to = NODES.find(node => node.id === b)!;
          const blocked = (!from.fixed && broken.has(from.id)) || (!to.fixed && broken.has(to.id));
          return <line key={index} x1={from.x} y1={from.y} x2={to.x} y2={to.y} className={blocked ? 'is-blocked' : ''} />;
        })}
      </svg>
      {NODES.map(node => node.fixed
        ? <div key={node.id} className="learning-packet-net-endpoint" style={{ left: `${node.x}%`, top: `${node.y}%` }}>{node.label}</div>
        : <button key={node.id} type="button" className="learning-packet-net-router" style={{ left: `${node.x}%`, top: `${node.y}%` }} aria-pressed={broken.has(node.id)} aria-label={`${node.label}, ${broken.has(node.id) ? 'broken — click to repair' : 'working — click to break'}`} onClick={() => toggleRouter(node.id)}>{node.label}</button>)}
    </div>
    <div className="learning-packet-net-legend"><span className="is-ok">● Working router</span><span className="is-broken">● Broken router</span><span>{routes.length} route{routes.length === 1 ? '' : 's'} currently open to the receiver</span></div>
    <div className="learning-packet-logs">
      <div className="learning-packet-log" aria-live="polite">
        <h4>Packets sent</h4>
        {sent ? <ul>{sent.map(packet => <li key={packet.number}><span className="learning-packet"><small>#{packet.number}</small>{packet.data}</span>{packet.route ? <code>{packet.route.join(' → ')}</code> : <em>no route available — packet dropped</em>}</li>)}</ul> : <p className="learning-packet-placeholder">Send a message to see its packets.</p>}
      </div>
      <div className="learning-packet-log" aria-live="polite">
        <h4>Order of arrival</h4>
        {sent ? (arrival.length ? <ol>{arrival.map(packet => <li key={packet.number}>Packet #{packet.number} <span>({packet.route!.length} hop{packet.route!.length === 1 ? '' : 's'})</span></li>)}</ol> : <p className="learning-packet-placeholder">No packets arrived — every route is blocked.</p>) : <p className="learning-packet-placeholder">Not sent yet.</p>}
        {Boolean(sent && lost.length) && <p className="learning-packet-lost">Packet{lost.length === 1 ? '' : 's'} {lost.map(packet => `#${packet.number}`).join(', ')} never arrived. The receiver would need to ask for {lost.length === 1 ? 'it' : 'them'} again.</p>}
      </div>
    </div>
    <div className="learning-actions">
      <button type="button" className="learning-secondary" disabled={!sent} onClick={() => setAssembled(value => !value)}>{assembled ? 'Hide reassembled message' : 'Reassemble by packet number'}</button>
      <button type="button" className="learning-secondary" onClick={reset}>Reset</button>
      {assembled && <span className="learning-packet-status" role="status">Rebuilt message: {rebuilt}</span>}
    </div>
  </div>;
}

type ParityFault = 'none' | 'single' | 'double';
const SINGLE_FLIP = [2];
const DOUBLE_FLIP = [1, 4];

function ParityModel() {
  const [bits, setBits] = useState([1, 0, 1, 1, 0, 1, 0]);
  const [fault, setFault] = useState<ParityFault>('none');
  const parity = bits.reduce((total, bit) => total + bit, 0) % 2;
  const byte = [...bits, parity];
  const flipped = fault === 'single' ? SINGLE_FLIP : fault === 'double' ? DOUBLE_FLIP : [];
  const received = byte.map((bit, index) => (flipped.includes(index) ? bit ^ 1 : bit));
  const receivedOnes = received.reduce((total, bit) => total + bit, 0);

  function toggleBit(index: number) {
    setBits(current => current.map((bit, bitIndex) => (bitIndex === index ? bit ^ 1 : bit)));
    setFault('none');
  }

  return <div className="learning-model" aria-label="Interactive even-parity model">
    <p>Toggle the seven data bits below. The parity bit is set automatically so the whole byte always contains an even number of 1s before it is sent.</p>
    <div className="learning-bits learning-parity-bits">
      {bits.map((bit, index) => <div key={index}><small>D{index + 1}</small><button type="button" aria-pressed={Boolean(bit)} aria-label={`Data bit ${index + 1}, currently ${bit}`} onClick={() => toggleBit(index)}>{bit}</button></div>)}
      <div className="learning-parity-bit"><small>Parity</small><span aria-label={`Parity bit, ${parity}`}>{parity}</span></div>
    </div>
    <div className="learning-model-readout"><span>Byte sent <strong>{byte.join('')}</strong></span><span>1s in byte <strong>{byte.reduce((total, bit) => total + bit, 0)} (even)</strong></span></div>
    <div className="learning-actions">
      <button type="button" className="learning-secondary" aria-pressed={fault === 'single'} onClick={() => setFault('single')}>Simulate a single-bit error</button>
      <button type="button" className="learning-secondary" aria-pressed={fault === 'double'} onClick={() => setFault('double')}>Simulate a two-bit error</button>
      <button type="button" className="learning-secondary" disabled={fault === 'none'} onClick={() => setFault('none')}>Clear error</button>
    </div>
    <div className="learning-model-readout">
      <span>Byte received <strong>{received.join('')}</strong></span>
      <span>1s received <strong>{receivedOnes} ({receivedOnes % 2 === 0 ? 'even' : 'odd'})</strong></span>
    </div>
    <p className="learning-model-note" role="status">
      {fault === 'none' && 'No error simulated yet — the received byte matches the sent byte.'}
      {fault === 'single' && `Parity check fails: bit ${SINGLE_FLIP[0] + 1} changed in transit, so the received byte has an odd number of 1s. The receiver can tell an error occurred, even though it cannot tell which bit to fix.`}
      {fault === 'double' && 'Parity check passes, but two bits actually changed in transit. A simple parity check only counts 1s, so an even number of flipped bits can slip through undetected — this is why it only detects errors; it cannot guarantee to find every one.'}
    </p>
  </div>;
}
