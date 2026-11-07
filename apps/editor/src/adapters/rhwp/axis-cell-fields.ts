import {sha256} from '@noble/hashes/sha2.js';

/** Click-here fields carry text ranges and a stable stored ID. A named cell
 * instead has a virtual ID assigned from its current position. Cursor list IDs
 * and the owning cell index change as earlier cells move. */
export function axisFieldSignature(doc:any, section:number, paragraph:number, control:number, index:number,
    list:any, children:any[], fields:any[], fieldName:unknown):string|undefined {
  if (!list || typeof fieldName !== 'string' || !Array.isArray(fields)) return;
  const owned = fields.filter(f => f.listId === list.listId);
  const inline = owned.filter(f => f.cellField === false);
  const named = owned.filter(f => f.cellField === true);
  if (!owned.length || owned.length > 50 || inline.length !== children.length
      || inline.length + named.length !== owned.length || named.length !== Number(fieldName !== '')
      || named.some(f => f.name !== fieldName)) return;
  const content = [];
  for (const f of owned) {
    const loc = f.location, step = loc?.path?.[0];
    if (f.fieldType !== 'clickhere' || loc?.sectionIndex !== section || loc?.paraIndex !== paragraph
        || loc?.path?.length !== 1 || step.type !== 'cell' || step.controlIndex !== control || step.cellIndex !== index
        || step.paraIndex !== f.paraInList || !Number.isSafeInteger(f.fieldId) || typeof f.editableInForm !== 'boolean'
        || ![f.name,f.guide,f.command,f.value].every(v => typeof v === 'string')
        || ![f.startCharIdx,f.endCharIdx,f.startPos,f.endPos,f.paraInList].every(n=>Number.isSafeInteger(n)&&n>=0)
        || f.endCharIdx < f.startCharIdx || f.endPos < f.startPos) return;
    const {location:owner, listId:slot, fieldId, ...data} = f;
    if (f.cellField) { content.push(data); continue; }
    const at = doc.getFieldInfoAtInCell(section,paragraph,control,index,f.paraInList,f.startCharIdx,false);
    const detail = typeof at === 'string' ? JSON.parse(at) : at;
    if (!detail?.inField || detail.fieldType !== 'clickhere' || detail.fieldId !== fieldId
        || detail.startCharIdx !== f.startCharIdx || detail.endCharIdx !== f.endCharIdx) return;
    content.push({fieldId, data, detail});
  }
  for (const child of children) {
    if (child.ctrlId !== '' || child.ctrlCh !== 0 || !Number.isSafeInteger(child.controlIndex)
        || children.filter(c => c.para === child.para).length !== inline.filter(f => f.paraInList === child.para).length) return;
  }
  const records = children.map(({list:slot,...control}) => control);
  const bytes=sha256(new TextEncoder().encode(JSON.stringify([content,records])));
  return Array.from(bytes,n => n.toString(16).padStart(2,'0')).join('');
}
