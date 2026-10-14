import type {Table} from '../../modules/document/public/index.ts';
/** List IDs are ephemeral slots; exact addresses and paragraph/run semantics remain. */
export function topologySemantics(values:any){const {text:linearText,...rest}=structuredClone(values);rest.cells=rest.cells.map((c:any)=>{const {listId:slot,...list}=c.list;return {...c,list};});return rest;}
export const rootBodyTexts=(d:any)=>Array.from({length:d.getSectionCount()},(_,s)=>Array.from({length:d.getParagraphCount(s)},(_,p)=>d.getTextRange(s,p,0,d.getParagraphLength(s,p))));
export const tableTextTree=(tables:Table[])=>tables.map(t=>({id:t.id,section:t.section,paragraph:t.paragraph,control:t.control,cells:t.cells.map(c=>({index:c.index,row:c.row,column:c.column,text:c.text}))}));
