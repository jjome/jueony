import {assertTemplate} from '../macros/commands.ts';
import type { AppState } from './model.ts';

type ObjectValue = Record<string, unknown>;
export class WorkspaceStateError extends Error {
  readonly code: 'version' | 'corrupt';
  readonly field: string;
  constructor(code: 'version' | 'corrupt', field: string) {
    super(code === 'version'
      ? '지원하지 않는 업무 저장소 버전입니다. 기존 업무와 문서 데이터는 보존했습니다.'
      : '저장된 업무 상태를 복원하지 못했습니다 (' + field + '). 기존 데이터를 삭제하거나 초기화하지 않았습니다.');
    this.name = 'WorkspaceStateError';
    this.code = code;
    this.field = field;
  }
}
function fail(field: string): never { throw new WorkspaceStateError('corrupt', field); }
function object(value: unknown, field: string): ObjectValue {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(field);
  return value as ObjectValue;
}
function text(value: unknown, field: string, nonempty = false): string {
  if (typeof value !== 'string' || (nonempty && !value.length)) fail(field);
  return value;
}
function number(value: unknown, field: string, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum) fail(field);
  return value;
}
function integer(value: unknown, field: string, minimum = 0): number {
  const n = number(value, field, minimum); if (!Number.isInteger(n)) fail(field); return n;
}
function list(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) fail(field); return value;
}
function optionalText(record: ObjectValue, key: string, field: string) {
  if (record[key] !== undefined) text(record[key], field + '.' + key);
}
function strings(value: unknown, field: string): string[] {
  return list(value, field).map((item, i) => text(item, field + '[' + i + ']', true));
}
function unique(values: string[], field: string) {
  if (new Set(values).size !== values.length) fail(field);
}
function records(value: unknown, field: string): Map<string, ObjectValue> {
  const result = new Map<string, ObjectValue>();
  list(value, field).forEach((raw, i) => {
    const item = object(raw, field + '[' + i + ']'), id = text(item.id, field + '[' + i + '].id', true);
    if (result.has(id)) fail(field + '[' + i + '].id');
    result.set(id, item);
  });
  return result;
}
const adapters = new Set(['openai-responses', 'anthropic', 'gemini', 'openai-compatible', 'hyperclova']);
const statuses = new Set(['preparing_context', 'generating', 'validating', 'applying', 'completed', 'cancelled', 'conflict', 'failed_no_change', 'failed_rolled_back', 'failed_partial', 'interrupted']);
function model(value: unknown, field: string): void {
  const m = object(value, field);
  if (!adapters.has(text(m.adapterId, field + '.adapterId'))) fail(field + '.adapterId');
  text(m.label, field + '.label'); text(m.endpoint, field + '.endpoint'); text(m.modelId, field + '.modelId');
  if (m.maxOutputTokens !== undefined) integer(m.maxOutputTokens, field + '.maxOutputTokens', 1);
}
function structure(value: unknown, field: string): void {
  const s = object(value, field);
  list(s.sections, field + '.sections').forEach((raw, i) => {
    const section = object(raw, field + '.sections[' + i + ']'); integer(section.index, field + '.sections.index');
    object(section.page, field + '.sections.page');
  });
  list(s.paragraphs, field + '.paragraphs').forEach((raw, i) => {
    const paragraph = object(raw, field + '.paragraphs[' + i + ']');
    text(paragraph.id, field + '.paragraphs.id', true);
    object(paragraph.characters, field + '.paragraphs.characters'); object(paragraph.paragraph, field + '.paragraphs.paragraph');
  });
  list(s.tables, field + '.tables').forEach((raw, i) => {
    const table = object(raw, field + '.tables[' + i + ']');
    text(table.id, field + '.tables.id', true);
    for (const key of ['section', 'paragraph', 'control', 'rows', 'columns']) integer(table[key], field + '.tables.' + key);
    list(table.cells, field + '.tables.cells').forEach((rawCell, c) => {
      const cell = object(rawCell, field + '.tables.cells[' + c + ']');
      for (const key of ['index', 'row', 'column', 'rowSpan', 'columnSpan']) integer(cell[key], field + '.tables.cells.' + key);
      text(cell.text, field + '.tables.cells.text');
      if (typeof cell.editable !== 'boolean') fail(field + '.tables.cells.editable');
      object(cell.properties, field + '.tables.cells.properties');
      if (cell.characters !== undefined) object(cell.characters, field + '.tables.cells.characters');
      if (cell.paragraphProperties !== undefined) object(cell.paragraphProperties, field + '.tables.cells.paragraphProperties');
    });
  });
  strings(s.unsupportedControls, field + '.unsupportedControls');
}

/**
 * Checks the persisted v1 contract without deleting, normalizing or cloning data.
 * File handles and unknown additive fields remain intact. Document records have
 * a separate recovery boundary; stale activeDocumentId is not a state failure.
 */
export function validateAppState(value: unknown): AppState {
  const state = object(value, 'state');
  if (state.version !== 1) throw new WorkspaceStateError('version', 'state.version');
  text(state.activeWorkspaceId, 'state.activeWorkspaceId');
  const workspaces = records(state.workspaces, 'workspaces');
  const chats = records(state.chats, 'chats');
  const folders = records(state.folders, 'folders');
  const runs = records(state.runs, 'runs');
  const models = records(state.models, 'models');
  const split = number(state.split, 'state.split'); if (split > 100) fail('state.split');
  if (state.agentWidth !== undefined) number(state.agentWidth, 'state.agentWidth');
  if (state.sidebarHidden !== undefined && typeof state.sidebarHidden !== 'boolean') fail('state.sidebarHidden');
  for(const key of ['focusMode','retrieveSources','reviewBeforeApply']) if(state[key]!==undefined&&typeof state[key]!=='boolean')fail('state.'+key);
  const belongs = (item: ObjectValue, field: string): string => {
    const id = text(item.workspaceId, field + '.workspaceId', true);
    if (!workspaces.has(id)) fail(field + '.workspaceId'); return id;
  };
  if(state.macros!==undefined)for(const macro of records(state.macros,'macros').values()){belongs(macro,'macros');text(macro.name,'macros.name',true);number(macro.createdAt,'macros.createdAt');try{assertTemplate(macro.template);}catch{fail('macros.template');}}
  let index = 0;
  for (const workspace of workspaces.values()) {
    const field = 'workspaces[' + index++ + ']';
    text(workspace.name, field + '.name');
    const activeChatId = text(workspace.activeChatId, field + '.activeChatId', true), active = chats.get(activeChatId);
    if (!active || active.workspaceId !== workspace.id) fail(field + '.activeChatId');
    optionalText(workspace, 'activeDocumentId', field);
    if (workspace.documentOrder !== undefined) unique(strings(workspace.documentOrder, field + '.documentOrder'), field + '.documentOrder');
  }
  index = 0;
  for (const chat of chats.values()) {
    const field = 'chats[' + index++ + ']'; belongs(chat, field);
    text(chat.title, field + '.title'); optionalText(chat, 'modelId', field);
    const messages = records(chat.messages, field + '.messages');
    for (const message of messages.values()) {
      if (!['user', 'assistant'].includes(text(message.role, field + '.messages.role'))) fail(field + '.messages.role');
      text(message.text, field + '.messages.text'); optionalText(message, 'runId', field + '.messages');
      // Older or independently pruned logs may omit a run. Existing runs must
      // never cross workspace/chat boundaries when referenced by a message.
      const run = runs.get(message.runId as string);
      if (run && (run.workspaceId !== chat.workspaceId || run.chatId !== chat.id)) fail(field + '.messages.runId');
    }
  }
  index = 0;
  for (const folder of folders.values()) {
    const field = 'folders[' + index++ + ']'; belongs(folder, field); text(folder.name, field + '.name');
    const handle = object(folder.handle, field + '.handle');
    if (handle.kind !== 'directory' || typeof handle.name !== 'string' || typeof handle.entries !== 'function') fail(field + '.handle');
  }
  index = 0;
  for (const run of runs.values()) {
    const field = 'runs[' + index++ + ']'; const workspaceId = belongs(run, field);
    const chatId = text(run.chatId, field + '.chatId', true);
    if (!chats.has(chatId) || chats.get(chatId)!.workspaceId !== workspaceId) fail(field + '.chatId');
    text(run.documentId, field + '.documentId', true);
    if (!statuses.has(text(run.status, field + '.status'))) fail(field + '.status');
    number(run.createdAt, field + '.createdAt'); optionalText(run, 'error', field);
    if (run.model !== undefined) model(run.model, field + '.model');
    const sources = records(run.sources, field + '.sources');
    for (const source of sources.values()) {
      text(source.name, field + '.sources.name'); integer(source.characters, field + '.sources.characters');
      text(source.sha256, field + '.sources.sha256'); optionalText(source, 'limitation', field + '.sources');
    }
    if (run.usedSourceIds !== undefined) strings(run.usedSourceIds, field + '.usedSourceIds');
    if(run.retrieval!==undefined){
      const r=object(run.retrieval,field+'.retrieval');if(r.mode!=='lexical')fail(field+'.retrieval.mode');
      for(const key of ['selectedSourceCount','indexedChunkCount','matchedChunkCount','sentCharacters','totalSourceCharacters'])integer(r[key],field+'.retrieval.'+key);
      strings(r.warnings,field+'.retrieval.warnings');
      for(const raw of list(r.hits,field+'.retrieval.hits')){const hit=object(raw,field+'.retrieval.hits');for(const key of ['id','sourceId','name','sourceSha256','contentSha256'])text(hit[key],field+'.retrieval.hits.'+key,true);for(const key of ['start','end','startLine','endLine'])integer(hit[key],field+'.retrieval.hits.'+key);number(hit.score,field+'.retrieval.hits.score');}
    }
    if(run.events!==undefined){
      const events=list(run.events,field+'.events');if(events.length>40)fail(field+'.events');
      for(const raw of events){const event=object(raw,field+'.events');if(!['generating','reviewing','validated','ready','applying','completed','stopped'].includes(text(event.phase,field+'.events.phase')))fail(field+'.events.phase');for(const key of ['call','maxCalls','elapsedMs'])number(event[key],field+'.events.'+key);}
    }
    if(run.macroTemplate!==undefined){try{assertTemplate(run.macroTemplate);}catch{fail(field+'.macroTemplate');}}
    if (run.receipt !== undefined) {
      const receipt = object(run.receipt, field + '.receipt');
      if (receipt.runId !== run.id) fail(field + '.receipt.runId');
      for (const key of ['beforeRevision', 'afterRevision', 'before', 'after']) text(receipt[key], field + '.receipt.' + key);
      integer(receipt.operationCount, field + '.receipt.operationCount');
      if (receipt.beforeStructure !== undefined) structure(receipt.beforeStructure, field + '.receipt.beforeStructure');
      if (receipt.afterStructure !== undefined) structure(receipt.afterStructure, field + '.receipt.afterStructure');
    }
  }
  index = 0;
  for (const config of models.values()) model(config, 'models[' + index++ + ']');
  // A missing active workspace is handled by shell.start's existing fallback.
  return value as AppState;
}