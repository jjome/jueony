// Public originals are kept locally under ignored .tools; do not redistribute them.
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../../../',import.meta.url)),directory=join(root,'.tools/public-documents');
await mkdir(directory,{recursive:true});
const sources=[
 {id:'mcst-bid-2026',file:'mcst-bid-2026.hwp',title:'2026년 공공누리 홍보마케팅 용역 입찰 공고',page:'https://www.mcst.go.kr/site/s_notice/notice/bidView.jsp?pSeq=18649',url:'https://www.mcst.go.kr/servlets/eduport/front/upload/UplDownloadFile?pFileName=notice.hwp&pPath=0312010000&pRealName=R26BK01353224_18649_0.hwp'},
 {id:'acrc-recruit-2026',file:'acrc-recruit-2026.hwpx',title:'국민권익위원회 제2026-6호 일반임기제 채용 공고와 서식',page:'https://www.acrc.go.kr/boardDownload.es?bid=2B&list_no=103353&seq=2',url:'https://www.acrc.go.kr/boardDownload.es?bid=2B&list_no=103353&seq=2'},
 {id:'moj-recruit-2023',file:'moj-recruit-2023.hwpx',title:'법무부 2023년도 일반직공무원 운전서기보 채용 공고와 서식',page:'https://www.moj.go.kr/bbs/moj/186/453045/download.do',url:'https://www.moj.go.kr/bbs/moj/186/453045/download.do'},
 ...['examples/FormattingShowcase.hwpx','examples/note_example.hwpx','tests/fixtures/equation_preview/equation_p0.hwpx','tests/fixtures/exam/A_form.hwpx'].map((path,i)=>({id:'python-hwpx-'+i,file:['formatting.hwpx','notes.hwpx','equation.hwpx','form.hwpx'][i],title:'python-hwpx 공개 fixture: '+path,page:'https://github.com/airmang/python-hwpx/blob/839562b87f54923c1a0317c22b1f2d4863f3c658/'+path,url:'https://raw.githubusercontent.com/airmang/python-hwpx/839562b87f54923c1a0317c22b1f2d4863f3c658/'+path})),
];
const reports=[];
for(const source of sources) {
 try{
  const response=await fetch(source.url,{signal:AbortSignal.timeout(45000)});if(!response.ok)throw new Error('HTTP '+response.status);
  const reader=response.body.getReader(),parts=[];let size=0;
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>16*1024*1024){await reader.cancel();throw new Error('Size limit');}parts.push(value);}
  const bytes=Buffer.concat(parts),magic=bytes.subarray(0,8).toString('hex');
  const format=magic.startsWith('d0cf11e0a1b11ae1')?'hwp':magic.startsWith('504b0304')?'hwpx':magic.startsWith('25504446')?'pdf':'unknown';
  if(format!==source.file.split('.').at(-1))throw new Error('Unexpected actual format: '+format);
  await writeFile(join(directory,source.file),bytes);
  reports.push({...source,status:'downloaded',format,size,sha256:createHash('sha256').update(bytes).digest('hex'),downloadedAt:new Date().toISOString(),localFile:'.tools/public-documents/'+source.file,redistribution:'Not included in Git or distribution. Publicly accessible; no blanket relicensing assumed.'});
  console.log(source.id+' '+format+' '+size+' bytes');
 }catch(error){reports.push({...source,status:'failed',error:error.message});console.log(source.id+' failed: '+error.message);}
}
await writeFile(join(directory,'manifest.json'),JSON.stringify(reports,null,2));
