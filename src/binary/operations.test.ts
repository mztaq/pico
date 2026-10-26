import { describe, expect, it } from 'vitest';
import { addBytes, binary8, hex2, negateByte, parseByteDecimal, parseByteHex, shiftByte, signed8, toggleBit } from './operations';

describe('Binary Lab byte operations', () => {
  it('keeps decimal, binary, hex and signed readings of the same byte aligned', () => {
    expect(binary8(42)).toBe('00101010');
    expect(hex2(42)).toBe('2A');
    expect(signed8(170)).toBe(-86);
    expect(toggleBit(42, 7)).toBe(170);
    expect(parseByteDecimal('255')).toBe(255);
    expect(parseByteDecimal('256')).toBeNull();
    expect(parseByteHex('FF')).toBe(255);
    expect(parseByteHex('FG')).toBeNull();
  });

  it('distinguishes an unsigned carry from signed overflow', () => {
    expect(addBytes(255, 1)).toEqual({ result: 0, total: 256, carry: true, signedOverflow: false });
    expect(addBytes(127, 1)).toEqual({ result: 128, total: 128, carry: false, signedOverflow: true });
  });

  it('discards bits that leave the register during logical shifts', () => {
    expect(shiftByte(0b10000001, 'left', 1)).toEqual({ result: 0b00000010, shiftedOut: 1 });
    expect(shiftByte(0b10000001, 'right', 1)).toEqual({ result: 0b01000000, shiftedOut: 1 });
  });

  it('uses eight-bit two’s complement, including the -128 limit', () => {
    expect(negateByte(5)).toBe(251);
    expect(signed8(negateByte(5))).toBe(-5);
    expect(negateByte(128)).toBe(128);
  });
});
