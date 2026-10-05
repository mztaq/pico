export interface ReferenceExample {
  code: string;
  inputs?: string[];
  expectedOutput?: string[];
}

// Block markers share a complete program so their surrounding syntax is visible.
const selection: ReferenceExample = {
  code: `DECLARE Score : INTEGER
Score ← 72
IF Score >= 50 THEN
    OUTPUT "Pass"
ELSE
    OUTPUT "Try again"
ENDIF`,
  expectedOutput: ['Pass'],
};
const whileLoop: ReferenceExample = {
  code: `DECLARE Number : INTEGER
Number ← 1
WHILE Number <= 3 DO
    OUTPUT Number
    Number ← Number + 1
ENDWHILE`,
  expectedOutput: ['1', '2', '3'],
};
const forLoop: ReferenceExample = {
  code: `FOR Counter ← 1 TO 3
    OUTPUT Counter
NEXT Counter`,
  expectedOutput: ['1', '2', '3'],
};
const repeatLoop: ReferenceExample = {
  code: `DECLARE Number : INTEGER
Number ← 0
REPEAT
    Number ← Number + 1
    OUTPUT Number
UNTIL Number = 3`,
  expectedOutput: ['1', '2', '3'],
};
const caseSelection: ReferenceExample = {
  code: `DECLARE Choice : INTEGER
Choice ← 3
CASE OF Choice
    1 : OUTPUT "One"
    2 : OUTPUT "Two"
    OTHERWISE
        OUTPUT "Other"
ENDCASE`,
  expectedOutput: ['Other'],
};
const procedure: ReferenceExample = {
  code: `PROCEDURE Greet(Name : STRING)
    OUTPUT "Hello, ", Name
ENDPROCEDURE
CALL Greet("Ada")`,
  expectedOutput: ['Hello, Ada'],
};
const functionRoutine: ReferenceExample = {
  code: `FUNCTION Double(Value : INTEGER) RETURNS INTEGER
    RETURN Value * 2
ENDFUNCTION
OUTPUT Double(4)`,
  expectedOutput: ['8'],
};
const array: ReferenceExample = {
  code: `DECLARE Scores : ARRAY[1:3] OF INTEGER
Scores[1] ← 85
Scores[2] ← 72
Scores[3] ← 94
OUTPUT Scores[2]`,
  expectedOutput: ['72'],
};
// Create the file first: each file example also runs in a fresh project.
const files: ReferenceExample = {
  code: `DECLARE Line : STRING
OPENFILE "notes.txt" FOR WRITE
WRITEFILE "notes.txt", "Hello Pico"
CLOSEFILE "notes.txt"

OPENFILE "notes.txt" FOR READ
READFILE "notes.txt", Line
CLOSEFILE "notes.txt"
OUTPUT Line`,
  expectedOutput: ['Hello Pico'],
};

export const referenceExamples = {
  DECLARE: { code: 'DECLARE Name : STRING\nName ← "Pico"\nOUTPUT Name', expectedOutput: ['Pico'] },
  CONSTANT: { code: 'CONSTANT Limit ← 10\nOUTPUT Limit', expectedOutput: ['10'] },
  INPUT: { code: 'DECLARE Name : STRING\nINPUT Name\nOUTPUT "Hello, ", Name', inputs: ['Ada'], expectedOutput: ['Hello, Ada'] },
  OUTPUT: { code: 'DECLARE Total : INTEGER\nTotal ← 12\nOUTPUT "Total: ", Total', expectedOutput: ['Total: 12'] },
  IF: selection,
  THEN: selection,
  ELSE: selection,
  ENDIF: selection,
  WHILE: whileLoop,
  DO: whileLoop,
  ENDWHILE: whileLoop,
  FOR: forLoop,
  TO: forLoop,
  STEP: { code: 'FOR Counter ← 3 TO 1 STEP -1\n    OUTPUT Counter\nNEXT Counter', expectedOutput: ['3', '2', '1'] },
  NEXT: forLoop,
  REPEAT: repeatLoop,
  UNTIL: repeatLoop,
  CASE: caseSelection,
  OF: caseSelection,
  OTHERWISE: caseSelection,
  ENDCASE: caseSelection,
  PROCEDURE: procedure,
  FUNCTION: functionRoutine,
  CALL: procedure,
  RETURN: functionRoutine,
  ARRAY: array,
  INTEGER: { code: 'DECLARE Count : INTEGER\nCount ← 3\nOUTPUT Count + 1', expectedOutput: ['4'] },
  REAL: { code: 'DECLARE Price : REAL\nPrice ← 2.5\nOUTPUT Price * 2', expectedOutput: ['5'] },
  CHAR: { code: "DECLARE Initial : CHAR\nInitial ← 'P'\nOUTPUT Initial", expectedOutput: ['P'] },
  STRING: { code: 'DECLARE Message : STRING\nMessage ← "Hello Pico"\nOUTPUT Message', expectedOutput: ['Hello Pico'] },
  BOOLEAN: { code: 'DECLARE Passed : BOOLEAN\nPassed ← TRUE\nOUTPUT Passed', expectedOutput: ['TRUE'] },
  AND: { code: 'DECLARE Score : INTEGER\nScore ← 72\nOUTPUT Score >= 50 AND Score <= 100', expectedOutput: ['TRUE'] },
  OR: { code: 'DECLARE Choice : INTEGER\nChoice ← 2\nOUTPUT Choice = 1 OR Choice = 2', expectedOutput: ['TRUE'] },
  NOT: { code: 'DECLARE Finished : BOOLEAN\nFinished ← FALSE\nOUTPUT NOT Finished', expectedOutput: ['TRUE'] },
  DIV: { code: 'OUTPUT 17 DIV 5', expectedOutput: ['3'] },
  MOD: { code: 'OUTPUT 17 MOD 5', expectedOutput: ['2'] },
  ROUND: { code: 'OUTPUT ROUND(3.14159, 2)', expectedOutput: ['3.14'] },
  LENGTH: { code: 'OUTPUT LENGTH("Cambridge")', expectedOutput: ['9'] },
  SUBSTRING: { code: 'OUTPUT SUBSTRING("Cambridge", 1, 4)', expectedOutput: ['Camb'] },
  UCASE: { code: 'OUTPUT UCASE("Pico")', expectedOutput: ['PICO'] },
  LCASE: { code: 'OUTPUT LCASE("Pico")', expectedOutput: ['pico'] },
  UPPER: { code: 'OUTPUT UPPER("Pico")', expectedOutput: ['PICO'] },
  LOWER: { code: 'OUTPUT LOWER("Pico")', expectedOutput: ['pico'] },
  RANDOM: { code: 'OUTPUT RANDOM()' },
  OPENFILE: files,
  READFILE: files,
  WRITEFILE: files,
  CLOSEFILE: files,
} satisfies Record<string, ReferenceExample>;

export type ReferenceKeyword = keyof typeof referenceExamples;
export const referenceTerms = Object.keys(referenceExamples) as ReferenceKeyword[];
