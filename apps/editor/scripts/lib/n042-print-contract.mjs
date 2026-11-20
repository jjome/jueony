import {differences} from './hancom-review.mjs';

const ENV_KEYS=['fontFamily','fontFingerprint','dpi','paperWidthHwpUnit','paperHeightHwpUnit','landscape'];
const MANIFEST_KEYS=['schemaVersion','caseId','formats','environment','tolerance'];
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const exact=(value,keys)=>Object.keys(value).sort().join(',')===[...keys].sort().join(',');
const text=(value,max)=>typeof value==='string'&&value.length>0&&value.length<=max&&!/[\u0000-\u001f]/u.test(value);
const positive=value=>Number.isSafeInteger(value)&&value>0;

export function validateN042PrintManifest(value){
 if(!record(value)||!exact(value,MANIFEST_KEYS)||value.schemaVersion!==1||!text(value.caseId,80)
    ||!Array.isArray(value.formats)||value.formats.length!==2||value.formats[0]!=='hwp'||value.formats[1]!=='hwpx'
    ||typeof value.tolerance!=='number'||!Number.isFinite(value.tolerance)||value.tolerance<0||value.tolerance>1)throw Error('N042 print manifest contract mismatch');
 return{schemaVersion:1,caseId:value.caseId,formats:['hwp','hwpx'],environment:validateN042PrintEnvironment(value.environment),tolerance:value.tolerance};
}

export function validateN042PrintEnvironment(value){
 if(!record(value)||!exact(value,ENV_KEYS)||!text(value.fontFamily,120)
    ||!(value.fontFingerprint===null||/^[a-f0-9]{64}$/u.test(value.fontFingerprint))
    ||!positive(value.dpi)||value.dpi>1200||!positive(value.paperWidthHwpUnit)||!positive(value.paperHeightHwpUnit)
    ||typeof value.landscape!=='boolean')throw Error('N042 print environment contract mismatch');
 return structuredClone(value);
}

export function captureN042PrintLayout(snapshot,environment,producer){
 if(!record(snapshot)||!positive(snapshot.pages)||snapshot.pages>1000||!Array.isArray(snapshot.layout)||snapshot.layout.length!==snapshot.pages
    ||!['jueony-engine','hancom-2024'].includes(producer))throw Error('N042 published layout capture mismatch');
 const checkedEnvironment=validateN042PrintEnvironment(environment);
 const pageDefinition=snapshot.semantic?.values?.['section/0/page'];
 if(!record(pageDefinition)||pageDefinition.width!==checkedEnvironment.paperWidthHwpUnit||pageDefinition.height!==checkedEnvironment.paperHeightHwpUnit
    ||pageDefinition.landscape!==checkedEnvironment.landscape)throw Error('N042 paper definition does not match environment');
 for(let index=0;index<snapshot.layout.length;index++){
  const page=snapshot.layout[index];
  if(!record(page)||page.page!==index||!Object.hasOwn(page,'text')||!Object.hasOwn(page,'controls'))throw Error('N042 published layout page mismatch');
 }
 const json=JSON.stringify(snapshot.layout);
 if(json.length>64*1024*1024)throw Error('N042 published layout exceeds 64 MiB');
 return{schemaVersion:1,producer,environment:checkedEnvironment,pages:snapshot.pages,layout:structuredClone(snapshot.layout)};
}

export function compareN042PrintCaptures(left,right,{tolerance=0.2,mode='cross-producer'}={}){
 if(!record(left)||!record(right)||left.schemaVersion!==1||right.schemaVersion!==1||!['baseline','cross-producer'].includes(mode)
    ||typeof tolerance!=='number'||!Number.isFinite(tolerance)||tolerance<0||tolerance>1)throw Error('N042 comparison contract mismatch');
 const environment=differences(left.environment,right.environment,0,'$.environment');
 const defects=[];
 if(environment.length)defects.push({kind:'ENVIRONMENT_MISMATCH',count:environment.length,differences:environment});
 if(mode==='cross-producer'){
  if(left.producer===right.producer)defects.push({kind:'INDEPENDENT_PRODUCER_REQUIRED'});
  if(!left.environment?.fontFingerprint||!right.environment?.fontFingerprint)defects.push({kind:'FONT_BINARY_UNVERIFIED'});
 }
 if(left.pages!==right.pages)defects.push({kind:'PAGE_COUNT_MISMATCH',before:left.pages,after:right.pages});
 const geometry=differences(left.layout,right.layout,tolerance,'$.layout');
 const grouped={TEXT_REFLOW:[],OBJECT_GEOMETRY:[],PUBLISHED_LAYOUT_DIFFERENCE:[]};
 for(const entry of geometry){
  const kind=entry.path.includes('["text"]')?'TEXT_REFLOW':entry.path.includes('["controls"]')?'OBJECT_GEOMETRY':'PUBLISHED_LAYOUT_DIFFERENCE';
  grouped[kind].push(entry);
 }
 for(const [kind,entries] of Object.entries(grouped))if(entries.length)defects.push({kind,count:entries.length,differences:entries});
 const blocked=defects.some(item=>['ENVIRONMENT_MISMATCH','INDEPENDENT_PRODUCER_REQUIRED','FONT_BINARY_UNVERIFIED'].includes(item.kind));
 return{status:blocked?'BLOCKED':defects.length?'DIFFERENT':'MATCH_WITHIN_CONTRACT',mode,tolerance,pages:{before:left.pages,after:right.pages},defects,
  limitations:['Published engine layout is not a rendered PDF raster.','Cross-producer comparison requires an exact non-null font binary fingerprint.']};
}

export function classifyN042Failure(stage,error){
 const allowed=new Set(['manifest','build','export','reopen','capture','compare','input-integrity']);
 const normalized=allowed.has(stage)?stage:'unknown';
 const code={manifest:'MANIFEST_INVALID',build:'FIXTURE_BUILD_FAILED',export:'EXPORT_FAILED',reopen:'REOPEN_FAILED',capture:'LAYOUT_CAPTURE_FAILED',compare:'LAYOUT_COMPARISON_FAILED','input-integrity':'INPUT_MUTATED',unknown:'UNCLASSIFIED_FAILURE'}[normalized];
 return{stage:normalized,code,message:String(error instanceof Error?error.message:error).slice(0,2048)};
}
