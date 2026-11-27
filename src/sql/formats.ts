import type { Cell } from './csv';
export type FieldFormat = 'general'|'yes-no'|'true-false'|'zero-one'|'on-off'|'integer'|'decimal2'|'decimal3'|'grouped'|'percent'|'date-dmy'|'date-mdy'|'date-iso'|'time12'|'time24'|'upper'|'lower';
export interface FieldDisplay { name:string; format:FieldFormat; }
export interface TableDisplay { table:string; fields:FieldDisplay[]; }
export const formatLabels:Record<FieldFormat,string>={general:'General', 'yes-no':'Yes / No','true-false':'True / False','zero-one':'1 / 0','on-off':'On / Off',integer:'0 decimal places',decimal2:'2 decimal places',decimal3:'3 decimal places',grouped:'Thousands separator',percent:'Percentage','date-dmy':'DD/MM/YYYY','date-mdy':'MM/DD/YYYY','date-iso':'YYYY-MM-DD',time12:'12-hour time',time24:'24-hour time',upper:'UPPERCASE',lower:'lowercase'};
const bool:FieldFormat[]=['yes-no','true-false','zero-one','on-off'];
const numeric:FieldFormat[]=['integer','decimal2','decimal3','grouped','percent'];
export function availableFormats(type:string):FieldFormat[]{
  const t=type.toUpperCase();
  if(t.includes('BOOL'))return ['general',...bool];
  if(/INT|REAL|FLOAT|DOUBLE|NUMERIC|DECIMAL/.test(t))return ['general',...numeric,...bool];
  if(/DATETIME|TIMESTAMP/.test(t))return ['general','date-dmy','date-mdy','date-iso','time12','time24'];
  if(t.includes('DATE'))return ['general','date-dmy','date-mdy','date-iso'];
  if(t.includes('TIME'))return ['general','time12','time24'];
  if(/TEXT|CHAR|CLOB/.test(t))return ['general','upper','lower'];
  return ['general'];
}
export function formatCell(value:Cell,format:FieldFormat='general'):string{
  if(value===null)return 'NULL';
  const text=String(value);
  if(bool.includes(format)){
    const normalized=text.toLowerCase().trim();
    const truth=['1','true','yes','on'].includes(normalized)?true:['0','false','no','off'].includes(normalized)?false:null;
    if(truth===null)return text;
    if(format==='yes-no')return truth?'Yes':'No';
    if(format==='true-false')return truth?'True':'False';
    if(format==='on-off')return truth?'On':'Off';
    return truth?'1':'0';
  }
  if(numeric.includes(format)&&typeof value==='number'&&Number.isFinite(value)){
    if(format==='integer')return value.toFixed(0);
    if(format==='decimal2')return value.toFixed(2);
    if(format==='decimal3')return value.toFixed(3);
    if(format==='grouped')return value.toLocaleString('en-US',{maximumFractionDigits:12});
    return (value*100).toFixed(2)+'%';
  }
  const date=/^(\d{4})-(\d{2})-(\d{2})(?:[T ](.+))?$/.exec(text);
  if(date&&format.startsWith('date-')){
    const [,y,m,d,time]=date;
    const day=format==='date-dmy'?d+'/'+m+'/'+y:format==='date-mdy'?m+'/'+d+'/'+y:y+'-'+m+'-'+d;
    return day+(time?' '+time:'');
  }
  if(format==='time12'||format==='time24'){
    const time=/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/.exec(date?.[4]??text);
    if(time){const [,h,m,s='']=time;const hour=Number(h);return (date?date[1]+'-'+date[2]+'-'+date[3]+' ':'')+(format==='time12'?(hour%12||12)+':'+m+s+(hour<12?' AM':' PM'):h+':'+m+s);}
  }
  return format==='upper'?text.toUpperCase():format==='lower'?text.toLowerCase():text;
}
