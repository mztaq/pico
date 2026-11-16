/**
 * Expanded revision notes for the existing Pico learning topics.
 *
 * Each entry builds on the original topic summary and example in content.ts.
 * Keep terminology accessible to Cambridge IGCSE Computer Science learners.
 */
export type TopicNotes = {
  points: string[];
  exampleSteps?: string[];
  remember?: string;
};

export const topicNotes: Record<string, TopicNotes> = {
  'number-systems': {
    points: [
      'An 8-bit binary number has place values 128, 64, 32, 16, 8, 4, 2 and 1, from left to right.',
      'To convert binary to denary, add the place values wherever the bit is 1.',
      'To convert binary to hexadecimal, split the bits into groups of four from the right. Each group represents one hex digit (0–9 or A–F).',
      'To convert denary to binary, find which powers of two add up to the number, or repeatedly divide by two and read the remainders from bottom to top.',
    ],
    exampleSteps: [
      'Write 0010 1101 beneath the eight place values.',
      'The 1s appear in the 32, 8, 4 and 1 columns: 32 + 8 + 4 + 1 = 45.',
      'Split into 0010 | 1101. Those groups are 2 and D, so the hex value is 2D.',
      'Check: 2 × 16 + 13 = 45.',
    ],
    remember: 'A bit is one binary digit. A nibble is four bits. A byte is eight bits.',
  },
  'text-media': {
    points: [
      'Character sets assign a unique binary code to each supported character. ASCII has a smaller character range than Unicode.',
      'A bitmap image is made from pixels. Resolution is its width and height in pixels, while colour depth is the number of bits used for each pixel.',
      'Digital sound is produced by sampling the amplitude of an analogue wave at regular intervals.',
      'Sample rate is samples per second. Sample resolution (bit depth) is the number of bits used for each sample.',
    ],
    exampleSteps: [
      'Take a smooth sound wave and measure its amplitude eight times in a fixed interval.',
      'Round each measurement to an available digital level. More bits per sample mean more possible levels.',
      'With 8 samples and 3 bits per sample, one channel uses 8 × 3 = 24 bits, excluding overhead.',
      'Increase either setting in the model below and watch the bit count change.',
    ],
    remember: 'Higher resolution or sample quality usually increases file size when the other settings stay the same.',
  },
  'storage-compression': {
    points: [
      'For an uncompressed bitmap: size in bits = width × height × colour depth.',
      'For uncompressed sound: size in bits = sample rate × duration × sample resolution × number of channels.',
      'Lossless compression reduces file size without discarding information, so the original can be reconstructed exactly.',
      'Lossy compression removes some information to achieve a smaller file. The original cannot be recovered exactly.',
    ],
    exampleSteps: [
      'Take a short recording containing 10 samples, each stored using 3 bits.',
      'Calculate 10 × 3 = 30 bits for one channel before metadata or file headers.',
      'Double the sample count to 20: the data now takes 20 × 3 = 60 bits.',
      'Double the bit depth instead: 10 samples × 6 bits also gives 60 bits.',
    ],
    remember: 'Compression and encryption are different: compression reduces size, whereas encryption protects confidentiality.',
  },
  transmission: {
    points: [
      'Packet switching breaks a message into small packets. A packet includes a header, payload and often error-checking data.',
      'The header identifies the destination and supports reassembly, for example through sequence information.',
      'Packets travel independently through a network, so the same message can reach the receiver by different routes.',
      'The receiver uses sequence numbers to restore the correct order and can request missing data again when the protocol supports it.',
    ],
    exampleSteps: [
      'Split HELLO PICO into short payloads such as HEL | LO  | PIC | O.',
      'Give the packets sequence numbers 1, 2, 3 and 4.',
      'If packets arrive in the order 2, 1, 4, 3, reorder them using those numbers.',
      'Join the payloads to reconstruct HELLO PICO.',
    ],
    remember: 'A router forwards packets between networks. Arriving first does not mean a packet belongs first.',
  },
  'error-detection': {
    points: [
      'Even parity adds a parity bit so that the total number of 1s in the transmitted group is even.',
      'A single changed bit causes the receiver’s parity count to become odd, revealing an error.',
      'Two flipped bits can leave the count even, so simple parity does not detect every possible error.',
      'Checksums and check digits are other ways to detect mistakes. Detecting an error is not the same as correcting it.',
    ],
    exampleSteps: [
      'Start with seven data bits: 1011010. They contain four 1s.',
      'For even parity, add 0, producing 10110100 with four 1s.',
      'If one transmitted bit changes, the receiver sees an odd number of 1s, so its parity check fails.',
      'If two bits flip, the total can stay even and the error may go undetected.',
    ],
    remember: 'A passing parity check does not prove that the data is error-free.',
  },
  encryption: {
    points: [
      'Plaintext is readable original information. An encryption algorithm and key transform it into ciphertext.',
      'Decryption converts ciphertext back to plaintext using the appropriate key.',
      'Symmetric encryption uses the same secret key for encryption and decryption.',
      'Asymmetric encryption uses a related public key and private key. The private key must remain secret.',
    ],
    exampleSteps: [
      'For a demonstration Caesar cipher, choose a shift of 3.',
      'H becomes K and I becomes L, so HI is encrypted as KL.',
      'Reverse the shift by 3 to decrypt KL back to HI.',
    ],
    remember: 'A Caesar cipher demonstrates the process but is not secure for real communication.',
  },
  'cpu-cycle': {
    points: [
      'The program counter (PC) holds the address of the next instruction to fetch.',
      'The memory address register (MAR) holds the address being accessed. The memory data register (MDR) holds the data or instruction transferred.',
      'The current instruction register (CIR) holds the instruction being decoded and executed.',
      'The control unit coordinates the fetch–decode–execute cycle. The arithmetic logic unit (ALU) performs arithmetic and logic operations.',
    ],
    exampleSteps: [
      'Copy the address in the PC to the MAR.',
      'Fetch the instruction from memory into the MDR.',
      'Copy the instruction into the CIR and advance the PC.',
      'Decode the instruction, then execute it. A jump instruction may change the PC.',
    ],
    remember: 'The PC holds an address, not the instruction itself.',
  },
  'input-output': {
    points: [
      'Input devices send data or instructions into a computer. Examples include keyboards, microphones and scanners.',
      'Output devices present information or produce an action, such as monitors, speakers and actuators.',
      'Sensors measure physical quantities such as temperature, light or pressure.',
      'A control system processes a sensor reading, compares it with a target or rule, then triggers an output.',
    ],
    exampleSteps: [
      'A temperature sensor measures the room temperature: this is the input.',
      'The controller compares the value with the chosen temperature.',
      'If the room is too cold, it activates the heater: this is the output.',
      'It repeats the process as new sensor readings arrive.',
    ],
    remember: 'A sensor is a specialised input device. An actuator makes a physical change.',
  },
  'data-storage': {
    points: [
      'RAM stores programs and data currently in use. It is volatile, so its contents are lost without power.',
      'ROM normally holds instructions that do not need to change frequently, such as startup firmware. It is non-volatile.',
      'Secondary storage, such as SSDs and hard disks, holds files and programs long-term.',
      'Storage capacity, read/write speed, durability, portability and cost all affect which device is suitable.',
    ],
    exampleSteps: [
      'Open an essay: the computer loads the document and editor into RAM to work on them.',
      'Edit the essay: unsaved changes are held temporarily while the application runs.',
      'Save the document to an SSD: the file persists after shutdown.',
    ],
    remember: 'Saving is different from keeping an application open in RAM.',
  },
  'network-hardware': {
    points: [
      'A network interface card (NIC) provides a device’s connection to a wired or wireless network.',
      'A switch forwards frames between devices on a local network. A router forwards data between networks.',
      'MAC addresses identify network interfaces on a local link. IP addresses support logical addressing between networks.',
      'IP addresses often change between networks. Some modern devices also use randomised MAC addresses for privacy.',
    ],
    exampleSteps: [
      'At home, a laptop receives an IP address from the home network.',
      'At a café, it joins another network and receives a different IP address.',
      'The network adapter uses a MAC address for local communication, though some devices randomise it per network.',
    ],
    remember: 'A MAC address is not a guaranteed permanent identity for a device.',
  },
  software: {
    points: [
      'System software manages hardware and provides services to programs. Operating systems, utilities and translators are examples.',
      'Application software helps users complete specific tasks, such as writing a document or editing a photo.',
      'An interrupt is a signal that needs CPU attention while another task is running.',
      'The CPU saves enough of its state, runs an interrupt service routine, and then resumes the interrupted work.',
    ],
    exampleSteps: [
      'A user presses a key while another program is running.',
      'The keyboard sends an interrupt request.',
      'The CPU handles the input in an interrupt service routine.',
      'The CPU returns to the task it was doing before.',
    ],
    remember: 'An interrupt lets the CPU respond to an event without constantly checking for it.',
  },
  translators: {
    points: [
      'A compiler translates a complete high-level program before its translated version is run.',
      'An interpreter translates and executes code as the program runs, usually reporting errors when the affected statement is reached.',
      'An assembler converts assembly language into machine code.',
      'An integrated development environment (IDE) commonly offers an editor, run controls, error reporting and debugging tools.',
    ],
    exampleSteps: [
      'Write a small program that outputs HELLO.',
      'A compiler checks and translates the program before running the result.',
      'An interpreter processes the instructions during execution.',
      'Use an IDE breakpoint to inspect a variable at a chosen line.',
    ],
    remember: 'A compiler and an interpreter translate programs differently. Neither guarantees a program has no logic errors.',
  },
  internet: {
    points: [
      'The internet is the worldwide infrastructure connecting many networks.',
      'The World Wide Web is a service that uses the internet to provide linked pages and resources.',
      'DNS translates a domain name into an IP address used to contact a server.',
      'HTTP defines web requests and responses. HTTPS protects the connection using encryption.',
    ],
    exampleSteps: [
      'Enter a website address into a browser.',
      'DNS helps the browser find the server’s IP address.',
      'The browser sends an HTTP or HTTPS request.',
      'The server responds, and the browser displays the returned page.',
    ],
    remember: 'Email and file transfer also use the internet, but they are not the World Wide Web.',
  },
  currency: {
    points: [
      'A digital currency is value represented and transferred electronically.',
      'An electronic payment is a transaction made digitally. It does not automatically mean the money is a distinct digital currency.',
      'Payment systems must record the transaction and protect users from unauthorised access.',
    ],
    exampleSteps: [
      'You pay for a bus ticket with a phone linked to a bank card.',
      'The payment information is sent electronically and the bank account balance is adjusted.',
      'No physical cash changes hands, but the transaction may still involve ordinary bank money rather than a cryptocurrency.',
    ],
    remember: 'Keep digital payments and cryptocurrencies distinct when explaining examples.',
  },
  security: {
    points: [
      'Malware includes viruses, worms, Trojans and other malicious software. Their methods of spreading or disguising themselves differ.',
      'Phishing tries to trick someone into sharing credentials or sensitive information, often using a fake message or website.',
      'A firewall filters traffic according to security rules. Anti-malware software detects and removes known threats.',
      'Strong unique passwords, multi-factor authentication, backups and software updates reduce different risks.',
    ],
    exampleSteps: [
      'A message claims that your school account will close unless you sign in immediately.',
      'The link leads to a fake page designed to collect your password.',
      'Check the sender, address and request before entering anything. Open the service through its known website instead.',
    ],
    remember: 'A firewall does not replace checking links, backups or secure passwords.',
  },
  automated: {
    points: [
      'An automated system takes input, processes it using a rule or program, and produces output without a person controlling each action.',
      'Sensors provide real-world measurements, and actuators carry out physical actions.',
      'Feedback lets a controller respond to new readings and adjust its behaviour.',
    ],
    exampleSteps: [
      'A motion sensor detects someone approaching a door.',
      'The controller checks whether the sensor signal meets the open-door condition.',
      'The door motor opens the door.',
      'After a suitable delay or a new sensor reading, the controller closes it safely.',
    ],
    remember: 'Automation does not require artificial intelligence. Fixed control rules are enough.',
  },
  robotics: {
    points: [
      'A robot combines physical components with control software to carry out tasks.',
      'Sensors detect the environment. A controller processes readings and decides the next action.',
      'Actuators, such as electric motors, move the robot or one of its parts.',
      'A robot may work autonomously, follow pre-programmed instructions or receive remote commands.',
    ],
    exampleSteps: [
      'A robot vacuum moves towards a wall.',
      'Its bump sensor detects contact.',
      'Its program decides to turn away.',
      'The wheel motors change direction and move it elsewhere.',
    ],
    remember: 'Identify the sensor, decision and actuator separately in exam answers.',
  },
  ai: {
    points: [
      'Artificial intelligence refers to systems designed to perform tasks associated with learning, pattern recognition, reasoning or decision-making.',
      'Machine learning methods learn patterns from training data instead of relying entirely on manually written rules.',
      'Predictions are not guaranteed to be correct. The quality and representativeness of training data matter.',
      'AI systems raise issues such as bias, privacy, accountability and reliance on incorrect outputs.',
    ],
    exampleSteps: [
      'A video platform records which videos a viewer has watched and rated.',
      'A recommendation model uses patterns in this history to rank possible suggestions.',
      'When preferences change, new data may lead to different recommendations.',
    ],
    remember: 'A basic calculator follows explicit arithmetic rules and is not normally classified as AI.',
  },
  development: {
    points: [
      'Analysis identifies the problem, users and requirements of the proposed solution.',
      'Design plans the data, algorithms, interfaces and tests before implementation.',
      'Implementation builds the program. Testing checks whether it meets requirements and handles errors.',
      'Maintenance fixes faults or changes the system after it has been released.',
    ],
    exampleSteps: [
      'Ask teachers what information an attendance system needs: analysis.',
      'Plan its screens and records: design.',
      'Write the application: implementation.',
      'Test it with normal and unusual inputs: testing.',
      'Correct later bugs or update features: maintenance.',
    ],
    remember: 'Testing is not the same as maintenance. Testing checks the system; maintenance changes it after delivery.',
  },
  decomposition: {
    points: [
      'Decomposition divides a large task into manageable subproblems.',
      'Each part can be analysed, implemented and tested separately.',
      'The solutions must still work together to solve the original task.',
    ],
    exampleSteps: [
      'To organise a school disco, list its major parts.',
      'Divide the work into venue, music, tickets and food.',
      'Assign each part its own plan and tasks.',
      'Combine the parts and check that the event works as a whole.',
    ],
    remember: 'Decomposition is about breaking a problem into parts, not simply writing more steps.',
  },
  algorithms: {
    points: [
      'An algorithm is a finite sequence of clear steps that solves a problem.',
      'Sequence runs instructions in order. Selection chooses between paths. Iteration repeats actions.',
      'Flowcharts use symbols for actions, decisions and input/output; pseudocode describes the same logic in structured language.',
      'A good algorithm covers expected outcomes, including failure or invalid input.',
    ],
    exampleSteps: [
      'INPUT the entered password.',
      'COMPARE it with the correct value.',
      'IF they match, OUTPUT "Access granted".',
      'ELSE OUTPUT "Access denied".',
    ],
    remember: 'Every path through the algorithm should have a clear outcome.',
  },
  'search-sort': {
    points: [
      'Linear search checks elements one by one and works even when the list is unsorted.',
      'Binary search repeatedly halves the search area, but the data must already be sorted.',
      'Bubble sort compares adjacent values and swaps them when they are out of order.',
      'A trace should show comparisons, swaps and stopping conditions, not only the final result.',
    ],
    exampleSteps: [
      'Search [5, 2, 8] for 8 using linear search.',
      'Compare 5 with 8: not equal.',
      'Compare 2 with 8: not equal.',
      'Compare 8 with 8: found on the third comparison.',
    ],
    remember: 'Binary search requires sorted data. Linear search does not.',
  },
  validation: {
    points: [
      'Validation checks data against rules such as range, type, length, format or presence.',
      'Verification checks whether data was copied or entered as intended, for example by double-entry or visual inspection.',
      'Normal, boundary and abnormal test data help check validation rules.',
      'Trace tables follow how a program’s variables change after each statement or iteration.',
    ],
    exampleSteps: [
      'A range check accepts ages from 0 to 120 inclusive.',
      'An age of 16 is valid under this rule; 160 is rejected.',
      'However, 16 might still be the wrong age for the person, so validation does not prove truth.',
    ],
    remember: 'Valid data is not automatically correct data.',
  },
  errors: {
    points: [
      'A syntax error breaks the language’s grammar and is often detected before execution.',
      'A runtime error happens while the program runs, such as dividing by zero.',
      'A logic error lets the program run but produce the wrong answer.',
      'Dry runs, trace tables and boundary tests help reveal logic mistakes.',
    ],
    exampleSteps: [
      'Suppose a loop should add five numbers but executes only four times.',
      'If the fifth number is zero, the result still looks correct and the fault stays hidden.',
      'Test a non-zero fifth value and trace the count to expose the missing iteration.',
    ],
    remember: 'One passing test does not prove the program is correct.',
  },
  programming: {
    points: [
      'Variables hold values that can change. Constants are names whose values do not change during execution.',
      'Sequence executes statements in order. IF statements provide selection.',
      'FOR, WHILE and REPEAT loops provide iteration, but their conditions and stopping rules differ.',
      'Use appropriate data types such as INTEGER, REAL, STRING, CHAR and BOOLEAN.',
    ],
    exampleSteps: [
      'Set Count to 0.',
      'Repeat Count ← Count + 1 three times.',
      'The values printed are 1, then 2, then 3.',
    ],
    remember: 'A loop needs a correct stopping condition. An off-by-one error can change how many times it runs.',
  },
  arrays: {
    points: [
      'An array stores multiple elements of the same type under one name.',
      'An index selects an individual element. In Cambridge-style pseudocode, the declared bounds define the valid indexes.',
      'A one-dimensional array acts like a list. A two-dimensional array has rows and columns.',
      'Loops are useful for visiting each element or finding a total, maximum or match.',
    ],
    exampleSteps: [
      'Declare an array Scores with valid positions 1 to 3.',
      'Store 12, 17 and 14 in positions 1, 2 and 3.',
      'Scores[2] gives 17, the second value.',
      'A loop over positions 1 to 3 visits all three scores.',
    ],
    remember: 'Using an index outside the declared bounds is an error.',
  },
  files: {
    points: [
      'File handling keeps information after a program ends.',
      'READ mode reads existing data. WRITE mode creates or replaces file contents. APPEND adds new data after what is already there.',
      'Always close files after use to release resources and ensure writes finish.',
      'A program should handle cases where the file is missing or cannot be opened.',
    ],
    exampleSteps: [
      'Open a leaderboard file for reading to show current scores.',
      'Close it after the entries are read.',
      'Open it again in append mode to add a new score without deleting existing entries.',
    ],
    remember: 'WRITE and APPEND are not interchangeable if you need to preserve existing records.',
  },
  database: {
    points: [
      'A database table contains records (rows) and fields (columns).',
      'A primary key uniquely identifies each record. It must not be duplicated.',
      'A suitable field type helps prevent inappropriate values, such as text in a numeric score field.',
      'Queries retrieve or filter the records needed for a task.',
    ],
    exampleSteps: [
      'Create a Students table with StudentID, Name and Year fields.',
      'Add students with IDs 101, 102 and 103.',
      'Two students may share a name, but their StudentID values stay unique.',
    ],
    remember: 'Names are often unsuitable as primary keys because they are not guaranteed to be unique.',
  },
  sql: {
    points: [
      'SELECT chooses which fields to display.',
      'FROM identifies the table to read.',
      'WHERE filters records using a condition.',
      'Use * after SELECT to retrieve every field, or name only the fields you need.',
    ],
    exampleSteps: [
      'SELECT Name FROM Students WHERE Year = 10; returns only Name for students in Year 10.',
      'SELECT * FROM Students; returns every field for all records.',
      'SELECT Name, Year FROM Students WHERE StudentID = 101; returns two fields for one record.',
    ],
    remember: 'WHERE filters records (rows). SELECT chooses fields (columns).',
  },
  logic: {
    points: [
      'AND outputs 1 only if both inputs are 1. OR outputs 1 if at least one input is 1.',
      'NOT reverses one input: NOT 1 = 0 and NOT 0 = 1.',
      'XOR outputs 1 when its two inputs differ.',
      'NAND is NOT AND, NOR is NOT OR, and XNOR is NOT XOR.',
    ],
    exampleSteps: [
      'Take A = 1 and B = 1.',
      'AND(1,1) = 1; OR(1,1) = 1; XOR(1,1) = 0.',
      'Now set B = 0: AND(1,0) = 0; OR(1,0) = 1; XOR(1,0) = 1.',
    ],
    remember: 'XOR is different from OR when both inputs are 1.',
  },
};
