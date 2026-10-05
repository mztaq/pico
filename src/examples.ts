export interface Example { id: string; name: string; description: string; code: string; inputs: string[]; expected: string[]; }
export const examples: Example[] = [
  { id: 'greeting', name: 'A warm greeting', description: 'Read a name, then build a greeting.', code: 'DECLARE Name : STRING\nOUTPUT "What is your name?"\nINPUT Name\nOUTPUT "Hello, " + Name + "!"', inputs: ['Ada'], expected: ['What is your name?', 'Hello, Ada!'] },
  { id: 'countdown', name: 'Count to five', description: 'A FOR loop includes both ends.', code: 'DECLARE Counter : INTEGER\nFOR Counter ← 1 TO 5\n    OUTPUT Counter\nNEXT Counter', inputs: [], expected: ['1', '2', '3', '4', '5'] },
  { id: 'grade', name: 'Pass or keep practising', description: 'Choose a path with IF and ELSE.', code: 'DECLARE Score : INTEGER\nScore ← 72\nIF Score >= 50 THEN\n    OUTPUT "Pass"\nELSE\n    OUTPUT "Keep practising"\nENDIF', inputs: [], expected: ['Pass'] },
  { id: 'total', name: 'Add a running total', description: 'Repeat a block while its condition is true.', code: 'DECLARE Total : INTEGER\nDECLARE Counter : INTEGER\nTotal ← 0\nCounter ← 1\nWHILE Counter <= 4 DO\n    Total ← Total + Counter\n    Counter ← Counter + 1\nENDWHILE\nOUTPUT "Total: " + Total', inputs: [], expected: ['Total: 10'] },
  { id: 'word', name: 'Explore a word', description: 'Use Cambridge string routines and LENGTH.', code: 'DECLARE Word : STRING\nWord ← "Cambridge"\nOUTPUT UPPER(Word)\nOUTPUT "Letters: " + LENGTH(Word)', inputs: [], expected: ['CAMBRIDGE', 'Letters: 9'] },
  { id: 'remainder', name: 'Whole groups and leftovers', description: 'Use DIV and MOD for integer arithmetic.', code: 'DECLARE Apples : INTEGER\nApples ← 17\nOUTPUT Apples DIV 5\nOUTPUT Apples MOD 5', inputs: [], expected: ['3', '2'] },
];
