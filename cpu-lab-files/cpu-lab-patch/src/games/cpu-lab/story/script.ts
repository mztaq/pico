import type { PuzzleId } from '../sim/puzzles';

export type Speaker = 'BIT' | 'SYSTEM' | 'OKAFOR' | 'YOU';
export interface Line { speaker: Speaker; text: string; }

export const OPENING: string[] = [
  'The Archive ran on one machine — the Core. It fetched an instruction, decoded it, executed it, and did it again. Forty billion times a second, for three hundred years.',
  'Then, one night, it fetched an instruction and never finished it.',
  'Doors froze mid-swing. Lifts hung between floors. Every district stopped at the exact micro-step it was in.',
  'You are an apprentice systems engineer. You have a toolkit, a torch, and one very opinionated maintenance drone.',
];

export const BIT_LINES: Record<string, Line[]> = {
  wake: [
    { speaker: 'BIT', text: 'Oh good, you are conscious. I was about to file you under "furniture".' },
    { speaker: 'BIT', text: 'I am BIT, Maintenance Unit 7. My records say the Core suffered a catastrophic hardware fault. My records also say it is Tuesday. Treat both with suspicion.' },
    { speaker: 'BIT', text: 'That door controller is frozen mid-instruction. If we can make it finish, we can get out of this workshop. Walk over and press E.' },
  ],
  workshopSolved: [
    { speaker: 'BIT', text: 'It finished! One instruction at a time. Very slow. Very honest.' },
    { speaker: 'BIT', text: 'Next stop: the Memory Vault. Everything the Core knows lives there — as numbers in numbered boxes.' },
  ],
  vaultEnter: [
    { speaker: 'BIT', text: 'Sixteen pillars. Sixteen addresses, 0000 to 1111. Each holds one 8-bit value.' },
    { speaker: 'BIT', text: 'The vault lock is not opening. Its controller is still running its program — something it reads must be wrong. Check the console, then inspect the pillars.' },
  ],
  vaultSolved: [
    { speaker: 'BIT', text: 'Notice what you changed: not the address, only what was stored there. The program did not change at all.' },
    { speaker: 'BIT', text: 'That is suspicious, by the way. Someone zeroed that offset. Hardware faults do not usually leave tidy zeros.' },
  ],
  busEnter: [
    { speaker: 'BIT', text: 'The Bus Bridge. Three conduits used to run across that gap: amber, cyan, violet. They are not decorative.' },
    { speaker: 'BIT', text: 'Each socket on the junction needs the right kind of bus. Wire them, then run the bridge controller and watch where each transfer goes.' },
  ],
  busSolved: [
    { speaker: 'BIT', text: 'Addresses go one way. Data goes both ways. Control signals tell everyone what to do. I may have that on a mug somewhere.' },
  ],
  chamberEnter: [
    { speaker: 'BIT', text: 'The Processor Chamber. PC, MAR, MDR, CIR, the control unit, the ALU and the accumulator — each one on its own plinth.' },
    { speaker: 'BIT', text: 'The turbine sequencer keeps crashing. Run it and watch the PC very closely.' },
  ],
  chamberSolved: [
    { speaker: 'BIT', text: 'A single wrong operand sent the PC into data. The machine tried to execute the number 2 as if it were an order.' },
    { speaker: 'BIT', text: 'That is… exactly what the Core logs describe. This was never a hardware fault.' },
  ],
  coreEnter: [
    { speaker: 'BIT', text: 'The Core. Its program memory is blank — wiped when the last instruction was interrupted.' },
    { speaker: 'BIT', text: 'The ignition register at 1111 needs the value 40. The data it can use is already in RAM. You write the program. I will provide moral support and occasional beeping.' },
  ],
  coreSolved: [
    { speaker: 'BIT', text: 'Fetch. Decode. Execute. Again. Again. Again.' },
    { speaker: 'BIT', text: 'You did not fix a broken part. You finished an instruction someone started three hundred years ago.' },
  ],
};

export interface LogRecord { id: string; title: string; author: string; room: string; text: string; reveals?: string; }
export const LOGS: LogRecord[] = [
  { id: 'log-ws-1', room: 'Workshop', title: 'Shift note', author: 'Eng. Ada Okafor', text: 'Core maintenance window tonight. We are hot-patching the ignition routine — no shutdown. Director insists. I have told him a write in progress cannot be "paused politely".' },
  { id: 'log-ws-2', room: 'Workshop', title: 'Controller sticker', author: 'unknown', text: 'DOOR CTRL: loads CODE from 1110, stores it in LATCH 1111. If it freezes, single-step it. DO NOT kick it. (Again.)' },
  { id: 'log-vault-1', room: 'Memory Vault', title: 'Calibration record', author: 'Eng. Ada Okafor', text: 'Vault lock = BASE + OFFSET, stored to LOCK. BASE lives at 1100, OFFSET at 1101 and is always 5. The lock reads address 1110. The address is the box. The value is what is in the box.' },
  { id: 'log-vault-2', room: 'Memory Vault', title: 'Incident timestamp 03:14:07', author: 'Archive monitor', text: 'Power dip detected during STA to address 1101 (OFFSET). Write incomplete. Cell contents: 00000000.', reveals: 'The offset was not damaged by hardware — a store instruction was interrupted halfway.' },
  { id: 'log-bus-1', room: 'Bus Bridge', title: 'Conduit tags', author: 'Facilities', text: 'AMBER = ADDRESS (one way: MAR → RAM). CYAN = DATA (both ways). VIOLET = CONTROL (READ / WRITE / clock). Do not "just swap them, it\'s all wires".' },
  { id: 'log-chamber-1', room: 'Processor Chamber', title: 'Sequencer listing', author: 'Eng. Ada Okafor', text: 'LOOP: LDA COUNT · SUB ONE · STA COUNT · BRZ DONE · BRA LOOP. DONE: HLT. COUNT at 1100, ONE at 1101. LOOP is at 0000.' },
  { id: 'log-chamber-2', room: 'Processor Chamber', title: 'Final entry', author: 'Eng. Ada Okafor', text: 'The patch was half-written when the power dipped. Every machine that shared the Core\'s memory picked up the corruption — a branch here, a zero there. Nobody ran the program to its end. Whoever finds this: finish it.', reveals: 'The Archive stopped because an interrupted write left every system in an inconsistent state.' },
  { id: 'log-core-1', room: 'Core', title: 'Ignition spec', author: 'Core manual', text: 'IGNITION (1111) must equal FUEL (1100) minus DAMPER (1101). Program memory 0000–0101 is writable. Data memory 1100–1111 is sealed.' },
];

export interface Concept { id: string; term: string; short: string; detail: string; }
export const CONCEPTS: Concept[] = [
  { id: 'fde', term: 'Fetch–decode–execute cycle', short: 'The repeated cycle a CPU uses to run every instruction.', detail: 'Fetch: PC → MAR, address bus to RAM, READ on the control bus, instruction on the data bus into the MDR, MDR → CIR, PC incremented. Decode: the control unit interprets the CIR. Execute: the instruction is carried out, then the cycle repeats.' },
  { id: 'pc', term: 'Program Counter (PC)', short: 'Holds the address of the next instruction to fetch.', detail: 'Incremented during fetch so it points at the following instruction. A branch (BRA/BRZ) overwrites it with a new address.' },
  { id: 'mar', term: 'Memory Address Register (MAR)', short: 'Holds the address currently being read or written.', detail: 'Its contents are sent to RAM along the address bus.' },
  { id: 'mdr', term: 'Memory Data Register (MDR)', short: 'Holds data just read from, or about to be written to, memory.', detail: 'Connected to RAM through the data bus, which is bidirectional.' },
  { id: 'cir', term: 'Current Instruction Register (CIR)', short: 'Holds the instruction being decoded and executed.', detail: 'Copied from the MDR during fetch. In this model each instruction is 8 bits: a 4-bit opcode and a 4-bit operand.' },
  { id: 'cu', term: 'Control Unit (CU)', short: 'Decodes instructions and sends control signals.', detail: 'It sends READ/WRITE along the control bus and coordinates every transfer.' },
  { id: 'acc', term: 'Accumulator (ACC)', short: 'Holds the working value and results from the ALU.', detail: 'LDA loads it, ADD/SUB change it through the ALU, STA stores it to memory.' },
  { id: 'alu', term: 'Arithmetic Logic Unit (ALU)', short: 'Performs arithmetic and logic operations.', detail: 'In this model it adds and subtracts 8-bit values; results wrap around modulo 256.' },
  { id: 'ram', term: 'RAM, addresses and data', short: 'Each numbered location (address) stores one value (data).', detail: 'Here RAM has 16 addresses (0000–1111). Instructions and data share the same memory — the von Neumann model — so the CPU must never be sent to execute data.' },
  { id: 'abus', term: 'Address bus', short: 'Carries memory addresses from the CPU to RAM.', detail: 'Unidirectional: only the CPU decides which address to use.' },
  { id: 'dbus', term: 'Data bus', short: 'Carries data and instructions between CPU and RAM.', detail: 'Bidirectional: RAM → MDR on a read, MDR → RAM on a write.' },
  { id: 'cbus', term: 'Control bus', short: 'Carries control signals such as READ, WRITE and clock.', detail: 'Tells RAM whether the transfer on the data bus is a read or a write.' },
  { id: 'branch', term: 'Branching', short: 'Changing the PC to jump to another instruction.', detail: 'BRA always jumps; BRZ jumps only if the accumulator is zero. Loops are built from branches.' },
];
export const CONCEPTS_BY_PUZZLE: Record<PuzzleId, string[]> = {
  workshop: ['fde', 'pc', 'mar', 'mdr', 'cir'],
  vault: ['ram', 'acc', 'alu'],
  bus: ['abus', 'dbus', 'cbus', 'cu'],
  chamber: ['branch'],
  core: [],
};

export const OBJECTIVES: Record<PuzzleId | 'done', { title: string; detail: string }> = {
  workshop: { title: 'Free the workshop door', detail: 'The door controller froze mid-fetch. Step it through to HLT.' },
  vault: { title: 'Unseal the Memory Vault', detail: 'The vault lock reads the value at 1110. Find out why it is wrong.' },
  bus: { title: 'Extend the Bus Bridge', detail: 'Wire each junction socket to the correct bus, then run the controller.' },
  chamber: { title: 'Restart the turbine sequencer', detail: 'The sequencer crashes every run. Find the instruction that sends the PC astray.' },
  core: { title: 'Restart the Core', detail: 'Write a program that stores 40 in IGNITION (1111).' },
  done: { title: 'The Archive is running', detail: 'Explore freely. Every machine you repaired is still executing.' },
};

export const HINTS: Record<PuzzleId, [string, string, string]> = {
  workshop: [
    'Look at the status line: which stage is the controller in? Which register lights up next?',
    'Fetch always ends with the instruction in the CIR and the PC pointing at the next address. Keep pressing Step and read each micro-operation.',
    'Press Step repeatedly (or Run). LDA 1110 loads 1 into the ACC, STA 1111 stores it in the latch, HLT stops the controller.',
  ],
  vault: [
    'Read the calibration record on the vault wall and compare it with the pillar for address 1101.',
    'The program never changes — it always adds the data at 1100 to the data at 1101 and stores the result at 1110. Only the data can be wrong.',
    'Open pillar 1101 (OFFSET), set its value to 00000101 (5), then run the vault controller.',
  ],
  bus: [
    'Read the conduit tags. Each colour is a different bus with a different job.',
    'Ask of each socket: is this an address, a value, or a signal? A value travels on the data bus in both directions.',
    'MAR→RAM: address. CU→RAM: control. RAM→MDR: data. MDR→RAM: data.',
  ],
  chamber: [
    'Run the sequencer and watch the PC just before the crash. Which address does it jump to?',
    'Address 1100 holds COUNT, a data value. A branch must send the PC to an instruction — where does the loop begin?',
    'Edit the instruction at 0100 so it reads BRA 0000.',
  ],
  core: [
    'IGNITION = FUEL − DAMPER. Which addresses hold FUEL and DAMPER?',
    'Load one value into the accumulator, use the ALU to subtract the other, then store the accumulator — and remember to halt.',
    'LDA 1100 · SUB 1101 · STA 1111 · HLT.',
  ],
};

/** Prediction prompts: asked before the outcome is shown, then tested by the simulation. */
export interface Prediction { id: string; question: string; options: string[]; answer: number; explain: string; }
export const PREDICTIONS: Record<string, Prediction> = {
  ldaAddress: {
    id: 'ldaAddress', question: 'The CIR holds LDA 1110. What will arrive in the accumulator?',
    options: ['1110 — the address itself', 'The value stored at address 1110'], answer: 1,
    explain: 'LDA uses its operand as an address. The MAR is set to 1110, RAM sends the contents of that cell back on the data bus, and that value is loaded into the ACC.',
  },
  pcAfterFetch: {
    id: 'pcAfterFetch', question: 'Fetch just copied the instruction into the CIR. What happens to the PC next?',
    options: ['It is incremented to point at the next instruction', 'It is cleared to 0000', 'It stays the same until the instruction finishes'], answer: 0,
    explain: 'The PC is incremented during fetch, so it already points at the next instruction while the current one is decoded and executed.',
  },
};
