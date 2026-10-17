import {createXmlWorkspace,XML_LIMITATIONS} from '../modules/xml-documents/public/index.ts';
import type {XmlWorkspace,XmlFieldValue} from '../modules/xml-documents/public/index.ts';
import {browserXmlCodec,decodeXmlUtf8} from '../adapters/xml/browser-parser.ts';
/** Separate local XML workspace; never calls the HWP editor, recovery or disk adapters. */
export function showXmlDocumentDialog():HTMLDialogElement{
 const dialog=document.createElement('dialog');dialog.id='xml-document-workspace';dialog.style.cssText='width:min(900px,90vw);max-height:90vh;overflow:auto;color:inherit;background:var(--panel-bg,#fff)';
 const title=document.createElement('h2');title.textContent='XML 문서';
 const scope=document.createElement('p');scope.textContent=XML_LIMITATIONS.join(' ');
 const files=document.createElement('section'),xmlInput=document.createElement('input'),xsdInput=document.createElement('input');
 xmlInput.type=xsdInput.type='file';xmlInput.accept='.xml';xsdInput.accept='.xsd';xmlInput.dataset.xmlInput='xml';xsdInput.dataset.xmlInput='xsd';
 const label=(text:string,input:HTMLElement)=>{const l=document.createElement('label');l.append(text+' ',input);l.style.display='block';return l;};
 const open=document.createElement('button');open.type='button';open.textContent='XML/XSD 불러오기';open.dataset.xmlAction='open';files.append(label('XML 문서 (UTF-8)',xmlInput),label('XSD 스키마 (지원 프로필)',xsdInput),open);
 const status=document.createElement('p');status.setAttribute('role','status');status.dataset.xmlStatus='';
 const error=document.createElement('p');error.setAttribute('role','alert');error.dataset.xmlError='';
 const actions=document.createElement('section'),tree=document.createElement('section');tree.dataset.xmlTree='';
 let workspace:XmlWorkspace|undefined,selected:XmlFieldValue|undefined,xmlName='document.xml',xsdName='schema.xsd',loading=false;
 const undo=button('되돌리기','undo',()=>{workspace?.undo();render();}),redo=button('다시 실행','redo',()=>{workspace?.redo();render();});
 const xmlExport=button('XML 내보내기','export-xml',()=>download('xml')),schemaExport=button('XSD 사본 내보내기','export-xsd',()=>download('xsd'));
 actions.append(undo,redo,xmlExport,schemaExport);
 const field=document.createElement('fieldset'),legend=document.createElement('legend'),value=document.createElement('textarea');field.append(legend,value);value.rows=4;value.dataset.xmlValue='';
 const replace=button('필드 값 적용','replace',()=>{if(!workspace||!selected)return;workspace.edit({kind:'replace',revision:workspace.snapshot().revision,path:selected.path,originalText:selected.value,text:value.value});render();});
 const repeat=button('요소 반복','repeat',()=>editStructure('repeat')),remove=button('요소 삭제','remove',()=>editStructure('remove'));field.append(replace,repeat,remove);
 const notice=document.createElement('p');notice.textContent='XML 작업은 이 창에서만 유지됩니다. 내보내기는 새 사본 다운로드 요청이며 디스크 저장 성공을 확인하지 않습니다. 기존 한글 문서는 바뀌지 않습니다.';
 const close=button('닫기','close',()=>{if(!workspace?.snapshot().dirty||confirm('XML 작업에 변경 내용이 있습니다. 새 사본을 내보냈는지 확인하세요. 작업을 닫으시겠습니까?'))dialog.close();});
 function button(text:string,action:string,run:()=>void){const b=document.createElement('button');b.type='button';b.textContent=text;b.dataset.xmlAction=action;b.onclick=()=>{error.textContent='';try{run();}catch(e){error.textContent=e instanceof Error?e.message:String(e);}};return b;}
 function editStructure(kind:'repeat'|'remove'){if(!workspace||!selected)return;workspace.edit({kind,revision:workspace.snapshot().revision,path:selected.path});render();}
 function download(kind:'xml'|'xsd'){if(!workspace)return;const artifact=workspace.exportArtifact(),text=kind==='xml'?artifact.xml:artifact.schema,name=kind==='xml'?xmlName:xsdName;const blob=new Blob([text],{type:'application/xml;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.download=name;a.href=url;dialog.append(a);try{a.click();status.textContent=`${name} 새 사본 내보내기를 요청했습니다. 실제 저장 여부를 확인하세요.`;}finally{a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}}
 function render(){const snap=workspace?.snapshot();selected=undefined;tree.replaceChildren();field.hidden=true;undo.disabled=!snap?.canUndo;redo.disabled=!snap?.canRedo;xmlExport.disabled=schemaExport.disabled=!snap;if(!snap)return;status.textContent=`XSD 지원 프로필 검사 통과 · ${snap.fields.length}개 요소 · ${snap.dirty?'수정됨':'원문'} · 버전 ${snap.revision}`;for(const f of snap.fields){const b=document.createElement('button');b.type='button';b.dataset.xmlPath=JSON.stringify(f.path);b.style.display='block';b.style.marginLeft=`${f.path.length*16}px`;b.textContent=`${f.name}${f.simple?' : '+f.value:''}`;b.onclick=()=>{selected=f;legend.textContent=f.namespace?`{${f.namespace}}${f.name}`:f.name;value.value=f.value;value.disabled=replace.disabled=!f.simple;repeat.disabled=remove.disabled=f.path.length===0;field.hidden=false;};tree.append(b);}}
 open.onclick=async()=>{if(loading)return;error.textContent='';const xml=xmlInput.files?.[0],xsd=xsdInput.files?.[0];if(!xml||!xsd){error.textContent='XML과 XSD 파일을 각각 선택하세요.';return;}if(xml.size>2_000_000||xsd.size>2_000_000){error.textContent='XML과 XSD 파일은 각각 2MB 이하여야 합니다. 파일을 읽지 않았습니다.';return;}loading=true;open.disabled=true;try{const [a,b]=await Promise.all([xml.arrayBuffer(),xsd.arrayBuffer()]);const candidate=createXmlWorkspace(browserXmlCodec,decodeXmlUtf8(new Uint8Array(a)),decodeXmlUtf8(new Uint8Array(b)));if(!dialog.isConnected)return;if(workspace?.snapshot().dirty&&!confirm('현재 XML 작업의 변경 내용을 버리고 선택한 새 문서를 여시겠습니까?'))return;workspace=candidate;xmlName=xml.name.replace(/[^.]+$/,'xml');xsdName=xsd.name.replace(/[^.]+$/,'xsd');render();}catch(e){error.textContent=e instanceof Error?e.message:String(e);}finally{loading=false;open.disabled=false;}};
 dialog.addEventListener('cancel',event=>{if(workspace?.snapshot().dirty&&!confirm('XML 작업의 변경 내용을 버리고 닫으시겠습니까?'))event.preventDefault();});
 const beforeUnload=(event:BeforeUnloadEvent)=>{if(workspace?.snapshot().dirty){event.preventDefault();event.returnValue='';}};
 window.addEventListener('beforeunload',beforeUnload);
 dialog.addEventListener('close',()=>{window.removeEventListener('beforeunload',beforeUnload);dialog.remove();},{once:true});dialog.append(title,scope,files,error,status,actions,tree,field,notice,close);document.body.append(dialog);render();dialog.showModal();return dialog;
}
