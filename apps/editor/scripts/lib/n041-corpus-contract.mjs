const EXACT_KEYS=['schemaVersion','corpusId','generatedSynthetic','cases'];
const CASE_KEYS=['id','label','builder','formats','requiredEvidence','expected'];
const EXPECTED_KEYS=['minimumPages','minimumTables','minimumPictures','minimumFields','fontFamily'];
const BUILDERS=new Set(['body-font','page-boundary','table','picture','field']);
const FORMATS=['hwp','hwpx'];
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const exact=(value,keys)=>Object.keys(value).sort().join(',')===[...keys].sort().join(',');
const integer=value=>Number.isSafeInteger(value)&&value>=0;
const text=(value,max)=>typeof value==='string'&&value.length>0&&value.length<=max&&!/[\u0000-\u001f]/u.test(value);

export function validateN041CorpusManifest(value){
 if(!record(value)||!exact(value,EXACT_KEYS)||value.schemaVersion!==1||!text(value.corpusId,80)
    ||value.generatedSynthetic!==true||!Array.isArray(value.cases)||value.cases.length<5||value.cases.length>32)throw Error('N041 corpus manifest contract mismatch');
 const ids=new Set(),builders=new Set();
 const cases=value.cases.map(entry=>{
  if(!record(entry)||!exact(entry,CASE_KEYS)||!/^C\d{2}$/u.test(entry.id)||ids.has(entry.id)||!text(entry.label,120)
     ||!BUILDERS.has(entry.builder)||!Array.isArray(entry.formats)||entry.formats.length!==2
     ||entry.formats.some((format,index)=>format!==FORMATS[index])||!Array.isArray(entry.requiredEvidence)
     ||entry.requiredEvidence.length<1||entry.requiredEvidence.length>32||new Set(entry.requiredEvidence).size!==entry.requiredEvidence.length
     ||entry.requiredEvidence.some(path=>!text(path,160)||path.includes('..')||path.startsWith('/'))
     ||!record(entry.expected)||!exact(entry.expected,EXPECTED_KEYS)
     ||!integer(entry.expected.minimumPages)||entry.expected.minimumPages<1||entry.expected.minimumPages>1000
     ||!integer(entry.expected.minimumTables)||!integer(entry.expected.minimumPictures)||!integer(entry.expected.minimumFields)
     ||!text(entry.expected.fontFamily,120))throw Error('N041 corpus case contract mismatch');
  ids.add(entry.id);builders.add(entry.builder);return structuredClone(entry);
 });
 if(builders.size!==BUILDERS.size||[...BUILDERS].some(builder=>!builders.has(builder)))throw Error('N041 corpus builder coverage mismatch');
 return{schemaVersion:1,corpusId:value.corpusId,generatedSynthetic:true,cases};
}

export function classifyN041Failure(stage,error){
 const allowed=new Set(['manifest','build','initial-export','initial-reopen','source-probe','save','reopen','preservation','layout','feature-contract','input-integrity']);
 const normalized=allowed.has(stage)?stage:'unknown';
 const code={manifest:'MANIFEST_INVALID',build:'FIXTURE_BUILD_FAILED','initial-export':'FIXTURE_EXPORT_FAILED','initial-reopen':'FIXTURE_REOPEN_FAILED','source-probe':'SOURCE_FEATURE_UNREADABLE',save:'SAVE_FAILED',reopen:'REOPEN_FAILED',preservation:'SEMANTIC_PRESERVATION_FAILED',layout:'LAYOUT_CHANGED','feature-contract':'FEATURE_CONTRACT_FAILED','input-integrity':'INPUT_MUTATED',unknown:'UNCLASSIFIED_FAILURE'}[normalized];
 return{stage:normalized,code,message:String(error instanceof Error?error.message:error).slice(0,2048)};
}
