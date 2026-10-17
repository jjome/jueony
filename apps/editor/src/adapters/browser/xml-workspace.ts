import type {DocumentInteractionFacade,EditorMenuItem} from '../../modules/document/public/index.ts';
export const XML_WORKSPACE_COMMAND='file:xml-workspace';
/** XML authority is a host-local dialog, not a Native document command or Agent capability. */
export function createXmlDocuments(options:{canOpen:()=>boolean;open:()=>void}){
 const wrappers=new WeakMap<object,DocumentInteractionFacade>();
 function execute(command:string){if(command!==XML_WORKSPACE_COMMAND)return false;if(!options.canOpen())throw Error('현재 문서 작업과 대화상자를 마친 뒤 XML 문서를 여세요.');options.open();return true;}
 function strip(items:EditorMenuItem[]):EditorMenuItem[]{return items.filter(n=>n.commandId!==XML_WORKSPACE_COMMAND).map(n=>n.submenu?{...n,submenu:strip(n.submenu)}:n);}
 function wrap(editor:DocumentInteractionFacade){const previous=wrappers.get(editor);if(previous)return previous;const wrapper=Object.create(editor)as DocumentInteractionFacade;wrapper.commands=()=>[...editor.commands().filter(c=>c.id!==XML_WORKSPACE_COMMAND),{id:XML_WORKSPACE_COMMAND,label:'XML/XSD 문서 작업',enabled:options.canOpen()}];wrapper.menus=()=>editor.menus().map(menu=>menu.menuId==='file'?{...menu,items:[...strip(menu.items),{label:'XML 문서',enabled:options.canOpen(),submenu:[{label:'XML/XSD 문서 작업',commandId:XML_WORKSPACE_COMMAND,enabled:options.canOpen()}]}]}:menu);wrappers.set(editor,wrapper);return wrapper;}
 return{wrap,execute};
}
