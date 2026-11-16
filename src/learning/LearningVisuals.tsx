import { useState } from 'react';

export const visualizedTopics = new Set(['number-systems', 'text-media', 'transmission']);

export function LearningVisual({ topicId }: { topicId: string }) {
  if (topicId === 'number-systems') return <BinaryModel />;
  if (topicId === 'text-media') return <SoundModel />;
  if (topicId === 'transmission') return <PacketModel />;
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

function PacketModel() {
  const [stage, setStage] = useState<'ready' | 'arrived' | 'assembled'>('ready');
  const packets = [{ number: 1, data: 'PI' }, { number: 2, data: 'CO' }, { number: 3, data: '!' }];
  const received = [packets[1], packets[0], packets[2]];
  return <div className="learning-model" aria-label="Interactive packet reassembly model">
    <p>A message is split into numbered packets. They may arrive in a different order; the receiver uses their numbers to rebuild it.</p>
    <div className="learning-packet-flow"><div><h4>Sender</h4><div className="learning-packet-row">{packets.map(packet => <span className="learning-packet" key={packet.number}><small>#{packet.number}</small>{packet.data}</span>)}</div></div><span className="learning-packet-arrow" aria-hidden="true">→</span><div><h4>Receiver</h4><div className="learning-packet-row" aria-live="polite">{stage === 'ready' ? <span className="learning-packet-placeholder">Waiting for packets</span> : (stage === 'arrived' ? received : packets).map(packet => <span className="learning-packet" key={packet.number}><small>#{packet.number}</small>{packet.data}</span>)}</div></div></div>
    <div className="learning-packet-detail"><span>Example packet #2</span><div><b>Header</b> source · destination · #2</div><div><b>Payload</b> CO</div></div>
    <div className="learning-actions"><button type="button" className="learning-secondary" onClick={() => setStage(stage === 'ready' ? 'arrived' : stage === 'arrived' ? 'assembled' : 'ready')}>{stage === 'ready' ? 'Send packets' : stage === 'arrived' ? 'Reassemble by number' : 'Reset model'}</button><span className="learning-packet-status" role="status">{stage === 'arrived' ? 'Arrival order: 2, 1, 3' : stage === 'assembled' ? 'Rebuilt message: PICO!' : 'Message: PICO!'}</span></div>
  </div>;
}
