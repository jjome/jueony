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
