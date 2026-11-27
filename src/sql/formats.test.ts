import {describe,it,expect} from 'vitest';
import {availableFormats,formatCell} from './formats';
describe('Field display formats',()=>{
 it('formats boolean values without changing numeric data or nonboolean values',()=>{expect(formatCell(1,'yes-no')).toBe('Yes');expect(formatCell(0,'true-false')).toBe('False');expect(formatCell(1,'zero-one')).toBe('1');expect(formatCell(9,'yes-no')).toBe('9');expect(formatCell(null,'yes-no')).toBe('NULL');});
 it('formats numbers, dates, times and text',()=>{expect(formatCell(12.5,'decimal2')).toBe('12.50');expect(formatCell(.25,'percent')).toBe('25.00%');expect(formatCell('2026-11-27','date-dmy')).toBe('27/11/2026');expect(formatCell('13:20','time12')).toBe('1:20 PM');expect(formatCell('abc','upper')).toBe('ABC');expect(availableFormats('INTEGER')).toContain('yes-no');});
});
