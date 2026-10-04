import type { Token } from './ast';

export const KEYWORDS = new Set(['DECLARE','CONSTANT','INPUT','OUTPUT','IF','THEN','ELSE','ENDIF','CASE','OF','OTHERWISE','ENDCASE','WHILE','DO','ENDWHILE','FOR','TO','STEP','NEXT','REPEAT','UNTIL','PROCEDURE','ENDPROCEDURE','FUNCTION','RETURNS','ENDFUNCTION','CALL','RETURN','OPENFILE','READFILE','WRITEFILE','CLOSEFILE','READ','WRITE','ARRAY','AND','OR','NOT','TRUE','FALSE']);
export const TYPES = new Set(['INTEGER','REAL','CHAR','STRING','BOOLEAN']);
export const ROUTINES = new Set(['ROUND','LENGTH','SUBSTRING','UCASE','LCASE','UPPER','LOWER','DIV','MOD','RANDOM']);
export const COMPLETIONS = ['DECLARE','CONSTANT','INPUT','OUTPUT','IF','THEN','ELSE','ENDIF','CASE','OF','OTHERWISE','ENDCASE','WHILE','DO','ENDWHILE','FOR','TO','STEP','NEXT','REPEAT','UNTIL','PROCEDURE','ENDPROCEDURE','FUNCTION','RETURNS','ENDFUNCTION','CALL','RETURN','INTEGER','REAL','CHAR','STRING','BOOLEAN','ARRAY','TRUE','FALSE','AND','OR','NOT','DIV','MOD','ROUND','LENGTH','SUBSTRING','UCASE','LCASE','RANDOM','OPENFILE','READFILE','WRITEFILE','CLOSEFILE'];
export class PicoSyntaxError extends Error { constructor(message: string, public line: number, public column: number, public code = 'syntax') { super(message); this.name = 'PicoSyntaxError'; } }
export function tokenize(source: string): Token[] {
  const tokens: Token[] = []; const lines = source.replace(/<--/g, '←').replace(/[“”]/g, '"').split('\n');
  lines.forEach((line, index) => { let i = 0; const lineNo = index + 1;
    while (i < line.length) {
      if (/\s/.test(line[i]!)) { i++; continue; }
      if (line.startsWith('//', i)) break;
      const start = i;
      if (line[i] === '"') { i++; let escaped = false; while (i < line.length) { const ch=line[i]!; if(ch==='"'&&!escaped){i++;break;} if(ch==='\\'&&!escaped) escaped=true; else escaped=false; i++; } if(line[i-1]!=='"'||i-1===start) throw new PicoSyntaxError('This text string is not closed. Add a closing double quote.',lineNo,start+1); let value:string; try{value=JSON.parse(line.slice(start,i)) as string;}catch{throw new PicoSyntaxError('This text string contains an invalid escape.',lineNo,start+1);} tokens.push({type:'STRING',value,line:lineNo,column:start+1,endColumn:i+1}); continue; }
      if (/\d/.test(line[i]!)) { i++; while(i<line.length&&/[\d.]/.test(line[i]!))i++; const raw=line.slice(start,i); if(!/^\d+(\.\d+)?$/.test(raw))throw new PicoSyntaxError(`“${raw}” is not a valid number.`,lineNo,start+1); tokens.push({type:'NUMBER',value:raw,line:lineNo,column:start+1,endColumn:i+1}); continue; }
      if (/[A-Za-z_]/.test(line[i]!)) { i++; while(i<line.length&&/[A-Za-z0-9_]/.test(line[i]!))i++; const value=line.slice(start,i), upper=value.toUpperCase(); const type=KEYWORDS.has(upper)?upper:TYPES.has(upper)?upper:'IDENTIFIER'; tokens.push({type,value,line:lineNo,column:start+1,endColumn:i+1}); continue; }
      const pair=line.slice(i,i+2); if(pair==='<-'||pair==='<='||pair==='>='||pair==='<>'||pair==='!='){ tokens.push({type:pair==='<-'?'ARROW':pair.trim(),value:pair.trim(),line:lineNo,column:i+1,endColumn:i+3}); i+=2; continue; }
      const ch=line[i]!; if(ch==='←')tokens.push({type:'ARROW',value:ch,line:lineNo,column:i+1,endColumn:i+2}); else if(':=<>+-*/^(),[]'.includes(ch))tokens.push({type:ch,value:ch,line:lineNo,column:i+1,endColumn:i+2}); else throw new PicoSyntaxError(`“${ch}” is not used in this Cambridge pseudocode subset.`,lineNo,i+1); i++;
    }
    tokens.push({type:'NEWLINE',value:'',line:lineNo,column:line.length+1,endColumn:line.length+1});
  });
  tokens.push({type:'EOF',value:'',line:lines.length+1,column:1,endColumn:1}); return tokens;
}
