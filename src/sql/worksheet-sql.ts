// Cambridge worksheets spell sorting directions out. SQLite uses ASC/DESC.
// Recognize the longer words only as trailing sort directions in ORDER BY;
// do not change quoted names, strings, comments or bare field names.
export function normalizeSortDirections(sql: string): string {
  const tokens = sql.match(/--[^\r\n]*|\/\*[\s\S]*?(?:\*\/|$)|'(?:''|[^'])*(?:'|$)|"(?:""|[^"])*(?:"|$)|`(?:``|[^`])*(?:`|$)|\[[^\]]*(?:\]|$)|\s+|[A-Za-z_][\w$]*|[^\s]/g) ?? [];
  const significant = tokens.map((token,i)=>({token,i})).filter(({token})=>!(/^\s+$/.test(token)||token.startsWith('--')||token.startsWith('/*')));
  const order = new Set<number>();
  let depth = 0;
  for (let i = 0; i < significant.length; i++) {
    const {token, i: index} = significant[i];
    const word = token.toUpperCase();
    const previous = significant[i-1]?.token.toUpperCase() ?? '';
    const next = significant[i+1]?.token.toUpperCase() ?? '';
    if (token === '(') { depth++; continue; }
    if (token === ')') { order.delete(depth); depth = Math.max(0,depth-1); continue; }
    if (word === 'BY' && previous === 'ORDER') { order.add(depth); continue; }
    if (['SELECT','FROM','WHERE','GROUP','HAVING','LIMIT','OFFSET','UNION','INTERSECT','EXCEPT','RETURNING',';'].includes(word)) { order.delete(depth); continue; }
    if (!order.has(depth) || !['ASCENDING','DESCENDING'].includes(word)) continue;
    if (!previous || ['BY',',','.','(','+','-','*','/','%','=','<','>','!','|','&','~','COLLATE','ASC','DESC'].includes(previous)) continue;
    if (next && ![',',')',';','LIMIT','OFFSET','NULLS','UNION','INTERSECT','EXCEPT'].includes(next)) continue;
    tokens[index] = word === 'ASCENDING' ? 'ASC' : 'DESC';
  }
  return tokens.join('');
}
