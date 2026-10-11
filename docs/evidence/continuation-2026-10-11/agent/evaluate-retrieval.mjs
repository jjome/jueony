import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {dirname,resolve,join} from 'node:path';
const directory=dirname(fileURLToPath(import.meta.url)),root=resolve(directory,'../../../..');
const {indexSelectedSources,searchSelectedSources}=await import(pathToFileURL(join(root,'apps/editor/src/retrieval/selected-sources.ts')));
const scope={workspaceId:'synthetic-public-office',chatId:'retrieval-evaluation'};
const padding='검토 기록: 담당자는 관련 부서와 회의하여 진행 상황을 기록하고 첨부 목록을 확인한다.\n'.repeat(140);
const facts=[
 {id:'edu2025',name:'2025년 주민교육 결과.txt',text:'2025년 주민교육 실적: 참여 인원은 128명이며 총 5회 운영하였다. 만족도 조사 회수는 104건이다.'},
 {id:'edu2026',name:'2026년 주민교육 계획.txt',text:'2026년 주민교육 목표: 참여 인원은 320명이고 교육은 8회 운영한다. 접수 기간은 3월 4일부터 3월 18일까지다.'},
 {id:'safety',name:'시설안전 점검 일정.txt',text:'북부복지관 안전 점검은 6월 15일 시행하며 시설관리팀이 담당한다. 남부체육관 점검은 6월 22일이다.'},
 {id:'budget',name:'교육사업 예산 내역.txt',text:'교육사업 총예산은 3,800만원이다. 강사비는 1,200만원이고 기자재 구입비는 800만원이다.'},
 {id:'letter',name:'공문 작성 기준.txt',text:'대외 발송 공문의 수신란은 기관장의 직위를 표시한다. 붙임의 문서 수량은 각 1부로 기재한다.'},
 {id:'complaint',name:'민원 처리 안내.txt',text:'생활불편 신고 처리 기간은 7일이다. 처리 결과는 신청인이 선택한 전자우편 또는 문자로 안내한다.'},
];
const sources=facts.map(item=>{const text=padding+item.text+'\n'+padding;return {...item,text,characters:text.length,sha256:createHash('sha256').update(text).digest('hex')};});
const cases=[
 ['Q01','2025년 주민교육 참여 인원','edu2025','128명'],['Q02','2025년 주민교육 만족도 조사 회수','edu2025','104건'],
 ['Q03','2026년 주민교육 운영 횟수','edu2026','8회'],['Q04','2026년 주민교육 접수 기간','edu2026','3월 18일'],
 ['Q05','북부복지관 점검 일정','safety','6월 15일'],['Q06','남부체육관 점검 날짜','safety','6월 22일'],
 ['Q07','교육사업 강사비 금액','budget','1,200만원'],['Q08','교육사업 기자재 구입비','budget','800만원'],
 ['Q09','대외 공문 수신란 작성 기준','letter','기관장의 직위'],['Q10','공문 붙임 문서 수량 표기','letter','각 1부'],
 ['Q11','생활불편 신고 처리 기간','complaint','7일'],['Q12','생활불편 민원 처리 결과 통지 수단','complaint','전자우편'],
];
const index=await indexSelectedSources(scope,sources),reports=[];
for(const [id,query,expectedSourceId,expectedText] of cases){
 const result=searchSelectedSources(index,scope,query),hit=result.references.find(item=>item.originSourceId===expectedSourceId&&item.text.includes(expectedText));
 reports.push({id,query,expectedSourceId,expectedText,pass:Boolean(hit),topSourceId:result.references[0]?.originSourceId,sentCharacters:result.retrieval.sentCharacters,selectedChunks:result.references.length,totalSourceCharacters:result.retrieval.totalSourceCharacters,sourceIds:result.references.map(item=>item.originSourceId)});
}
const noMatch=searchSelectedSources(index,scope,'quasarxylophone'),report={scope:'Synthetic lexical retrieval evidence only. Not actual government documents, a production-quality benchmark, model output quality or independent Hancom compatibility.',sourceCount:sources.length,indexedChunks:index.chunks.length,sourceCharacters:index.sourceCharacters,cases:reports,passed:reports.filter(item=>item.pass).length,total:reports.length,noMatchReferences:noMatch.references.length,meanSentCharacters:Math.round(reports.reduce((sum,item)=>sum+item.sentCharacters,0)/reports.length)};
await writeFile(join(directory,'retrieval-evaluation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,total:report.total,sourceCharacters:report.sourceCharacters,meanSentCharacters:report.meanSentCharacters,noMatchReferences:report.noMatchReferences}));
if(report.passed!==report.total||report.noMatchReferences!==0)process.exitCode=1;