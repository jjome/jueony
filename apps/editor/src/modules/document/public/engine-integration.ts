/** Explicit native-adapter support contract; not a command execution bypass. */
export {tableAxisKinds,controlKinds,charRules,tableAxisPlan,pageProperties,selectedCells,mm,validateControlOperations} from '../domain/control-operations.ts';
export {agentTabSpacingRaw,agentLineNumberSettings} from '../domain/agent-section-settings.ts';
export {agentMasterPagePayload,assertAgentMasterKinds} from '../domain/agent-master-pages.ts';

export {validateAgentSectionSplit} from '../domain/agent-section-split.ts';

export {validateAgentEmptySection} from '../domain/agent-empty-section.ts';

export {validateAgentSectionMerge} from '../domain/agent-section-merge.ts';

export {validateAgentHeaderFooter,validateAgentHeaderFooterFormat,validateAgentHeaderFooterParagraph,validateAgentHeaderFooterDelete,validateAgentHeaderFooterCreate} from '../domain/agent-header-footer.ts';

export {validateAgentBookmark,validBookmarkName} from '../domain/agent-bookmarks.ts';

export {agentParagraphTabsPayload} from '../domain/agent-paragraph-tabs.ts';

export {agentParagraphDecorationPayload,paragraphBorderWidthsMm} from '../domain/agent-paragraph-decoration.ts';

export {agentParagraphListPayload} from '../domain/agent-paragraph-list.ts';

export {agentCreateParagraphStyleName} from '../domain/agent-style-create.ts';
export {agentParagraphOutlinePayload} from '../domain/agent-paragraph-outline.ts';
export {validateAgentBasicNumbering,basicNumberingFormats,basicNumberingPatterns} from '../domain/agent-basic-numbering.ts';
export {validateAgentNumberingClone} from '../domain/agent-numbering-clone.ts';
export {validateAgentBasicBullet,basicBulletCharacters} from '../domain/agent-basic-bullet.ts';

export {agentRenameParagraphStyleName} from '../domain/agent-style-rename.ts';

export {validateAgentNextParagraphStyle} from '../domain/agent-style-next.ts';

export {validateAgentTablePagination} from '../domain/agent-table-pagination.ts';

export {validateAgentTableHeader} from '../domain/agent-table-header.ts';

export {equalColumnsPlan,explicitColumnWidthPlan} from '../domain/equal-columns.ts';
export {cellPaddingPlan} from '../domain/cell-padding.ts';
