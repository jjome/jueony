import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateN041CorpusManifest,classifyN041Failure} from '../scripts/lib/n041-corpus-contract.mjs';

const manifest=()=>JSON.parse(readFileSync(new URL('./fixtures/n041-engine-corpus-own/manifest.json',import.meta.url),'utf8'));

test('N041 manifest covers five synthetic feature builders and both formats',()=>{
 const value=validateN041CorpusManifest(manifest());
 assert.deepEqual(value.cases.map(entry=>entry.builder).sort(),['body-font','field','page-boundary','picture','table']);
 for(const entry of value.cases)assert.deepEqual(entry.formats,['hwp','hwpx']);
});

test('N041 manifest rejects omitted coverage, forged paths, duplicate ids and extra keys',()=>{
 const cases=[
  value=>value.cases.pop(),
  value=>value.cases[0].requiredEvidence.push('../secret'),
  value=>value.cases[1].id=value.cases[0].id,
  value=>value.cases[0].unexpected=true,
  value=>value.generatedSynthetic=false,
 ];
 for(const mutate of cases){const value=manifest();mutate(value);assert.throws(()=>validateN041CorpusManifest(value));}
});

test('N041 failures use bounded explicit classifications',()=>{
 assert.deepEqual(classifyN041Failure('reopen',new Error('broken')),{stage:'reopen',code:'REOPEN_FAILED',message:'broken'});
 assert.equal(classifyN041Failure('not-a-stage','x').code,'UNCLASSIFIED_FAILURE');
 assert.equal(classifyN041Failure('save','x'.repeat(3000)).message.length,2048);
});
