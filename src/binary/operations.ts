export const BYTE_MAX = 0xff;

export function binary8(value: number): string {
  return (value & BYTE_MAX).toString(2).padStart(8, '0');
}

export function groupedBinary(value: number): string {
  const bits = binary8(value);
  return `${bits.slice(0, 4)} ${bits.slice(4)}`;
}

export function hex2(value: number): string {
  return (value & BYTE_MAX).toString(16).toUpperCase().padStart(2, '0');
}

export function signed8(value: number): number {
  const byte = value & BYTE_MAX;
  return byte < 128 ? byte : byte - 256;
}

export function parseByteDecimal(raw: string): number | null {
  if (!/^\d{1,3}$/.test(raw)) return null;
  const value = Number(raw);
  return value <= BYTE_MAX ? value : null;
}

export function parseByteHex(raw: string): number | null {
  if (!/^[\da-fA-F]{1,2}$/.test(raw)) return null;
  return Number.parseInt(raw, 16);
}

export function toggleBit(value: number, position: number): number {
  return value ^ (1 << position);
}

export function addBytes(value: number, operand: number) {
  const total = value + operand;
  const result = total & BYTE_MAX;
  return {
    result,
    total,
    carry: total > BYTE_MAX,
    signedOverflow: Boolean((~(value ^ operand) & (value ^ result) & 0x80)),
  };
}

export function shiftByte(value: number, direction: 'left' | 'right', places: number) {
  const mask = (1 << places) - 1;
  const shiftedOut = direction === 'left'
    ? (value >>> (8 - places)) & mask
    : value & mask;
  return {
    result: direction === 'left' ? (value << places) & BYTE_MAX : value >>> places,
    shiftedOut,
  };
}

export function negateByte(value: number): number {
  return (~value + 1) & BYTE_MAX;
}
