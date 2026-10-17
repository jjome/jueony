import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=resolve(process.env.JUEONY_REPOSITORY),out=resolve(process.env.JUEONY_TEST_OUTPUT);
const {loadReviewEngine,snapshot,compareSnapshots,hash}=await import(pathToFileURL(join(root,'apps/editor/scripts/lib/hancom-review.mjs')));
const old=await loadReviewEngine(join(root,'build/rhwp-engine/source-ad6186043c15532f/pkg'));
const current=await loadReviewEngine(join(root,'build/rhwp-engine/source-b6d44520624bd7e1/pkg'));
const inputs=[
 {name:'원공개 MCST→실제한글',source:'build/hancom-final-file-review-20261017/source-mcst-bid-2026.hwp',actual:'build/hancom-final-file-review-20261017/mcst-bid-2026-hwpx-hancom.hwpx'},
 {name:'Python3 직접→실제한글',source:'build/hancom-final-file-review-20261017/source-python-hwpx-3.hwpx',actual:'build/hancom-final-file-review-20261017/python-hwpx-3-hwp-hancom.hwp'}
];
function compact(comparison){const fields={};for(const d of comparison.geometry.differences){const key=d.path.replace(/\[\d+\]/g,'[]');fields[key]=(fields[key]??0)+1;}return{pages:comparison.pages,geometry:comparison.geometry.count,semantic:comparison.semantic.count,fields};}
const rows=[];
for(const item of inputs){
 const bytes=await Promise.all([item.source,item.actual].map(p=>readFile(join(root,p))));
 const docs=[new old.HwpDocument(bytes[0]),new old.HwpDocument(bytes[1]),new current.HwpDocument(bytes[0]),new current.HwpDocument(bytes[1])];
 try{
  const [a,b,c,d]=docs.map(snapshot),targetChanges=[];
  if(item.name.startsWith('Python3'))for(const [side,left,right]of [['source',a,c],['hancom',b,d]])for(let page=0;page<left.pages;page++){
   const l=left.layout[page].text.runs,r=right.layout[page].text.runs;
   for(let i=0;i<l.length;i++){const x=l[i],y=r[i];if(x.parentParaIdx!==100||!((x.cellIdx===0&&x.paraIdx===1)||(x.cellIdx===2&&x.paraIdx===0)))continue;
    const values=[];for(const key of ['x','y','w','h'])if(x[key]!==y?.[key])values.push({field:key,before:x[key],after:y?.[key]});
    const positions=(x.charX??[]).map((value,index)=>({index,before:value,after:y?.charX?.[index]})).filter(v=>v.before!==v.after);
    if(values.length||positions.length)targetChanges.push({side,page,cell:x.cellIdx,paragraph:x.paraIdx,charStart:x.charStart,textSHA256:hash(Buffer.from(x.text??'')),values,charXChanged:positions.length,maxCharXChange:Math.max(0,...positions.map(v=>Math.abs(v.after-v.before)))});
   }
  }
  rows.push({name:item.name,source:{path:item.source,sha256:hash(bytes[0])},actual:{path:item.actual,sha256:hash(bytes[1])},formal83Residual:compact(compareSnapshots(a,b)),formal84Residual:compact(compareSnapshots(c,d)),sourceOperandChanges:compact(compareSnapshots(a,c)),actualOperandChanges:compact(compareSnapshots(b,d)),targetChanges,inputsUnchanged:true});
  for(let i=0;i<2;i++)if(hash(await readFile(join(root,[item.source,item.actual][i])))!==hash(bytes[i]))throw Error('Original changed');
 }finally{docs.forEach(d=>d.free());}
}
await mkdir(out,{recursive:true});
await writeFile(join(out,'result.json'),JSON.stringify({engines:{formal83:old.metadata,formal84:current.metadata},rows,note:'읽기 전용 수치 진단. 같은 엔진에서 두 사본의 잔여 건수가 같아도 측정 operand 변화는 별개입니다. 원공개 MCST와 Python3 실제 차이는 미해결이며 본문·전체 snapshot·파생 bytes를 쓰지 않았습니다.'},null,2));
console.log(JSON.stringify(rows.map(r=>({name:r.name,before:r.formal83Residual.geometry,after:r.formal84Residual.geometry,pages:r.formal84Residual.pages,sourceOperandChanges:r.sourceOperandChanges.geometry,targetChangedRuns:r.targetChanges.length})),null,2));
