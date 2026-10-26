import {autoLayoutCircuit} from './layout';
import {makeDocument,makeNode,parseDocument,type CircuitDocument,type ComponentKind,type CircuitNode} from './model';

type Expr={kind:'variable';name:string}|{kind:'constant';value:0|1}|{kind:'not';child:Expr}|{kind:'binary';gate:'and'|'or'|'xor';left:Expr;right:Expr};
const tokenPattern=/\s+|&&|\|\||[()!^·+.]|[A-Za-z_][A-Za-z_0-9]*|[01]/gy;

/** Parse a selected Boolean expression and build a circuit with one output lamp. */
export function circuitFromExpression(source:string):CircuitDocument{
 const input=source.trim();
 if(!input)throw Error('Select a Boolean expression such as A AND B in the editor first.');
 if(input.length>240||input.includes('\n'))throw Error('Select one short Boolean expression, not a whole program.');
 const tokens:string[]=[];let index=0;
 while(index<input.length){tokenPattern.lastIndex=index;const match=tokenPattern.exec(input);if(!match)throw Error(`Unsupported character “${input[index]}”. Use AND, OR, XOR, NOT and parentheses.`);index=tokenPattern.lastIndex;if(!/^\s+$/.test(match[0]))tokens.push(match[0]);}
 let cursor=0;
 const peek=()=>tokens[cursor]?.toUpperCase();
 const take=()=>tokens[cursor++];
 function atom():Expr{
  const token=take();if(!token)throw Error('The expression ends before an input or closing parenthesis.');
  const upper=token.toUpperCase();
  if(upper==='NOT'||token==='!')return {kind:'not',child:atom()};
  if(token==='('){const expression=parse(0);if(take()!==')')throw Error('Add a closing parenthesis.');return expression;}
  if(upper==='TRUE'||token==='1')return {kind:'constant',value:1};
  if(upper==='FALSE'||token==='0')return {kind:'constant',value:0};
  if(/^[A-Za-z_][A-Za-z_0-9]*$/.test(token)&&!['AND','OR','XOR'].includes(upper))return {kind:'variable',name:token};
  throw Error(`Expected an input, NOT, or “(” before “${token}”.`);
 }
 const operators:Record<string,{gate:'and'|'or'|'xor';precedence:number}>={AND:{gate:'and',precedence:3},'&&':{gate:'and',precedence:3},'·':{gate:'and',precedence:3},'.':{gate:'and',precedence:3},XOR:{gate:'xor',precedence:2},'^':{gate:'xor',precedence:2},OR:{gate:'or',precedence:1},'||':{gate:'or',precedence:1},'+':{gate:'or',precedence:1}};
 function parse(minimum:number):Expr{let left=atom();while(true){const operator=operators[peek()??''];if(!operator||operator.precedence<minimum)break;take();left={kind:'binary',gate:operator.gate,left,right:parse(operator.precedence+1)};}return left;}
 const tree=parse(0);if(cursor!==tokens.length)throw Error(`Unexpected “${tokens[cursor]}”. Check the expression syntax.`);
 const doc=makeDocument(`From code: ${input.slice(0,100)}`),variables=new Map<string,CircuitNode>();
 const connect=(from:CircuitNode,to:CircuitNode,toPin:string)=>doc.wires.push({id:crypto.randomUUID(),from:from.id,fromPin:'Q',to:to.id,toPin});
 function build(expr:Expr):CircuitNode{
  if(expr.kind==='variable'){
   const key=expr.name.toUpperCase();let node=variables.get(key);
   if(!node){if(variables.size>=8)throw Error('Use at most 8 different inputs in one circuit.');node=makeNode('switch',0,0,key);variables.set(key,node);doc.nodes.push(node);}return node;
  }
  if(doc.nodes.length>=60)throw Error('This expression is too large for the handoff.');
  if(expr.kind==='constant'){const node=makeNode(expr.value?'high':'low',0,0);doc.nodes.push(node);return node;}
  const node=makeNode((expr.kind==='not'?'not':expr.gate) as ComponentKind,0,0);doc.nodes.push(node);
  if(expr.kind==='not')connect(build(expr.child),node,'A');else{connect(build(expr.left),node,'A');connect(build(expr.right),node,'B');}
  return node;
 }
 const root=build(tree),lamp=makeNode('lamp',0,0,'Result');doc.nodes.push(lamp);connect(root,lamp,'IN');
 return parseDocument(autoLayoutCircuit(doc));
}

/** Replace exactly two direct drivers of a lamp with an explicit AND gate. */
export function combineLampDriversWithAnd(doc:CircuitDocument):CircuitDocument|null{
 const lamp=doc.nodes.find(node=>node.kind==='lamp'&&doc.wires.filter(wire=>wire.to===node.id&&wire.toPin==='IN').length===2);
 if(!lamp)return null;
 const incoming=doc.wires.filter(wire=>wire.to===lamp.id&&wire.toPin==='IN');
 const gate=makeNode('and',0,0);
 const wires=doc.wires.filter(wire=>!incoming.includes(wire));
 incoming.forEach((wire,index)=>wires.push({...wire,to:gate.id,toPin:index===0?'A':'B'}));
 wires.push({id:crypto.randomUUID(),from:gate.id,fromPin:'Q',to:lamp.id,toPin:'IN'});
 return autoLayoutCircuit({...doc,nodes:[...doc.nodes,gate],wires});
}
