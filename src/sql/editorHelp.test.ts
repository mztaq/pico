import { describe, expect, it } from 'vitest';
import { completionItems, correctionFor, helpForWord } from './editorHelp';

describe('SQL editor assistance', () => {
  it('explains syllabus keywords and schema keys', () => {
    expect(helpForWord('where')?.description).toMatch(/condition/i);
    expect(helpForWord('ClubID')?.description).toMatch(/foreign key/i);
    expect(helpForWord('Clubs')?.title).toBe('Clubs');
    expect(completionItems().some(item => item.label === 'YearGroup')).toBe(true);
  });

  it('suggests a precise, opt-in spelling correction', () => {
    expect(correctionFor('SELEC Name FROM Students', 'This playground runs SELECT')?.replacement).toBe('SELECT');
    expect(correctionFor('SELECT Name FROM Studentz', 'no such table: Studentz')?.replacement).toBe('Students');
    expect(correctionFor('SELECT YearGrop FROM Students', 'no such column: YearGrop')?.replacement).toBe('YearGroup');
    expect(correctionFor('SELECT Name FROM Students', 'unrelated error')).toBeNull();
  });
});
