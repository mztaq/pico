export interface Challenge {
  id: string;
  title: string;
  topic: string;
  difficulty: 'Easy' | 'Medium';
  brief: string;
  hints: string[];
  starter: string;
  solution: string;
  explanation: string;
  tests: { name: string; inputs: string[]; expected: string[] }[];
}

export const challenges: Challenge[] = [
  {
    id: 'missing-number', title: 'The missing number', topic: 'Loops', difficulty: 'Easy',
    brief: 'Print every integer from 1 to 5, each on its own line. The last number has gone missing.',
    hints: ['Look at the end value of the FOR loop.', 'Cambridge FOR loops include both endpoints. The final value should be 5.'],
    starter: 'DECLARE Number : INTEGER\nFOR Number ← 1 TO 4\n    OUTPUT Number\nNEXT Number',
    solution: 'DECLARE Number : INTEGER\nFOR Number ← 1 TO 5\n    OUTPUT Number\nNEXT Number',
    explanation: 'FOR includes its end value. Changing 4 to 5 makes the loop visit all five numbers.',
    tests: [{ name: 'Count all five numbers', inputs: [], expected: ['1', '2', '3', '4', '5'] }],
  },
  {
    id: 'pass-boundary', title: 'One mark short', topic: 'Selection', difficulty: 'Easy',
    brief: 'Read a score. Print "Pass" for 50 or more, otherwise print "Try again". A student with exactly 50 is getting the wrong result.',
    hints: ['Try the boundary value: 50.', 'The condition needs to include equality. Use >= instead of >.'],
    starter: 'DECLARE Score : INTEGER\nINPUT Score\nIF Score > 50 THEN\n    OUTPUT "Pass"\nELSE\n    OUTPUT "Try again"\nENDIF',
    solution: 'DECLARE Score : INTEGER\nINPUT Score\nIF Score >= 50 THEN\n    OUTPUT "Pass"\nELSE\n    OUTPUT "Try again"\nENDIF',
    explanation: 'A boundary test catches the difference between > and >=. A passing score includes 50 itself.',
    tests: [{ name: 'Below the boundary', inputs: ['49'], expected: ['Try again'] }, { name: 'Exactly 50', inputs: ['50'], expected: ['Pass'] }, { name: 'Above the boundary', inputs: ['85'], expected: ['Pass'] }],
  },
  {
    id: 'lost-total', title: 'Where did the total go?', topic: 'Accumulators', difficulty: 'Easy',
    brief: 'Read three integers and print their sum. The program currently forgets earlier numbers.',
    hints: ['Which statement resets Total?', 'Set Total to zero before the loop, so it keeps its value between iterations.'],
    starter: 'DECLARE Total : INTEGER\nDECLARE Number : INTEGER\nDECLARE Count : INTEGER\nFOR Count ← 1 TO 3\n    Total ← 0\n    INPUT Number\n    Total ← Total + Number\nNEXT Count\nOUTPUT Total',
    solution: 'DECLARE Total : INTEGER\nDECLARE Number : INTEGER\nDECLARE Count : INTEGER\nTotal ← 0\nFOR Count ← 1 TO 3\n    INPUT Number\n    Total ← Total + Number\nNEXT Count\nOUTPUT Total',
    explanation: 'An accumulator is initialized once before the loop. Resetting it inside the loop discards the previous total.',
    tests: [{ name: 'Three positive values', inputs: ['2', '3', '4'], expected: ['9'] }, { name: 'Negative values', inputs: ['-5', '2', '1'], expected: ['-2'] }, { name: 'Zero is valid', inputs: ['0', '0', '7'], expected: ['7'] }],
  },
  {
    id: 'stuck-countdown', title: 'Stuck on repeat', topic: 'Termination', difficulty: 'Medium',
    brief: 'Read a positive integer, count down to 1, then print "Go!". Fix the loop that never finishes.',
    hints: ['Does Count change while the loop is running?', 'Subtract one from Count inside the WHILE loop.'],
    starter: 'DECLARE Count : INTEGER\nINPUT Count\nWHILE Count > 0 DO\n    OUTPUT Count\nENDWHILE\nOUTPUT "Go!"',
    solution: 'DECLARE Count : INTEGER\nINPUT Count\nWHILE Count > 0 DO\n    OUTPUT Count\n    Count ← Count - 1\nENDWHILE\nOUTPUT "Go!"',
    explanation: 'The loop must move toward its stopping condition. Decrementing Count eventually makes Count > 0 false.',
    tests: [{ name: 'Countdown from 3', inputs: ['3'], expected: ['3', '2', '1', 'Go!'] }, { name: 'Countdown from 1', inputs: ['1'], expected: ['1', 'Go!'] }],
  },
  {
    id: 'array-edge', title: 'Beyond the edge', topic: 'Arrays', difficulty: 'Medium',
    brief: 'The array has three values. Print them in order without reading outside its declared bounds.',
    hints: ['Compare the loop bounds with ARRAY[1:3].', 'Start the loop at 1, not 0. Pico checks the declared array bounds.'],
    starter: 'DECLARE Values : ARRAY[1:3] OF INTEGER\nDECLARE Index : INTEGER\nValues[1] ← 10\nValues[2] ← 20\nValues[3] ← 30\nFOR Index ← 0 TO 3\n    OUTPUT Values[Index]\nNEXT Index',
    solution: 'DECLARE Values : ARRAY[1:3] OF INTEGER\nDECLARE Index : INTEGER\nValues[1] ← 10\nValues[2] ← 20\nValues[3] ← 30\nFOR Index ← 1 TO 3\n    OUTPUT Values[Index]\nNEXT Index',
    explanation: 'Cambridge arrays use explicitly declared bounds. ARRAY[1:3] has no element at index 0.',
    tests: [{ name: 'Visit each valid element', inputs: [], expected: ['10', '20', '30'] }],
  },
  {
    id: 'validation-trap', title: 'The validation trap', topic: 'Boolean logic', difficulty: 'Medium',
    brief: 'Keep reading until an age between 1 and 120 inclusive is entered, then print that age. Invalid values are slipping through.',
    hints: ['Can a number be below 1 AND above 120 at the same time?', 'An age is invalid if either condition is true. Join the checks with OR.'],
    starter: 'DECLARE Age : INTEGER\nINPUT Age\nWHILE Age < 1 AND Age > 120 DO\n    INPUT Age\nENDWHILE\nOUTPUT Age',
    solution: 'DECLARE Age : INTEGER\nINPUT Age\nWHILE Age < 1 OR Age > 120 DO\n    INPUT Age\nENDWHILE\nOUTPUT Age',
    explanation: 'The invalid ranges are alternatives. OR rejects either out-of-range value; AND can never be true here.',
    tests: [{ name: 'Reject a low age', inputs: ['0', '20'], expected: ['20'] }, { name: 'Reject a high age', inputs: ['121', '80'], expected: ['80'] }, { name: 'Accept lower boundary', inputs: ['1'], expected: ['1'] }, { name: 'Accept upper boundary', inputs: ['120'], expected: ['120'] }],
  },
];
