import { parseCSVText } from '@/lib/importCSV';
import { rowsToCSV } from '@/lib/spreadsheet';
import type { Campus, Fixture } from '@/store/fixtureStore';
import { normalizeFloorKey } from '@/lib/floorUtils';

export interface LeadReportRowDraft {
  rowNumber:number; raw:Record<string,string>; schoolDistrict:string; school:string; building:string; floor:string; room:string;
  fixtureDescription:string; fixtureType:string; sampleId:string; sampleDate:string; resultValue:string; resultUnit:string;
}
export interface LeadFixtureMatch { fixtureId?:string; status:'high_confidence_match'|'possible_match'|'multiple_matches'|'no_match'; confidence:number; reasons:string[]; alternatives:string[] }
export interface PdfTextItem { x:number; text:string }
export interface PdfTextLine { y:number; items:PdfTextItem[] }

const aliases={
  schoolDistrict:['school district','district','district name'],school:['school','school name','site','facility'],building:['building','building name','wing'],floor:['floor','level'],
  room:['room','room number','rm','location'],fixtureDescription:['fixture description','outlet description','description','fixture'],
  fixtureType:['fixture type','outlet type','type'],sampleId:['sample id','sample number','sample #'],
  sampleDate:['sample date','date sampled','collection date'],resultValue:['lead result','lead concentration','result value','result'],
  resultUnit:['result unit','units','unit'],
} as const;
const cleanHeader=(value:string)=>value.toLowerCase().trim().replace(/[_-]+/g,' ').replace(/\s+/g,' ');
const indexFor=(headers:string[],field:keyof typeof aliases)=>{
  const normalized=headers.map(cleanHeader);
  const exact=normalized.findIndex(header=>aliases[field].some(alias=>header===alias));
  if(exact>=0)return exact;
  return normalized.findIndex(header=>(field!=='school'||!header.includes('district'))&&aliases[field].some(alias=>header.includes(alias)));
};

export function parseLeadReportCSV(csv:string):LeadReportRowDraft[]{
  const {headers,rows}=parseCSVText(csv); if(!headers.length)throw new Error('The report has no header row.');
  const indices=Object.fromEntries((Object.keys(aliases) as (keyof typeof aliases)[]).map(field=>[field,indexFor(headers,field)])) as Record<keyof typeof aliases,number>;
  if(indices.resultValue<0)throw new Error('Could not find a Lead Result column.');
  const get=(row:string[],field:keyof typeof aliases)=>indices[field]<0?'':(row[indices[field]]??'').trim();
  return rows.map((row,index)=>({rowNumber:index+2,raw:Object.fromEntries(headers.map((header,column)=>[header,row[column]??''])),schoolDistrict:get(row,'schoolDistrict'),school:get(row,'school'),building:get(row,'building'),floor:normalizeFloorKey(get(row,'floor')),room:get(row,'room'),fixtureDescription:get(row,'fixtureDescription'),fixtureType:get(row,'fixtureType'),sampleId:get(row,'sampleId'),sampleDate:normalizeDate(get(row,'sampleDate')),resultValue:get(row,'resultValue'),resultUnit:get(row,'resultUnit')||inferUnit(headers[indices.resultValue]??'')})).filter(row=>row.resultValue||row.sampleId||row.room);
}

export async function extractPdfReport(file:File):Promise<LeadReportRowDraft[]>{
  const[pdfjs,worker]=await Promise.all([import('pdfjs-dist/legacy/build/pdf.mjs'),import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')]);
  pdfjs.GlobalWorkerOptions.workerSrc=worker.default;
  const document=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
  const table:string[][]=[];
  const positionedPages:PdfTextLine[][]=[];
  for(let pageNumber=1;pageNumber<=document.numPages;pageNumber++){
    const page=await document.getPage(pageNumber); const content=await page.getTextContent();
    const lines=new Map<number,Array<{x:number;text:string}>>();
    for(const raw of content.items){if(!('str' in raw)||!raw.str.trim())continue;const y=Math.round(raw.transform[5]);const line=lines.get(y)??[];line.push({x:raw.transform[4],text:raw.str.trim()});lines.set(y,line)}
    const positioned=[...lines.entries()].sort((a,b)=>b[0]-a[0]).map(([y,items])=>({y,items:items.sort((a,b)=>a.x-b.x)}));positionedPages.push(positioned);
    for(const line of positioned)table.push(line.items.map(item=>item.text));
  }
  if(!table.length)throw new Error('This PDF contains no selectable text. Upload a text-based PDF, CSV, or Excel report.');
  const allText=table.flat().join(' ');
  if(/Lead in School Drinking Water Report/i.test(allText))return parseWashingtonDohReport(positionedPages,file.name);
  const headerIndex=table.findIndex(row=>row.some(cell=>/result|concentration/i.test(cell))&&row.some(cell=>/school|building|room|location/i.test(cell)));
  if(headerIndex<0)throw new Error('Could not identify a result table in this PDF. CSV or Excel is recommended for this layout.');
  return parseLeadReportCSV(rowsToCSV(table.slice(headerIndex)));
}

export function parseWashingtonDohReport(pages:PdfTextLine[][],fileName=''):LeadReportRowDraft[]{
  const firstPage=pages[0]??[];const school=cleanParts(firstPage.find(line=>{const text=cleanParts(line.items.map(item=>item.text));return /School$/i.test(text)&&!/District/i.test(text)})?.items.map(item=>item.text)??[]);
  const firstPageText=cleanParts(firstPage.flatMap(line=>line.items.map(item=>item.text)));const collected=firstPageText.match(/Date\(s\) collected:\s*(\d{4})\s*-\s*(\d{2})\s*-\s*(\d{2})/i);const sampleDate=collected?`${collected[1]}-${collected[2]}-${collected[3]}`:'';
  const districtMatch=fileName.replace(/\.[^.]+$/,'').match(/^(.+?)_school_district_/i);const schoolDistrict=districtMatch?`${titleCase(districtMatch[1].replaceAll('_',' '))} School District`:'';
  type DohRow={sample:string;building:string[];housing:string[];location:string[];details:string[];type:string[];position:string[];result:string};
  const parsed:DohRow[]=[];let current:DohRow|undefined;let stopped=false;
  const append=(row:DohRow,item:PdfTextItem)=>{const text=item.text.trim();if(!text)return;if(item.x>=500)row.result=text;else if(item.x>=450)row.position.push(text);else if(item.x>=390)row.type.push(text);else if(item.x>=310)row.details.push(text);else if(item.x>=250)row.location.push(text);else if(item.x>=170)row.housing.push(text);else if(item.x>=115)row.building.push(text)};
  for(let pageIndex=0;pageIndex<pages.length&&!stopped;pageIndex++)for(const line of pages[pageIndex]){
    const lineText=cleanParts(line.items.map(item=>item.text));if(/EXPLANATION OF TESTING AND RESULTS/i.test(lineText)){stopped=true;break}
    if(pageIndex>0&&line.y>650)continue;
    const sampleItem=line.items.find(item=>item.x<115&&/^\d{4,}$/.test(item.text));const resultItem=line.items.find(item=>item.x>=500&&/^<?\d+(?:\.\d+)?$/.test(item.text));
    if(sampleItem&&resultItem){if(current)parsed.push(current);current={sample:sampleItem.text,building:[],housing:[],location:[],details:[],type:[],position:[],result:resultItem.text};for(const item of line.items)append(current,item);continue}
    if(current)for(const item of line.items)append(current,item);
  }
  if(current)parsed.push(current);
  return parsed.map((row,index)=>{const building=cleanParts(row.building);const housing=cleanParts(row.housing);const location=cleanParts(row.location);const details=cleanParts(row.details);const fixtureType=normalizeDohFixtureType(cleanParts(row.type));const position=cleanParts(row.position);const roomMatch=location.match(/\bRm\s*([A-Za-z0-9-]+)/i);const floorMatch=location.match(/\b(\d+)(?:st|nd|rd|th)\s+Floor\b/i);const description=[housing,details,position].filter(Boolean).join(' · ');const raw={'Sample ID':row.sample,'Building Name':building,'Fixture Housing Type':housing,'Fixture Location':location,'Fixture Location Details':details,'Fixture Type':fixtureType,'Fixture Position':position,'Lead Test Result (ppb)':row.result};return{rowNumber:index+2,raw,schoolDistrict,school,building,floor:floorMatch?.[1]??'',room:roomMatch?.[1]??location,fixtureDescription:description,fixtureType,sampleId:row.sample,sampleDate,resultValue:row.result,resultUnit:'ppb'}}).filter(row=>row.sampleId&&row.resultValue);
}

function inferUnit(header:string){const value=header.toLowerCase();if(value.includes('mg/l'))return'mg/L';if(value.includes('ppm'))return'ppm';if(value.includes('µg/l')||value.includes('ug/l'))return'µg/L';return'ppb'}
function normalizeDate(value:string){if(!value)return'';const date=new Date(value);return Number.isNaN(date.getTime())?value:date.toISOString().slice(0,10)}
function cleanParts(parts:string[]){return parts.join(' ').replace(/\s+-\s+/g,'-').replace(/\s+/g,' ').trim()}
function titleCase(value:string){return value.replace(/\b\w/g,letter=>letter.toUpperCase())}
function normalizeDohFixtureType(value:string){const normalized=value.toLowerCase();if(normalized.includes('bottle'))return'Bottle Filler';if(normalized.includes('fountain'))return'Drinking Fountain';if(normalized.includes('tap'))return'Faucet';return value}
export function normalizeLocation(value:string){
  return value.replace(/([a-z])([A-Z])/g,'$1 $2').toLowerCase().trim().replace(/[.,#]/g,' ').replace(/\b(rm|room)\b/g,'room').replace(/\bbubbler\b/g,'drinking fountain').replace(/\btap\b/g,'faucet').replace(/\bbottle\s*fill(?:er)?\b/g,'bottle filler').replace(/\bwater\s*fountain\b/g,'drinking fountain').replace(/\s+/g,' ');
}
export function matchLeadReportRow(row:LeadReportRowDraft,fixtures:Fixture[],campuses:Campus[]):LeadFixtureMatch{
  const scored=fixtures.map(fixture=>{const campus=campuses.find(item=>item.id===fixture.campusId);let score=0;const reasons:string[]=[];
    const compare=(reported:string,actual:string|undefined,weight:number,reason:string)=>{if(reported&&actual&&normalizeLocation(reported)===normalizeLocation(actual)){score+=weight;reasons.push(reason)}};
    compare(row.schoolDistrict,campus?.schoolDistrict,.15,'School district matches');compare(row.school,campus?.school||campus?.name,.2,'School matches');compare(row.building,fixture.buildingName,.2,'Building matches');if(row.floor&&fixture.floor&&normalizeFloorKey(row.floor)===normalizeFloorKey(fixture.floor)){score+=.15;reasons.push('Floor matches')}compare(row.room,fixture.nearestRoom||fixture.roomNumber,.2,'Room matches');
    const identity=[fixture.category,fixture.brand,fixture.model].filter(Boolean).join(' ');compare(row.fixtureType,fixture.category,.1,'Fixture type matches');
    if(row.fixtureDescription&&normalizeLocation(identity).includes(normalizeLocation(row.fixtureDescription))){score+=.1;reasons.push('Fixture description matches')}
    return{fixtureId:fixture.id,score:Math.min(score,1),reasons};
  }).filter(item=>item.score>=.45).sort((a,b)=>b.score-a.score);
  if(!scored.length)return{status:'no_match',confidence:0,reasons:['No existing fixture met the location-match threshold'],alternatives:[]};
  const tied=scored.filter(item=>Math.abs(item.score-scored[0].score)<.05);
  if(tied.length>1)return{status:'multiple_matches',confidence:scored[0].score,reasons:scored[0].reasons,alternatives:tied.map(item=>item.fixtureId)};
  return{fixtureId:scored[0].fixtureId,status:scored[0].score>=.8?'high_confidence_match':'possible_match',confidence:scored[0].score,reasons:scored[0].reasons,alternatives:scored.slice(1,4).map(item=>item.fixtureId)};
}
