import {createXmlWorkspace,restoreXmlWorkspace,XML_LIMITATIONS} from '../modules/xml-documents/public/index.ts';
import type {XmlWorkspace,XmlFieldValue,XmlRecoveryPort,XmlRecoveryCheckpoint} from '../modules/xml-documents/public/index.ts';
import {browserXmlCodec,decodeXmlUtf8} from '../adapters/xml/browser-parser.ts';
import {showHwtTemplate95Dialog} from './hwt-template95-dialog.ts';
import {showHwtLeafDialog} from './hwt-leaf-dialog.ts';
import type {HwtLeafDialogOptions} from './hwt-leaf-dialog.ts';

/** Separate schema-bound document; never rewrites an open HWP or its recovery records. */
export function showXmlDocumentDialog(options:{recovery?:XmlRecoveryPort;inspectHwt?:(bytes:Uint8Array)=>unknown|Promise<unknown>;hwtLeaf?:HwtLeafDialogOptions}={}):HTMLDialogElement{
 const dialog=document.createElement('dialog');dialog.id='xml-document-workspace';dialog.style.cssText='width:min(900px,90vw);max-height:90vh;overflow:auto;color:inherit;background:var(--panel-bg,#fff)';
 const title=document.createElement('h2');title.textContent='XML 문서';
 const scope=document.createElement('p');scope.textContent=XML_LIMITATIONS.join(' ');
 const files=document.createElement('section'),xmlInput=document.createElement('input'),xsdInput=document.createElement('input');
 xmlInput.type=xsdInput.type='file';xmlInput.accept='.xml';xsdInput.accept='.xsd';xmlInput.dataset.xmlInput='xml';xsdInput.dataset.xmlInput='xsd';
 const label=(text:string,input:HTMLElement)=>{const l=document.createElement('label');l.append(text+' ',input);l.style.display='block';return l;};
 const status=document.createElement('p');status.setAttribute('role','status');status.dataset.xmlStatus='';
 const error=document.createElement('p');error.setAttribute('role','alert');error.dataset.xmlError='';
 const actions=document.createElement('section'),tree=document.createElement('section');tree.dataset.xmlTree='';
 let workspace:XmlWorkspace|undefined,selected:XmlFieldValue|undefined,xmlName='document.xml',xsdName='schema.xsd';
 let busy=Boolean(options.recovery),recoveryBlocked=false,token:string|null=null,pendingRecovery:XmlRecoveryCheckpoint|null=null,checkpointFailed=false;
 function displayError(e:unknown){error.textContent=e instanceof Error?e.message:String(e);}
 function button(text:string,action:string,run:()=>void|Promise<void>,preflight?:()=>unknown){const b=document.createElement('button');b.type='button';b.textContent=text;b.dataset.xmlAction=action;b.onclick=()=>{if(busy)return;error.textContent='';try{preflight?.();}catch(e){displayError(e);return;}busy=true;disabled();void Promise.resolve().then(run).catch(displayError).finally(()=>{busy=false;if(dialog.isConnected)disabled();});};return b;}
 async function checkpoint(){if(!workspace||!options.recovery)return;checkpointFailed=true;const saved=await options.recovery.write({xmlName,xsdName,state:workspace.captureRecovery()},token);token=saved.token;checkpointFailed=false;}
 async function change(run:()=>void){run();render();try{await checkpoint();if(options.recovery)status.textContent+=' · 로컬 복구본 저장 확인';}catch(e){checkpointFailed=true;throw Error('현재 XML 편집은 유지했지만 복구본 저장에 실패했습니다. 사본을 내보내세요. '+(e instanceof Error?e.message:String(e)));}}
 const undo=button('되돌리기','undo',()=>change(()=>{workspace?.undo();}));
 const redo=button('다시 실행','redo',()=>change(()=>{workspace?.redo();}));
 const xmlExport=button('XML 내보내기','export-xml',()=>download('xml')),schemaExport=button('XSD 사본 내보내기','export-xsd',()=>download('xsd'));
 const retryCheckpoint=button('복구본 다시 저장','checkpoint',async()=>{await checkpoint();status.textContent='현재 XML 작업의 로컬 복구본 저장을 확인했습니다. 파일 저장은 별도입니다.';});
 const inspectHwt=button('HWT 구조 읽기','inspect-hwt',()=>{if(!options.inspectHwt)throw Error('현재 엔진은 HWT 구조 읽기를 지원하지 않습니다.');showHwtTemplate95Dialog({inspect:options.inspectHwt});});
 const editHwt=button('HWT 일반 필드 편집','edit-hwt-leaf',()=>{if(!options.hwtLeaf)throw Error('현재 엔진은 HWT 일반 필드 편집을 지원하지 않습니다.');showHwtLeafDialog(options.hwtLeaf);});
 const recover=button('보관한 XML 작업 복원','restore-recovery',()=>{if(!pendingRecovery)return;const candidate=restoreXmlWorkspace(browserXmlCodec,pendingRecovery.state);workspace=candidate;xmlName=pendingRecovery.xmlName;xsdName=pendingRecovery.xsdName;token=pendingRecovery.token;pendingRecovery=null;checkpointFailed=false;render();status.textContent+=' · 원문·스키마·되돌리기 기록 복원';});
 const discardPending=button('보관한 복구본 폐기','discard-recovery',async()=>{if(!pendingRecovery||!options.recovery||!confirm('보관한 XML 복구본을 폐기하시겠습니까? 원본 파일은 삭제하지 않습니다.'))return;await options.recovery.discard(pendingRecovery.token);pendingRecovery=null;token=null;status.textContent='XML 복구본을 폐기했습니다. 원본 파일은 유지합니다.';});
 actions.append(recover,discardPending,undo,redo,xmlExport,schemaExport,retryCheckpoint,inspectHwt,editHwt);
 const field=document.createElement('fieldset'),legend=document.createElement('legend'),value=document.createElement('textarea');field.append(legend,value);value.rows=4;value.dataset.xmlValue='';
 const replace=button('필드 값 적용','replace',()=>change(()=>{if(!workspace||!selected)return;workspace.edit({kind:'replace',revision:workspace.snapshot().revision,path:selected.path,originalText:selected.value,text:value.value});}));
 const repeat=button('요소 반복','repeat',()=>editStructure('repeat')),remove=button('요소 삭제','remove',()=>editStructure('remove'));field.append(replace,repeat,remove);
 const notice=document.createElement('p');notice.textContent=options.recovery?'현재 업무·문서 창에 XML 원문·XSD·되돌리기 기록을 로컬 복구본으로 보관합니다. 복구본은 파일 저장이 아닙니다. 내보내기 후 실제 파일 저장 여부를 확인하세요. 기존 한글 문서는 바뀌지 않습니다.':'XML 작업은 이 창에서만 유지됩니다. 내보내기는 새 사본 다운로드 요청이며 디스크 저장 성공을 확인하지 않습니다. 기존 한글 문서는 바뀌지 않습니다.';
 function mayClose(){return!workspace?.snapshot().dirty&&!checkpointFailed||confirm(checkpointFailed?'XML 복구본 저장에 실패했습니다. 현재 변경 사본을 내보냈는지 확인하세요. 그래도 닫으시겠습니까?':options.recovery?'XML 변경과 기록은 로컬 복구본에 보관됩니다. 작업 창을 닫으시겠습니까?':'XML 작업에 변경 내용이 있습니다. 새 사본을 내보냈는지 확인하세요. 작업을 닫으시겠습니까?');}
 const close=button('닫기','close',()=>{if(mayClose())dialog.close();});
 const discardClose=button('작업 폐기하고 닫기','discard-close',async()=>{if(!confirm('현재 XML 작업과 복구본을 폐기하고 닫으시겠습니까? 원본 파일은 유지합니다.'))return;if(options.recovery&&token)await options.recovery.discard(token);dialog.close();});
 function selectedFiles(){const xml=xmlInput.files?.[0],xsd=xsdInput.files?.[0];if(!xml||!xsd)throw Error('XML과 XSD 파일을 각각 선택하세요.');if(xml.size>2_000_000||xsd.size>2_000_000)throw Error('XML과 XSD 파일은 각각 2MB 이하여야 합니다. 파일을 읽지 않았습니다.');return{xml,xsd};}
 const open=button('XML/XSD 불러오기','open',async()=>{
  const {xml,xsd}=selectedFiles();
  const [a,b]=await Promise.all([xml.arrayBuffer(),xsd.arrayBuffer()]);const candidate=createXmlWorkspace(browserXmlCodec,decodeXmlUtf8(new Uint8Array(a)),decodeXmlUtf8(new Uint8Array(b)));
  if(!dialog.isConnected)return;if(workspace?.snapshot().dirty&&!confirm('현재 XML 작업의 변경 내용을 버리고 선택한 새 문서를 여시겠습니까?'))return;
  workspace=candidate;xmlName=xml.name.replace(/[^.]+$/,'xml');xsdName=xsd.name.replace(/[^.]+$/,'xsd');render();await checkpoint();if(options.recovery)status.textContent+=' · 로컬 복구본 저장 확인';
 },selectedFiles);
 files.append(label('XML 문서 (UTF-8)',xmlInput),label('XSD 스키마 (지원 프로필)',xsdInput),open);
 async function editStructure(kind:'repeat'|'remove'){await change(()=>{if(!workspace||!selected)return;workspace.edit({kind,revision:workspace.snapshot().revision,path:selected.path});});}
 function download(kind:'xml'|'xsd'){if(!workspace)return;const artifact=workspace.exportArtifact(),text=kind==='xml'?artifact.xml:artifact.schema,name=kind==='xml'?xmlName:xsdName;const blob=new Blob([text],{type:'application/xml;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.download=name;a.href=url;dialog.append(a);try{a.click();status.textContent=`${name} 새 사본 내보내기를 요청했습니다. 실제 저장 여부를 확인하세요.`;}finally{a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}}
 function disabled(){const snap=workspace?.snapshot();open.disabled=busy||recoveryBlocked||Boolean(pendingRecovery);xmlInput.disabled=xsdInput.disabled=open.disabled;undo.disabled=busy||!snap?.canUndo;redo.disabled=busy||!snap?.canRedo;xmlExport.disabled=schemaExport.disabled=busy||!snap;retryCheckpoint.hidden=!options.recovery||!workspace;retryCheckpoint.disabled=busy||recoveryBlocked;recover.hidden=discardPending.hidden=!pendingRecovery;recover.disabled=discardPending.disabled=busy;editHwt.disabled=busy||!options.hwtLeaf;editHwt.title=options.hwtLeaf?'별도 HWT 작업·기록·복구본으로 엽니다.':'현재 엔진에는 HWT 일반 필드 편집 기능이 없습니다.';inspectHwt.disabled=busy||!options.inspectHwt;inspectHwt.title=options.inspectHwt?'별도 읽기 전용 창으로 엽니다.':'현재 엔진에는 HWT 구조 읽기 기능이 없습니다.';close.disabled=busy;discardClose.hidden=!options.recovery||!workspace;discardClose.disabled=busy||recoveryBlocked;value.disabled=busy||!selected?.simple;replace.disabled=busy||!selected?.simple;repeat.disabled=remove.disabled=busy||!selected?.path.length;for(const b of tree.querySelectorAll('button'))b.disabled=busy;}
 function render(){const snap=workspace?.snapshot();selected=undefined;tree.replaceChildren();field.hidden=true;if(snap){status.textContent=`XSD 지원 프로필 검사 통과 · ${snap.fields.length}개 요소 · ${snap.dirty?'수정됨':'원문'} · 버전 ${snap.revision}`;for(const f of snap.fields){const b=document.createElement('button');b.type='button';b.dataset.xmlPath=JSON.stringify(f.path);b.style.display='block';b.style.marginLeft=`${f.path.length*16}px`;b.textContent=`${f.name}${f.simple?' : '+f.value:''}`;b.onclick=()=>{if(busy)return;selected=f;legend.textContent=f.namespace?`{${f.namespace}}${f.name}`:f.name;value.value=f.value;field.hidden=false;disabled();};tree.append(b);}}disabled();}
 dialog.addEventListener('cancel',event=>{if(busy||!mayClose())event.preventDefault();});
 const beforeUnload=(event:BeforeUnloadEvent)=>{if(busy||workspace?.snapshot().dirty||checkpointFailed){event.preventDefault();event.returnValue='';}};
 window.addEventListener('beforeunload',beforeUnload);
 dialog.addEventListener('close',()=>{window.removeEventListener('beforeunload',beforeUnload);dialog.remove();},{once:true});
 dialog.append(title,scope,files,error,status,actions,tree,field,notice,discardClose,close);document.body.append(dialog);render();dialog.showModal();
 if(options.recovery){status.textContent='현재 업무의 XML 복구본을 확인하고 있습니다.';void options.recovery.read().then(record=>{if(!dialog.isConnected)return;pendingRecovery=record;if(record)status.textContent=`보관한 XML 작업: ${record.xmlName}. 복원하거나 명시적으로 폐기한 뒤 새 문서를 여세요.`;else status.textContent='보관한 XML 작업이 없습니다.';}).catch(e=>{recoveryBlocked=true;displayError(e);}).finally(()=>{busy=false;if(dialog.isConnected)disabled();});}
 return dialog;
}
