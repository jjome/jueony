export function mergedAxisFormulaFixture(HwpDocument){
 const seed=HwpDocument.createEmpty();seed.createBlankDocument();
 const created=JSON.parse(seed.createTable(0,0,0,4,4)),at=[0,created.paraIdx,created.controlIdx];
 for(let i=0;i<16;i++)seed.setCellProperties(...at,i,'{"height":5000,"width":6000}');
 seed.mergeTableCells(...at,0,0,0,1);
 seed.insertTextInCell(...at,0,0,0,'5');
 seed.insertTextInCell(...at,3,0,0,'3');
 seed.insertTextInCell(...at,4,0,0,'4');
 seed.insertTableFormulaField(...at,5,'','=SUM(A2:B2)+B1','%.2f');
 seed.insertTableFormulaField(...at,10,'','=C2*2','%g');
 return seed;
}
