import test from 'node:test';
import assert from 'node:assert/strict';
import {comparePreservationEvidence,type PreservationEvidence} from '../src/adapters/rhwp/preservation.ts';

const evidence:PreservationEvidence={values:{},issues:[],unverified:[]};
const loss=(subject:string,path:string)=>({code:'metadataReduced',subject,path,reason:'serializerNotImplemented'});
function report(format:'hwp'|'hwpx',losses:unknown[]){return comparePreservationEvidence(evidence,evidence,format,{schemaVersion:1,outputFormat:format,count:losses.length,losses});}

test('unrepresentable HWP direction remains blocked with a concrete HWPX alternative',()=>{
 const result=report('hwp',[loss('paragraphProperties','docInfo/paraShape/12/textDir')]);
 assert.equal(result.status,'blocked');assert.equal(result.issues[0].code,'content-loss');
 assert.match(result.issues[0].message,/HWPX/);assert.match(result.issues[0].message,/1건/);
 assert.equal(result.checked.includes('serializer-report'),false);
});
test('font type loss remains blocked without reflecting resource names or payloads',()=>{
 const value={...loss('fontProperties','docInfo/font/0/3/substFont/type'),resourceId:'PRIVATE-FONT-PAYLOAD',reason:'PRIVATE-REASON'};
 const result=report('hwpx',[value]);assert.equal(result.status,'blocked');
 assert.match(result.issues[0].message,/글꼴 유형/);assert.doesNotMatch(result.issues[0].message,/PRIVATE/);
});
test('unknown loss paths stay generic and valid empty loss reports stay checked',()=>{
 for(const value of [loss('paragraphProperties','PRIVATE/textDir'),{code:'controlOmitted',subject:'fontProperties',path:'docInfo/font/0/0/type'}]){
  const result=report('hwp',[value]);assert.equal(result.status,'blocked');assert.equal(result.issues[0].message,'직렬화기가 1건의 손실을 보고했습니다');
 }
 assert.equal(report('hwpx',[]).status,'checked');
});
