import { useState } from 'react';
import { HighlightedCode } from './HighlightedCode';
const entries = [
  {word:'print',description:'Write text or values to the Console.',code:'name = "Pico"\nprint("Hello", name)'},
  {word:'input',description:'Wait for text typed in the Console. Convert it when you need a number.',code:'age = int(input("Enter your age: "))\nprint(age)'},
  {word:'int',description:'Convert a value to a whole number. Invalid text raises ValueError.',code:'number = int(input("Enter a whole number: "))\nprint(number)'},
  {word:'float',description:'Convert a value to a floating-point number. Python accepts both "5" and "5.0".',code:'number = float(input("Enter a number: "))\nprint(number)'},
  {word:'if',description:'Choose a branch based on a condition. Indent the body.',code:'score = 75\nif score >= 50:\n    print("Pass")\nelse:\n    print("Try again")'},
  {word:'for',description:'Repeat over a sequence. The end of range is exclusive.',code:'for number in range(1, 6):\n    print(number)'},
  {word:'while',description:'Repeat while a condition is true. Use Stop to end an infinite loop.',code:'number = 1\nwhile number <= 5:\n    print(number)\n    number += 1'},
  {word:'def',description:'Define a function with parameters and a return value.',code:'def double(number):\n    return number * 2\n\nprint(double(5))'},
  {word:'list',description:'Store a sequence of values. List indexes start at zero.',code:'names = ["Amar", "Mustaqim"]\nprint(names[0])\nnames.append("Pico")'},
  {word:'dict',description:'Store values under named keys.',code:'student = {"name": "Ada", "score": 90}\nprint(student["name"])'},
  {word:'try',description:'Handle an exception explicitly. Unhandled exceptions end the run.',code:'try:\n    number = int(input("Enter a number: "))\nexcept ValueError:\n    print("Invalid number")'},
  {word:'open',description:'Read or write a project practice file.',code:'with open("notes.txt", "w") as file:\n    file.write("Hello Pico")\n\nwith open("notes.txt") as file:\n    print(file.read())'},
  {word:'import',description:'Import modules from Python’s standard library or another .py tab.',code:'import math\nprint(math.sqrt(16))'},
];
export function PythonReference() {
  const [word,setWord]=useState('print');
  const [search,setSearch]=useState('');
  const current=entries.find(entry=>entry.word===word)!;
  return <>
    <div className="reference-search"><input aria-label="Search Python reference" placeholder="Find a keyword" value={search} onChange={event=>setSearch(event.target.value)} /></div>
    <div className="reference-keywords">{entries.filter(entry=>entry.word.includes(search.trim().toLowerCase())).map(entry=><button className={`keyword-pill ${word===entry.word?'active':''}`} aria-pressed={word===entry.word} key={entry.word} onClick={()=>setWord(entry.word)}>{entry.word}</button>)}</div>
    <div className="reference-explanation"><strong>{current.word}</strong><p>{current.description}</p><div className="reference-example"><span className="mini-label">EXAMPLE</span><pre><HighlightedCode language="python" code={current.code} /></pre></div></div>
  </>;
}
