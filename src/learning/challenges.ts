export interface ChallengeCase {
  inputs: string[];
  expected: string[];
}
export interface Challenge {
  id: string;
  title: string;
  topic: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  task: string;
  starter: string;
  hint: string;
  cases: ChallengeCase[];
}

/** Original Pico exercises, tested with Pico's real CAIE-style interpreter. */
export const challenges: Challenge[] = [
  {
    id: 'hello', title: 'Hello, student', topic: 'Input and output', level: 'Beginner',
    task: 'Read a name and output Hello, followed by the name. Example: Hello, Ali',
    starter: ['DECLARE Name : STRING', 'INPUT Name', 'OUTPUT Name'].join('\n'),
    hint: 'Use OUTPUT "Hello, ", Name to print the greeting.',
    cases: [
      { inputs: ['Ali'], expected: ['Hello, Ali'] },
      { inputs: ['Pico'], expected: ['Hello, Pico'] },
      { inputs: ['M'], expected: ['Hello, M'] },
    ],
  },
  {
    id: 'even-odd', title: 'Even or odd', topic: 'Selection', level: 'Beginner',
    task: 'Read an integer. Output Even if divisible by 2 and Odd otherwise.',
    starter: ['DECLARE Number : INTEGER', 'INPUT Number', 'OUTPUT Number'].join('\n'),
    hint: 'Number MOD 2 = 0 is TRUE when Number is even.',
    cases: [
      { inputs: ['8'], expected: ['Even'] },
      { inputs: ['7'], expected: ['Odd'] },
      { inputs: ['0'], expected: ['Even'] },
      { inputs: ['-3'], expected: ['Odd'] },
    ],
  },
  {
    id: 'largest', title: 'Larger number', topic: 'Selection', level: 'Beginner',
    task: 'Read two integers, then output the larger value. If they are equal, output that value.',
    starter: ['DECLARE A : INTEGER', 'DECLARE B : INTEGER', 'INPUT A', 'INPUT B', 'OUTPUT A'].join('\n'),
    hint: 'Use IF A > B THEN ... ELSE ... ENDIF.',
    cases: [
      { inputs: ['5', '9'], expected: ['9'] },
      { inputs: ['11', '3'], expected: ['11'] },
      { inputs: ['4', '4'], expected: ['4'] },
      { inputs: ['-8', '-2'], expected: ['-2'] },
    ],
  },
  {
    id: 'sum-to-n', title: 'Sum from 1 to N', topic: 'Iteration', level: 'Intermediate',
    task: 'Read a positive integer N and output the sum of every integer from 1 to N.',
    starter: ['DECLARE N : INTEGER', 'DECLARE Total : INTEGER', 'DECLARE I : INTEGER', 'INPUT N', 'Total <- 0', 'OUTPUT Total'].join('\n'),
    hint: 'FOR I <- 1 TO N; add I to Total each time; NEXT I.',
    cases: [
      { inputs: ['1'], expected: ['1'] },
      { inputs: ['5'], expected: ['15'] },
      { inputs: ['10'], expected: ['55'] },
      { inputs: ['20'], expected: ['210'] },
    ],
  },
  {
    id: 'countdown', title: 'Countdown', topic: 'Iteration', level: 'Intermediate',
    task: 'Read an integer N between 1 and 20. Output N, N-1, ... , 1 on separate lines.',
    starter: ['DECLARE N : INTEGER', 'DECLARE I : INTEGER', 'INPUT N', 'OUTPUT N'].join('\n'),
    hint: 'A FOR loop with STEP -1 counts backwards.',
    cases: [
      { inputs: ['1'], expected: ['1'] },
      { inputs: ['3'], expected: ['3', '2', '1'] },
      { inputs: ['6'], expected: ['6', '5', '4', '3', '2', '1'] },
    ],
  },
  {
    id: 'password-length', title: 'Password length', topic: 'Strings', level: 'Intermediate',
    task: 'Read a password. Output Long if it has at least 8 characters, otherwise output Short.',
    starter: ['DECLARE Password : STRING', 'INPUT Password', 'OUTPUT LENGTH(Password)'].join('\n'),
    hint: 'Use LENGTH(Password) >= 8 in an IF condition.',
    cases: [
      { inputs: ['abc'], expected: ['Short'] },
      { inputs: ['abcdefgh'], expected: ['Long'] },
      { inputs: ['password123'], expected: ['Long'] },
    ],
  },
  {
    id: 'times-table', title: 'Times table', topic: 'Iteration', level: 'Intermediate',
    task: 'Read an integer N and output its first five multiples on separate lines: N, 2N, 3N, 4N, 5N.',
    starter: ['DECLARE N : INTEGER', 'DECLARE I : INTEGER', 'INPUT N', 'FOR I <- 1 TO 5', '    OUTPUT N', 'NEXT I'].join('\n'),
    hint: 'Inside the loop, output N * I.',
    cases: [
      { inputs: ['2'], expected: ['2', '4', '6', '8', '10'] },
      { inputs: ['4'], expected: ['4', '8', '12', '16', '20'] },
      { inputs: ['-1'], expected: ['-1', '-2', '-3', '-4', '-5'] },
    ],
  },
  {
    id: 'factorial', title: 'Factorial', topic: 'Algorithms', level: 'Advanced',
    task: 'Read an integer N between 0 and 8. Output N factorial (0 factorial is 1).',
    starter: ['DECLARE N : INTEGER', 'DECLARE I : INTEGER', 'DECLARE Result : INTEGER', 'INPUT N', 'Result <- 1', 'OUTPUT Result'].join('\n'),
    hint: 'Multiply Result by I for every integer from 1 through N.',
    cases: [
      { inputs: ['0'], expected: ['1'] },
      { inputs: ['3'], expected: ['6'] },
      { inputs: ['5'], expected: ['120'] },
      { inputs: ['8'], expected: ['40320'] },
    ],
  },
];

export const challengeById = (id: string) => challenges.find(challenge => challenge.id === id);
