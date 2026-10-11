import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';

/** Patch only the two no-op body edges, after cell/field/HF and keyboard guards. */
export async function applySectionBoundaryPatches({root}) {
  const path=join(root,'src/engine/input-handler-text.ts');
  let source=(await readFile(path,'utf8')).replace(/\r\n/g,'\n');
  const replace=(before,after)=>{
    if(source.split(before).length!==2)throw new Error('구역 경계 키 처리 패치 기준 불일치');
    source=source.replace(before,after);
  };
  source="import { mergeBodySectionBoundary } from '@/jueony/adapters/rhwp/section-boundary';\n"+source;
  replace('new MergeParagraphCommand({ sectionIndex: sec, paragraphIndex: para, charOffset: 0 }) });\n    }',
    'new MergeParagraphCommand({ sectionIndex: sec, paragraphIndex: para, charOffset: 0 }) });\n    } else if (sec > 0) {\n      mergeBodySectionBoundary(this, sec);\n    }');
  replace('new MergeNextParagraphCommand(pos) });\n      }',
    'new MergeNextParagraphCommand(pos) });\n      } else if (sec + 1 < this.wasm.getSectionCount()) {\n        mergeBodySectionBoundary(this, sec + 1);\n      }');
  await writeFile(path,source);
}
