import assert from 'node:assert/strict';
import {labeledSubdivisionNestedTable} from './subdivision-nested-table.mjs';

/** Two separately owned, already-filled fields; their names intentionally match. */
export function fieldSubdivisionNestedTable(HwpDocument){
  const doc=labeledSubdivisionNestedTable(HwpDocument);
  try{
    for(const [cell,value] of ['😀','을'].entries()){
      const path=JSON.stringify([{controlIndex:0,cellIndex:0,cellParaIndex:1},
        {controlIndex:0,cellIndex:cell,cellParaIndex:0}]);
      const field=JSON.parse(doc.insertClickHereFieldByPath(0,1,path,1,'입력','설명','성명',true));
      assert.equal(field.ok,true);assert.equal(JSON.parse(doc.setFieldValue(field.fieldId,value)).ok,true);
      doc.applyCharFormatInCellByPath(0,1,path,1,2,JSON.stringify(cell?{italic:true}:{bold:true}));
    }
    for(let cell=0;cell<5;cell++)doc.setCellProperties(0,1,0,cell,'{"height":12000}');
    return doc;
  }catch(error){doc.free();throw error;}
}
