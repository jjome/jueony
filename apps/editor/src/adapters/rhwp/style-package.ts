import { StylePackageDialog } from '../browser/style-package-dialog.ts';
import { parseStylePackage } from '../../modules/document/public/style-package.ts';
import { importStylePackage, preflightStylePackage } from './style-package-native.ts';
import {showStyleGalleryDialog} from '../browser/style-gallery-dialog.ts';
import {createStyleGalleryProfileStore} from '../browser/style-gallery-profile.ts';
import {createStyleShortcutProfileStore} from '../browser/style-shortcut-profile.ts';
import {applyAndBindStyleGalleryPreview,applyStyleGalleryPreview,previewStyleGallery} from './style-gallery-controller.ts';
import {preflightDocumentEdit} from './edit-preflight.ts';
export function installStylePackage(registry: any, input: () => any, eventBus: any): void {
  const can = (context: any) => context.hasDocument && context.isEditable && !context.isFormMode && !input()?.isComposing && !input()?.wasm.requiresPasswordForSave;
  registry.register({ id: 'format:style-package', label: '스타일 내보내기·가져오기', opensDialog: true, canExecute: can, execute: () => {
    const api = (window as any).jueonyEditor, revision = api.revision(), current = () => { if (api.busy() || api.revision() !== revision || !can((window as any).rhwpStudio.automation.getContext())) throw new Error('문서 상태가 바뀌었습니다. 스타일 교환 창을 다시 여세요.'); };
    new StylePackageDialog(input().wasm, current, text => {
      current(); const value = parseStylePackage(text); preflightStylePackage(input().wasm, value); current(); const ih = input(), position = ih.getCursorPosition();
      ih.executeOperation({ kind: 'snapshot', operationType: 'jueonyStylePackage', operation: (wasm: any) => { importStylePackage(wasm, value); return position; } }); eventBus.emit('command-state-changed');
    }).show();
  } });
  const anchor = document.querySelector('.md-item[data-cmd="format:style-dialog"]');
  if (anchor) { const item = document.createElement('div'); item.className = 'md-item'; item.dataset.cmd = 'format:style-package'; const label = document.createElement('span'); label.className = 'md-label'; label.textContent = '스타일 내보내기·가져오기'; item.append(label); anchor.after(item); }
  const galleryContext=(context:any)=>can(context)&&!context.inTable&&!context.inCellSelectionMode&&
    !context.inPictureObjectSelection&&!context.inTableObjectSelection&&!input()?.getCursorPosition()?.cellPath?.length&&
    !input()?.cursor?.isInHeaderFooter?.()&&!input()?.cursor?.isInFootnote?.()&&!input()?.cursor?.isInTextBox?.();
  registry.register({id:'format:apply-style-gallery',label:'스타일마당 적용',opensDialog:true,canExecute:galleryContext,execute:()=>{
    const host=window as any,api=host.jueonyEditor,revision=api.revision();
    const current=()=>{
      if(api.busy()||api.revision()!==revision||!galleryContext(host.rhwpStudio.automation.getContext())){
        throw new Error('문서 상태가 바뀌었습니다. 스타일마당을 다시 여세요.');
      }
    };
    const profiles=createStyleGalleryProfileStore(localStorage),shortcuts=createStyleShortcutProfileStore(localStorage);
    const profile=profiles.read();
    showStyleGalleryDialog(profile,entryId=>{
      current();
      if(!profile)throw new Error('스타일마당 프로필을 가져오세요.');
      return previewStyleGallery(profiles,input().wasm,{profileId:profile.id,profileName:profile.name,entryId});
    },(preview,acknowledgeWarnings)=>{
      current();
      const ih=input(),position=ih.getCursorPosition(),options={acknowledgeWarnings};
      preflightDocumentEdit(ih.wasm,scratch=>{applyStyleGalleryPreview(profiles,scratch,preview,options);});
      current();
      ih.executeOperation({kind:'snapshot',operationType:'jueonyStyleGallery',operation:(wasm:any)=>{
        current();applyAndBindStyleGalleryPreview(profiles,shortcuts,wasm,preview,options);return position;
      }});
      eventBus.emit('command-state-changed');
    });
  }});
  if(anchor){
    const item=document.createElement('div');item.className='md-item';item.dataset.cmd='format:apply-style-gallery';
    const label=document.createElement('span');label.className='md-label';label.textContent='스타일마당 적용';item.append(label);anchor.after(item);
  }
}
