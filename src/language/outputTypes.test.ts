import {describe,expect,it} from 'vitest';
import {compile} from './index';
import {parse} from './parser';
import {tokenize} from './lexer';
import {execute} from '../runtime/interpreter';
import {createInteractiveSession,type WorkerReply} from '../runtime/worker';

const constants='CONSTANT Name <- 3\nCONSTANT Name2 <- 4\nCONSTANT TIME <- "4"\n';
describe('arithmetic and comma-separated OUTPUT values',()=>{
  it.each([
    ['OUTPUT Name + Name2','7'],
    ['OUTPUT TIME','4'],
    ['OUTPUT Name + Name2, TIME','74'],
    ['OUTPUT Name, Name2','34'],
    ['OUTPUT "Hello", " ", "world"','Hello world'],
    ['OUTPUT "Total: ", Name + Name2','Total: 7'],
    ['OUTPUT 2 + 3 * 4, "/", (2 + 3) * 4','14/20'],
    ['OUTPUT 3 + 4.5','7.5'],
    ['OUTPUT LENGTH("Happy Days"), LCASE(\'W\'), UCASE("Happy"), SUBSTRING("Happy Days", 1, 5)','10wHAPPYHappy'],
  ])('preserves %s', (statement,expected)=>{
    expect(execute(compile(constants+statement).ast).output).toEqual([expected]);
  });
  it.each(['Name + Name2 + TIME','TIME + Name','3 + "4"','"3" + 4','"3" + "4"',"'3' + 4",'TRUE + 4'])('rejects nonnumeric addition: %s',expression=>{
    const source=constants+'OUTPUT '+expression;
    expect(()=>compile(source)).toThrow(/\+ needs numeric values/);
    // Direct interpreter callers also receive a positioned error, never coercion.
    try{execute(parse(tokenize(source)));throw Error('Expected rejection');}
    catch(error){expect(error).toMatchObject({name:'RuntimeError',line:4,message:expect.stringMatching(/\+ needs numeric values/)});}
  });
  it('streams comma-separated values unchanged through the interactive console worker',()=>{
    const messages:WorkerReply[]=[];
    const session=createInteractiveSession({ast:compile(constants+'OUTPUT Name + Name2, TIME').ast,interactive:true,runs:[{inputs:[],options:{}}]},reply=>messages.push(reply));
    session.start();
    expect(messages[0]).toEqual({type:'output',lines:['74']});
  });
});

describe('numeric literal types shared with auto declaration', () => {
  it('keeps whole-valued decimal constants REAL', () => {
    expect(() => compile('CONSTANT N ← 3.0\nDECLARE Count : INTEGER\nCount ← N')).toThrow(/Cannot assign REAL/);
    expect(() => compile('OUTPUT 3.0 DIV 2')).toThrow(/INTEGER/);
    expect(() => compile('OUTPUT MOD(3.0, 2)')).toThrow(/INTEGER/);
    expect(execute(compile('OUTPUT 3.0 + 4, ",", 3 DIV 2').ast).output).toEqual(['7,1']);
  });
});
