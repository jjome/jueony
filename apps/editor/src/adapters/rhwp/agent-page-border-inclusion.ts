import {agentPageBorderSections,validatePageBorderSettings} from '../../modules/document/public/index.ts';
import type {AgentPageBorderInclusionOp,PageBorderKind,PageBorderSettings,Snapshot,Structure} from '../../modules/document/public/index.ts';
import {executePageBorderEdits,planPageBorderEdits,readPageBorderSettings,supportsPageBorderEntries,supportsPageBorderInclusion} from './page-border-settings.ts';
import {supportsPageBackgroundImage} from './page-background-image.ts';

const kinds=['both','even','odd'] as const;
type Inclusion=NonNullable<Structure['sections'][number]['pageBorderInclusion']>;

function canPreserveSetting(setting:PageBorderSettings,canReadImage:boolean):boolean{
  const supportedFill=['none','solid','gradient'].includes(setting.fillType)||
    (setting.fillType==='image'&&canReadImage&&Number.isInteger(setting.image?.binDataId));
  if(setting.basis!=='page'||!supportedFill||
    (typeof setting.patternType==='number'&&setting.patternType>0)||
    typeof setting.headerInside!=='boolean'||typeof setting.footerInside!=='boolean')return false;
  try{validatePageBorderSettings(setting);return true;}
  catch{return false;}
}

export function readAgentPageBorderInclusion(doc:any,section:number):Inclusion|undefined{
  if(!supportsPageBorderEntries(doc)||!supportsPageBorderInclusion(doc))return;
  const settings=kinds.map(kind=>readPageBorderSettings(doc,section,kind));
  const canReadImage=typeof doc.getPageBackgroundImageBytes==='function'&&supportsPageBackgroundImage(doc);
  return {
    editable:settings.every(setting=>canPreserveSetting(setting,canReadImage)),
    entries:kinds.map((kind,i)=>({kind,headerInside:settings[i].headerInside===true,footerInside:settings[i].footerInside===true})),
  };
}

function planSectionInclusion(doc:any,snapshot:Snapshot,section:number,{headerInside,footerInside}:Pick<AgentPageBorderInclusionOp,'headerInside'|'footerInside'>){
  const previous=snapshot.structure?.sections.find(item=>item.index===section)?.pageBorderInclusion;
  const current=readAgentPageBorderInclusion(doc,section);
  if(!previous?.editable||!current?.editable||JSON.stringify(previous)!==JSON.stringify(current)){
    throw new Error('쪽 테두리의 현재 설정을 확인할 수 없습니다.');
  }
  const drafts=new Map<PageBorderKind,PageBorderSettings>();
  const checkedImages=new Set<number>();
  for(const kind of kinds){
    const before=readPageBorderSettings(doc,section,kind);
    const imageId=before.fillType==='image'?before.image?.binDataId:undefined;
    if(imageId!==undefined&&!checkedImages.has(imageId)){
      const bytes=doc.getPageBackgroundImageBytes(section,kind);
      if(!(bytes instanceof Uint8Array)||!bytes.length)throw new Error('쪽 테두리의 기존 그림 배경을 읽지 못했습니다.');
      checkedImages.add(imageId);
    }
    drafts.set(kind,{...before,
      headerInside:headerInside??before.headerInside,
      footerInside:footerInside??before.footerInside,
    });
  }
  return planPageBorderEdits(doc,section,drafts,'current');
}

export function executeAgentPageBorderInclusion(doc:any,snapshot:Snapshot,section:number,properties:Record<string,unknown>):void{
  executePageBorderEdits(doc,planSectionInclusion(doc,snapshot,section,{
    headerInside:properties.borderIncludesHeader as boolean|undefined,
    footerInside:properties.borderIncludesFooter as boolean|undefined,
  }));
}

export function executeAgentPageBorderInclusions(doc:any,snapshot:Snapshot,operation:AgentPageBorderInclusionOp):void{
  const sections=agentPageBorderSections(operation,snapshot);
  const edits=sections.flatMap(section=>planSectionInclusion(doc,snapshot,section,operation));
  if(!edits.length)throw new Error('선택한 구역에 이미 같은 테두리 포함 설정이 적용되어 있습니다.');
  executePageBorderEdits(doc,edits);
}
