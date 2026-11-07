import {translateStoredTableFormula, type FormulaFillOutput} from '../../modules/document/public/table-auto-fill.ts';
import type {AgentTableFormulaFields} from '../../modules/document/public/types.ts';
import {verifyPreservedExport} from './preservation.ts';

type Field=AgentTableFormulaFields['fields'][number];
type Address=[number,number,number];
export type FillCell={index:number;row:number;column:number;text:string;charShape:number;paraShape:number;style:number;field?:Field};
type FieldChange={cellIndex:number;fieldId:number;previousCommand:string;previousValue:string;command:string;value:string};
type Step={index:number;original:string;originalField?:string;expression:string;format:string;command:string;value:string;fieldId:number;dependents:FieldChange[]};
export type StoredFill={steps:Step[];finalFields:Array<[number,string,string]>;changed:boolean};
const json=JSON.parse;
const eq=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const textAt=(d:any,at:Address,i:number)=>d.getTextInCell(...at,i,0,0,d.getCellParagraphLength(...at,i,0));
function stored(d:any):Array<[number,string,string]>{
  const fields=json(d.getFieldList()).filter((f:any)=>f.fieldType==='formula');
  if(fields.length>200 || fields.some((f:any)=>typeof f.command!=='string'||typeof f.value!=='string'||f.command.length>8192||f.value.length>4000)
    || fields.reduce((size:number,f:any)=>size+f.command.length+f.value.length,0)>80000)throw Error('저장된 계산식 목록이 안전하게 대조할 수 있는 범위를 넘습니다.');
  return fields.map((f:any)=>[f.fieldId,f.command,f.value]);
}
function writePlain(d:any,at:Address,cell:FillCell,value:string){
  const args=[...at,cell.index,0],size=d.getCellParagraphLength(...args);
  if(textAt(d,at,cell.index)===value)return;
  if(size && !json(d.deleteTextInCell(...args,0,size)).ok)throw Error('기존 셀 값을 지우지 못했습니다.');
  if(!json(d.insertTextInCell(...args,0,value)).ok || !json(d.setCharShapeIdInCell(...args,0,Array.from(value).length,cell.charShape)).ok)
    throw Error('계산값 또는 원래 글자 서식을 적용하지 못했습니다.');
}
function applyStep(d:any,at:Address,cell:FillCell,expression:string,format:string,output:FormulaFillOutput):Step {
  const original=textAt(d,at,cell.index),args=[...at,cell.index],existing=cell.field;
  const oldCommand=existing?stored(d).find(([id])=>id===existing.fieldId)?.[1]:undefined;
  if(existing && (!oldCommand || output==='value'))throw Error('기존 계산식 필드는 수식 복사만 지원합니다. 고정값은 일반 셀에 채우세요.');
  // For a fixed value, the temporary field uses the same native parser,
  // dependency graph and result format as a real field. Roll it back first.
  const trial=output==='value'?d.saveSnapshot():undefined;
  let result;
  try {
    result=json(existing?d.updateTableFormulaField(...args,existing.fieldId,oldCommand,expression,format):
      d.insertTableFormulaField(...args,original,expression,format));
    if(result.ok!==true || !Number.isSafeInteger(result.fieldId) || result.formula!==expression || typeof result.value!=='string' ||
      result.command!==expression+'??'+format+';;'+result.value || !Number.isFinite(result.result) || !Array.isArray(result.dependentChanges))
      throw Error('계산식 필드 또는 계산 결과를 확인하지 못했습니다.');
    if(output==='value' && result.dependentChanges.length)throw Error('고정값 대상을 참조하는 기존 계산식의 결과가 달라집니다.');
  } finally {
    if(trial!==undefined){try{if(!json(d.restoreSnapshot(trial)).ok)throw Error('임시 계산을 되돌리지 못했습니다.');}finally{d.discardSnapshot(trial);}}
  }
  if(output==='value')writePlain(d,at,cell,result.value);
  const para=json(d.getCellParaPropertiesAt(...args,0)),character=json(d.getCellCharPropertiesAt(...args,0,0)),style=json(d.getCellStyleAt(...args,0));
  if(textAt(d,at,cell.index)!==result.value || para.paraShapeId!==cell.paraShape || style.id!==cell.style || character.charShapeId!==cell.charShape)
    throw Error('채운 셀의 결과 또는 기존 서식이 달라졌습니다.');
  return {index:cell.index,original,originalField:oldCommand,expression,format,fieldId:result.fieldId,command:result.command,value:result.value,dependents:result.dependentChanges};
}

export function planStoredFormulaFill(doc:any,at:Address,cells:FillCell[],rows:number,columns:number,output:FormulaFillOutput):StoredFill {
  const seed=cells[0].field;
  if(!seed?.editable || !seed.expression || !seed.resultFormat || typeof doc.insertTableFormulaField!=='function' || cells.length<2)
    throw Error('현재 엔진에서 이 계산식 필드를 복사할 수 없습니다.');
  const source=doc.getSourceFormat(),format=source==='hwpx'?'hwpx':source==='hwp'?'hwp':null;
  if(!format)throw Error('HWP 또는 HWPX 표 계산식만 복사할 수 있습니다.');
  const artifact=doc[format==='hwpx'?'exportHwpxWithReport':'exportHwpWithReport']();
  let scratch:any;
  try{
    const bytes=artifact.takeBytes(),open=(data:Uint8Array)=>new doc.constructor(data);
    verifyPreservedExport(doc,bytes,format,artifact.contentLoss(),open);
    scratch=open(bytes);
    const steps=cells.slice(1).map(cell=>{
      const expression=translateStoredTableFormula(seed.expression!,cell.row-seed.row,cell.column-seed.column,{rows,columns});
      return applyStep(scratch,at,cell,expression,seed.resultFormat!,output);
    });
    const finalFields=stored(scratch);
    return {steps,finalFields,changed:!eq(stored(doc),finalFields)||cells.some(cell=>textAt(scratch,at,cell.index)!==cell.text)};
  } finally {scratch?.free();artifact.free();}
}

export function executeStoredFormulaFill(doc:any,at:Address,cells:FillCell[],plan:StoredFill,output:FormulaFillOutput):void{
  const original=doc.saveSnapshot();
  try{
    for(const [i,expected] of plan.steps.entries()){
      const actual=applyStep(doc,at,cells[i+1],expected.expression,expected.format,output);
      if(!eq(actual,expected))throw Error('채운 계산식의 참조·결과·연관 계산식이 미리보기와 다릅니다.');
    }
    if(!eq(stored(doc),plan.finalFields))throw Error('자동 채우기 후 저장된 계산식 목록이 다릅니다.');
  }catch(error){
    if(!json(doc.restoreSnapshot(original)).ok)throw Error('표 계산식 자동 채우기 전 상태를 복원하지 못했습니다.');
    throw error;
  }finally{doc.discardSnapshot(original);}
}
