export type BugLanguage = 'python' | 'pseudocode';
export type BugDifficulty = 'Beginner' | 'Easy' | 'Intermediate';
export interface BugCase {
  label: string;
  args?: unknown[];
  expected?: unknown;
  inputs?: string[];
  expectedOutput?: string;
}
export interface BugExample { input: string; output: string; }
export interface BugQuestion {
  id: string;
  title: string;
  language: BugLanguage;
  difficulty: BugDifficulty;
  topic: string;
  description: string;
  starter: string;
  functionName?: string;
  cases: BugCase[];
  examples: BugExample[];
  hints: string[];
  walkthrough: string[];
  solution: string;
  explanation: string;
}

export const bugQuestions: BugQuestion[] = [
  {
    id: 'positive-total', title: 'Add the numbers', language: 'python', difficulty: 'Beginner', topic: 'Functions and arithmetic',
    description: 'Return the total of every number in a list. Fix the starting value so both empty and non-empty lists produce the right total.',
    starter: 'def total(numbers):\n    result = 1\n    for number in numbers:\n        result += number\n    return result', functionName: 'total',
    cases: [
      { label: 'A list with several numbers', args: [[2, 3, 5]], expected: 10 },
      { label: 'An empty list', args: [[]], expected: 0 },
      { label: 'A list with negative numbers', args: [[-4, 4]], expected: 0 },
    ],
    examples: [{ input: 'total([2, 3, 5])', output: '10' }, { input: 'total([])', output: '0' }],
    hints: ['What value should you have before adding any numbers?', 'The starting value should leave a number unchanged when you add it.'],
    walkthrough: ['The loop adds each list item to `result`, so check the value of `result` before the first loop step.', 'For addition, 0 is the neutral starting value: adding 0 does not change the first number.', 'Change `result = 1` to `result = 0`. The empty-list case then returns 0 without entering the loop.'],
    solution: 'def total(numbers):\n    result = 0\n    for number in numbers:\n        result += number\n    return result',
    explanation: 'A sum starts at 0. Adding every item to 0 leaves the first item unchanged, and an empty list correctly produces 0.',
  },
  {
    id: 'count-vowels', title: 'Count the vowels', language: 'python', difficulty: 'Easy', topic: 'Strings and loops',
    description: 'Count vowels in a piece of text. Treat uppercase and lowercase letters equally, and count repeated vowels.',
    starter: 'def count_vowels(text):\n    vowels = "aeiou"\n    count = 0\n    for letter in text:\n        if letter in vowels:\n            count += 1\n    return count', functionName: 'count_vowels',
    cases: [
      { label: 'Mixed case text', args: ['Education'], expected: 5 },
      { label: 'No vowels', args: ['rhythm'], expected: 0 },
      { label: 'Repeated uppercase vowels', args: ['Aaa'], expected: 3 },
    ],
    examples: [{ input: 'count_vowels("Education")', output: '5' }, { input: 'count_vowels("rhythm")', output: '0' }],
    hints: ['The membership check only looks for lowercase letters.', 'Normalize the text before checking each letter.'],
    walkthrough: ['The vowel list contains lowercase letters only, so uppercase input letters do not match.', 'Convert the text to lowercase before the loop checks its letters.', 'Iterate over `text.lower()` so each vowel is counted regardless of its original case.'],
    solution: 'def count_vowels(text):\n    vowels = "aeiou"\n    count = 0\n    for letter in text.lower():\n        if letter in vowels:\n            count += 1\n    return count',
    explanation: 'Converting the input to lowercase makes one membership check handle both cases. Each matching character increments the count, including repeats.',
  },
  {
    id: 'largest-number', title: 'Find the largest', language: 'python', difficulty: 'Easy', topic: 'Lists and comparisons',
    description: 'Return the largest number in a non-empty list. Correct the comparison so a better candidate replaces the saved value.',
    starter: 'def largest(numbers):\n    best = numbers[0]\n    for number in numbers[1:]:\n        if number < best:\n            best = number\n    return best', functionName: 'largest',
    cases: [
      { label: 'Numbers in mixed order', args: [[3, 9, 2]], expected: 9 },
      { label: 'All negative numbers', args: [[-8, -2, -5]], expected: -2 },
      { label: 'A one-item list', args: [[4]], expected: 4 },
    ],
    examples: [{ input: 'largest([3, 9, 2])', output: '9' }, { input: 'largest([-8, -2, -5])', output: '-2' }],
    hints: ['Compare each number with the current best.', 'Replace `best` when the new number is larger.'],
    walkthrough: ['`best` stores the largest number seen so far.', 'When a later number is greater than `best`, save that number as the new best.', 'Change `<` to `>` in the condition. Starting from the first item also handles negative values.'],
    solution: 'def largest(numbers):\n    best = numbers[0]\n    for number in numbers[1:]:\n        if number > best:\n            best = number\n    return best',
    explanation: 'Replace the saved value only when a larger number is found. Starting with the first item also handles lists of negative values.',
  },
  {
    id: 'double-input', title: 'Double the input', language: 'pseudocode', difficulty: 'Beginner', topic: 'Input and arithmetic',
    description: 'Read an integer and output twice its value. The program runs, but its calculation uses the wrong multiplier.',
    starter: 'DECLARE Number : INTEGER\nDECLARE Answer : INTEGER\nINPUT Number\nAnswer <- Number * 3\nOUTPUT Answer',
    cases: [
      { label: 'A positive number', inputs: ['4'], expectedOutput: '8' },
      { label: 'Zero', inputs: ['0'], expectedOutput: '0' },
      { label: 'A negative number', inputs: ['-3'], expectedOutput: '-6' },
    ],
    examples: [{ input: '4', output: '8' }, { input: '-3', output: '-6' }],
    hints: ['The calculation should add the input to itself.', 'Check the multiplier in the assignment.'],
    walkthrough: ['The input is stored in `Number`, then the assignment calculates `Answer`.', 'Doubling means multiplying by 2, not 3.', 'Change `Number * 3` to `Number * 2`. The final OUTPUT statement already displays the answer.'],
    solution: 'DECLARE Number : INTEGER\nDECLARE Answer : INTEGER\nINPUT Number\nAnswer <- Number * 2\nOUTPUT Answer',
    explanation: 'The input is multiplied by 2 and the result is printed. The same calculation works for positive, zero and negative integers.',
  },
  {
    id: 'minutes-to-time', title: 'Convert minutes to hours', language: 'pseudocode', difficulty: 'Intermediate', topic: 'DIV and MOD',
    description: 'Convert a whole number of minutes to hours and leftover minutes. The program should output them as hours:minutes.',
    starter: 'DECLARE Minutes : INTEGER\nDECLARE Hours : INTEGER\nDECLARE Remaining : INTEGER\nINPUT Minutes\nHours <- Minutes DIV 100\nRemaining <- Minutes MOD 60\nOUTPUT Hours, ":", Remaining',
    cases: [
      { label: 'More than two hours', inputs: ['125'], expectedOutput: '2:5' },
      { label: 'Exactly one hour', inputs: ['60'], expectedOutput: '1:0' },
      { label: 'Less than one hour', inputs: ['59'], expectedOutput: '0:59' },
    ],
    examples: [{ input: '125', output: '2:5' }, { input: '59', output: '0:59' }],
    hints: ['Use whole-number division to get complete hours.', 'There are 60 minutes in an hour. The remainder is already using MOD 60.'],
    walkthrough: ['`DIV` gives the number of complete groups; `MOD` gives what is left over.', 'Both calculations must use the same group size: 60 minutes.', 'Change `Minutes DIV 100` to `Minutes DIV 60`. Keep the remainder calculation and output as they are.'],
    solution: 'DECLARE Minutes : INTEGER\nDECLARE Hours : INTEGER\nDECLARE Remaining : INTEGER\nINPUT Minutes\nHours <- Minutes DIV 60\nRemaining <- Minutes MOD 60\nOUTPUT Hours, ":", Remaining',
    explanation: '`DIV 60` counts complete hours, while `MOD 60` gives the remaining minutes.',
  },
];

export function buildCheckProgram(source: string, question: BugQuestion): string {
  if (!question.functionName) throw new Error('This Python question does not define a function to test.');
  const cases = JSON.stringify(question.cases.map(item => ({ args: item.args ?? [], expected: item.expected, label: item.label })));
  return `${source}\n\nimport json as _pico_json\n_pico_cases = ${cases}\n_pico_results = []\nfor _pico_case in _pico_cases:\n    try:\n        _pico_actual = ${question.functionName}(*_pico_case["args"])\n        _pico_results.append({"label": _pico_case["label"], "actual": _pico_actual, "expected": _pico_case["expected"], "passed": _pico_actual == _pico_case["expected"]})\n    except Exception as _pico_error:\n        _pico_results.append({"label": _pico_case["label"], "actual": "Error: " + str(_pico_error), "expected": _pico_case["expected"], "passed": False})\nprint("PICO_CHECK:" + _pico_json.dumps(_pico_results, default=str))\n`;
}
