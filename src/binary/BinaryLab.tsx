import { useEffect, useState, type CSSProperties } from 'react';
import { ArrowLeft, ArrowLeftCircle, ArrowRightCircle, Plus, RotateCcw, Settings2, X } from 'lucide-react';
import { ThemePicker } from '../app/components/ThemePicker';
import { cssVariables, getTheme } from '../app/themes';
import { loadSettings, saveSettings } from '../storage/settings';
import { addBytes, binary8, groupedBinary, hex2, negateByte, parseByteDecimal, parseByteHex, shiftByte, signed8, toggleBit } from './operations';
import './binary.css';

const STORAGE = 'pico.binary-lab.byte.v1';
const WEIGHTS = [128, 64, 32, 16, 8, 4, 2, 1];

function savedByte(): number {
  try {
    const saved = localStorage.getItem(STORAGE);
    if (saved === null) return 42;
    const value = Number(saved);
    return Number.isInteger(value) && value >= 0 && value <= 255 ? value : 42;
  } catch { return 42; }
}

type Feedback = { title: string; detail: string; before: number; after: number; flags?: string[] };

export function BinaryLab({ onHome }: { onHome: () => void }) {
  const [value, setValue] = useState(savedByte);
  const [decimalDraft, setDecimalDraft] = useState(() => String(value));
  const [hexDraft, setHexDraft] = useState(() => hex2(value));
  const [operandDraft, setOperandDraft] = useState('1');
  const [places, setPlaces] = useState(1);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [themeId, setThemeId] = useState(() => loadSettings().theme);
  const [themeOpen, setThemeOpen] = useState(false);
  const theme = getTheme(themeId);
  const operand = parseByteDecimal(operandDraft);
  const flipped = value ^ 0xff;
  const negated = negateByte(value);

  useEffect(() => {
    try { localStorage.setItem(STORAGE, String(value)); } catch { /* The lab remains usable without storage. */ }
  }, [value]);
  useEffect(() => {
    try { saveSettings({ ...loadSettings(), theme: themeId }); } catch { /* Theme still applies to this session. */ }
    for (const [property, colour] of Object.entries(cssVariables(theme))) document.documentElement.style.setProperty(property, colour);
    document.documentElement.style.colorScheme = theme.appearance;
  }, [theme, themeId]);

  function setRegister(next: number, result: Feedback | null = null) {
    setValue(next);
    setDecimalDraft(String(next));
    setHexDraft(hex2(next));
    setFeedback(result);
  }

  function changeDecimal(raw: string) {
    setDecimalDraft(raw);
    const next = parseByteDecimal(raw);
    if (next !== null) { setValue(next); setHexDraft(hex2(next)); setFeedback(null); }
  }

  function changeHex(raw: string) {
    setHexDraft(raw.toUpperCase());
    const next = parseByteHex(raw);
    if (next !== null) { setValue(next); setDecimalDraft(String(next)); setFeedback(null); }
  }

  function flip(position: number) {
    const before = value;
    const after = toggleBit(value, position);
    const weight = 1 << position;
    setRegister(after, {
      title: `Bit ${position} turned ${after & weight ? 'on' : 'off'}`,
      detail: `The ${weight} place now contributes ${after & weight ? weight : 0} to the unsigned value.`,
      before, after,
    });
  }

  function shift(direction: 'left' | 'right') {
    const before = value;
    const { result, shiftedOut } = shiftByte(before, direction, places);
    setRegister(result, {
      title: `Shifted ${direction} ${places} ${places === 1 ? 'place' : 'places'}`,
      detail: direction === 'left'
        ? 'Zeros entered from the right. Bits leaving the left edge were discarded.'
        : 'Zeros entered from the left. Bits leaving the right edge were discarded.',
      before, after: result,
      flags: [shiftedOut ? `Shifted-out bits: ${shiftedOut.toString(2).padStart(places, '0')}` : 'No 1 bits were lost'],
    });
  }

  function add() {
    if (operand === null) return;
    const before = value;
    const { result, total, carry, signedOverflow } = addBytes(before, operand);
    setRegister(result, {
      title: `${before} + ${operand} = ${total}`,
      detail: `The 8-bit register stores ${result}. ${carry ? 'The ninth bit becomes a carry and is lost.' : 'The sum fits in 8 unsigned bits.'}`,
      before, after: result,
      flags: [carry ? 'Unsigned overflow · carry out' : 'No unsigned overflow', signedOverflow ? 'Signed overflow' : 'No signed overflow'],
    });
  }

  function complement() {
    const before = value;
    setRegister(negated, {
      title: 'Two’s complement applied',
      detail: before === 128
        ? 'In 8 bits, −128 cannot become +128; the result stays 1000 0000.'
        : `Flip every bit, then add 1. As a signed number, ${signed8(before)} becomes ${signed8(negated)}.`,
      before, after: negated,
    });
  }

  return <main className="binary-app" data-pico-theme={theme.id} style={cssVariables(theme) as CSSProperties}>
    <header className="binary-header pico-appbar">
      <div className="pico-appbar-lead">
        <button className="binary-icon-button" aria-label="Back to Pico" onClick={onHome}><ArrowLeft size={17} /></button>
        <div className="brand-lockup"><img className="brand-mark" src="/pico-logo.svg" alt="" width="24" height="24" /><span>Pico<span className="brand-period">.</span></span></div>
        <span className="pico-appbar-sep" aria-hidden="true">/</span><strong className="pico-appbar-tool">Binary Lab</strong>
      </div>
      <button className="binary-icon-button" aria-label="Binary Lab theme" title="Choose theme" onClick={() => setThemeOpen(true)}><Settings2 size={17} /></button>
    </header>

    <div className="binary-content">
      <div className="binary-intro"><div><span className="binary-eyebrow">DATA LAB · 8-BIT REGISTER</span><h1>See what every bit does.</h1><p>Switch bits on and off, then watch the same byte change in decimal, hexadecimal and two’s complement.</p></div><div className="binary-intro-badge" aria-hidden="true">{groupedBinary(value)}<span>0x{hex2(value)}</span></div></div>

      <section className="binary-panel binary-register" aria-labelledby="binary-register-heading">
        <div className="binary-panel-heading"><div><span className="binary-eyebrow">LIVE REGISTER</span><h2 id="binary-register-heading">Toggle the bits</h2></div><button className="binary-reset" onClick={() => setRegister(0, null)}><RotateCcw size={15} /> Clear</button></div>
        <div className="binary-bit-grid" role="group" aria-label="Eight-bit register">
          {WEIGHTS.map((weight, index) => {
            const position = 7 - index;
            const active = Boolean(value & weight);
            return <div className="binary-bit-column" key={weight}>
              <span className="binary-bit-index">BIT {position}</span>
              <button className={`binary-bit ${active ? 'on' : ''}`} aria-label={`Toggle bit ${position}, value ${weight}`} aria-pressed={active} onClick={() => flip(position)}>{active ? '1' : '0'}</button>
              <span className="binary-bit-weight">{weight}</span>
            </div>;
          })}
        </div>
        <p className="binary-register-hint">Each 1 adds its place value to the unsigned total. The leftmost bit is also the sign bit in two’s complement.</p>
        <div className="binary-presets"><span>Try:</span>{[0, 1, 127, 128, 255].map(preset => <button key={preset} onClick={() => setRegister(preset)}>{preset}</button>)}</div>
      </section>

      <section className="binary-panel binary-values" aria-labelledby="binary-values-heading">
        <div className="binary-panel-heading"><div><span className="binary-eyebrow">THREE VIEWS · ONE BYTE</span><h2 id="binary-values-heading">Read the value</h2></div></div>
        <div className="binary-value-grid">
          <label className="binary-value-field"><span>Unsigned decimal <small>0–255</small></span><input aria-label="Unsigned decimal value" inputMode="numeric" value={decimalDraft} aria-invalid={decimalDraft !== '' && parseByteDecimal(decimalDraft) === null} onChange={event => changeDecimal(event.target.value)} onBlur={() => setDecimalDraft(String(value))} /><small>Sum of the enabled bit weights</small></label>
          <label className="binary-value-field"><span>Hexadecimal <small>00–FF</small></span><div className="binary-prefixed-input"><b>0x</b><input aria-label="Hexadecimal value" value={hexDraft} maxLength={2} aria-invalid={hexDraft !== '' && parseByteHex(hexDraft) === null} onChange={event => changeHex(event.target.value)} onBlur={() => setHexDraft(hex2(value))} /></div><small>One hex digit per four bits</small></label>
          <div className="binary-value-field binary-signed"><span>Signed decimal <small>−128 to 127</small></span><output aria-label="Two’s complement signed value">{signed8(value)}</output><small>The leftmost bit carries a negative weight</small></div>
        </div>
        <div className="binary-nibbles"><span>Binary</span><code>{groupedBinary(value)}</code><span className="binary-nibble-arrow" aria-hidden="true">→</span><span>Hex</span><code>{hex2(value)[0]} {hex2(value)[1]}</code></div>
      </section>

      <div className="binary-operations">
        <section className="binary-panel" aria-labelledby="binary-shift-heading"><span className="binary-eyebrow">MOVE THE BITS</span><h2 id="binary-shift-heading">Logical shift</h2><p>Zeros enter from one side; bits pushed off the other side disappear.</p><label className="binary-small-field">Places<select aria-label="Shift places" value={places} onChange={event => setPlaces(Number(event.target.value))}>{[1, 2, 3, 4].map(count => <option key={count} value={count}>{count}</option>)}</select></label><div className="binary-action-row"><button onClick={() => shift('left')}><ArrowLeftCircle size={17} /> Shift left</button><button onClick={() => shift('right')}><ArrowRightCircle size={17} /> Shift right</button></div></section>
        <section className="binary-panel" aria-labelledby="binary-add-heading"><span className="binary-eyebrow">ARITHMETIC</span><h2 id="binary-add-heading">8-bit addition</h2><p>Add another byte. Watch for a carry out and signed overflow.</p><label className="binary-small-field">Add decimal value<input aria-label="Add decimal value" inputMode="numeric" value={operandDraft} aria-invalid={operandDraft !== '' && operand === null} onChange={event => setOperandDraft(event.target.value)} /></label><div className="binary-action-row"><button onClick={add} disabled={operand === null}><Plus size={17} /> Add to register</button><code>{operand === null ? '—' : groupedBinary(operand)}</code></div></section>
        <section className="binary-panel" aria-labelledby="binary-complement-heading"><span className="binary-eyebrow">SIGNED NUMBERS</span><h2 id="binary-complement-heading">Two’s complement</h2><p>Negate the signed value by flipping all eight bits and adding one.</p><div className="binary-complement-steps"><span>Flip</span><code>{groupedBinary(flipped)}</code><span>+ 1</span><code>{groupedBinary(negated)}</code></div><div className="binary-action-row"><button onClick={complement}>Apply to register</button><span>{signed8(value)} → {signed8(negated)}</span></div></section>
      </div>

      <section className="binary-feedback binary-panel" aria-live="polite" aria-label="Last operation">
        {feedback ? <><span className="binary-eyebrow">WHAT HAPPENED</span><h2>{feedback.title}</h2><div className="binary-feedback-equation"><code>{groupedBinary(feedback.before)}</code><span aria-hidden="true">→</span><code>{groupedBinary(feedback.after)}</code></div><p>{feedback.detail}</p>{feedback.flags && <div className="binary-feedback-flags">{feedback.flags.map(flag => <span key={flag}>{flag}</span>)}</div>}</> : <><span className="binary-eyebrow">TRY AN EXPERIMENT</span><h2>Start with the register above.</h2><p>Change one bit, shift the byte, or add a value to see an explanation here.</p></>}
      </section>
    </div>

    {themeOpen && <div className="binary-theme-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setThemeOpen(false); }}><div className="binary-theme-dialog" role="dialog" aria-modal="true" aria-label="Choose Binary Lab theme"><div className="binary-theme-head"><strong>Theme</strong><button aria-label="Close themes" onClick={() => setThemeOpen(false)}><X size={17} /></button></div><ThemePicker value={themeId} onChange={setThemeId} /></div></div>}
  </main>;
}
