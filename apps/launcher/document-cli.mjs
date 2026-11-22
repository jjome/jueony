import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { validateEditProposal } from '../editor/src/modules/document/public/index.ts';
import { generationSchema } from './contracts/document-wire-schema.mjs';

const MAX_INPUT = 1_500_000;
const isRecord = value => value && typeof value === 'object' && !Array.isArray(value);
const protocolVersion = '2025-11-25';
const fileCommandsConfigured = Boolean(process.env.JUEONY_DOCUMENT_ROOT && process.env.JUEONY_ENGINE_PACKAGE);
let fileService;
function documentFiles() {
  fileService ??= import('./services/document-copy.mjs').then(({openDocumentCopyService}) =>
    openDocumentCopyService(process.env.JUEONY_DOCUMENT_ROOT, process.env.JUEONY_ENGINE_PACKAGE));
  return fileService;
}
const methods = [
  { name:'jueony_document_catalog', description:'List the editor operation IDs and required fields.',
    inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,openWorldHint:false} },
  { name:'jueony_check_document_proposal', description:'Check a proposal against the supplied document snapshot and selected reference IDs. No document mutation.',
    inputSchema:{type:'object',properties:{snapshot:{type:'object'},proposal:{type:'object'},sourceIds:{type:'array',items:{type:'string'}}},
      required:['snapshot','proposal'],additionalProperties:false},annotations:{readOnlyHint:true,openWorldHint:false} },
  ...(fileCommandsConfigured ? [
    { name:'jueony_inspect_document', description:'Read the body paragraphs and SHA-256 of a saved HWP/HWPX in the configured local folder.',
      inputSchema:{type:'object',properties:{source:{type:'string'}},required:['source'],additionalProperties:false},
      annotations:{readOnlyHint:true,openWorldHint:false} },
    { name:'jueony_save_edited_copy', description:'Apply verified plain paragraph edits to a new HWP/HWPX file in the configured folder. An existing file cannot be replaced.',
      inputSchema:{type:'object',properties:{source:{type:'string'},output:{type:'string'},expectedSha256:{type:'string',pattern:'^[a-f0-9]{64}$'},
        operations:{type:'array',minItems:1,maxItems:30,items:{type:'object'}}},
        required:['source','output','expectedSha256','operations'],additionalProperties:false},
      annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:false} },
  ] : []),
];

function catalog() {
  return generationSchema().properties.operations.items.anyOf.map(schema=>({
    id:schema.properties.kind.enum[0],required:schema.required.filter(key=>key!=='kind'),
  }));
}

function dryRun(input) {
  if (!isRecord(input) || !isRecord(input.snapshot) || !isRecord(input.proposal)
      || !Array.isArray(input.snapshot.nodes) || !input.snapshot.nodes.every(node=>isRecord(node)&&typeof node.id==='string'&&typeof node.text==='string')
      || typeof input.snapshot.revision!=='string' || !input.snapshot.revision
      || JSON.stringify(input).length > MAX_INPUT) throw new Error('Supply a current document snapshot and a proposed change.');
  const ids = input.sourceIds ?? [];
  if (!Array.isArray(ids) || ids.length>20 || ids.some(id=>typeof id!=='string'||!id||id.length>1000)) throw new Error('Invalid selected reference IDs.');
  const result=validateEditProposal(input.proposal,input.snapshot,ids);
  return { status:'validated',operationCount:result.operations.length,kinds:result.operations.map(operation=>operation.kind),mutations:0 };
}

async function readInput(stream) {
  let size=0;
  const chunks=[];
  for await(const chunk of stream){
    size+=chunk.length;
    if(size>MAX_INPUT)throw new Error('Input limit exceeded.');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function serveStdio() {
  let initialized=false,receivedInitialize=false;
  const write=value=>process.stdout.write(`${JSON.stringify(value)}\n`);
  const input=createInterface({input:process.stdin,crlfDelay:Infinity});
  for await(const line of input){
    let request;
    try {if(line.length>MAX_INPUT)throw new Error();request=JSON.parse(line);}
    catch {write({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Invalid JSON input'}});continue;}
    const respond=(result,error)=>write({jsonrpc:'2.0',id:request?.id??null,...(error?{error}:{result})});
    if(!isRecord(request)||request.jsonrpc!=='2.0'||typeof request.method!=='string'){
      respond(null,{code:-32600,message:'Invalid request'});continue;
    }
    if(!Object.hasOwn(request,'id')){
      if(request.method==='notifications/initialized'&&receivedInitialize)initialized=true;
      continue;
    }
    if(request.method==='ping'){respond({});continue;}
    if(request.method==='initialize'&&!receivedInitialize){
      receivedInitialize=true;
      respond({protocolVersion,capabilities:{tools:{listChanged:false}},serverInfo:{name:'jueony-document-plans',version:'0.0.1'}});continue;
    }
    if(!initialized){respond(null,{code:-32002,message:'Initialize the document plan service first'});continue;}
    if(request.method==='tools/list'){respond({tools:methods});continue;}
    if(request.method!=='tools/call'){respond(null,{code:-32601,message:'Method not found'});continue;}
    if(!methods.some(method=>method.name===request.params?.name)){
      respond(null,{code:-32602,message:'Unknown tool'});continue;
    }
    try {
      const args=request.params.arguments;
      let value;
      switch (request.params.name) {
        case 'jueony_document_catalog': value=catalog(); break;
        case 'jueony_check_document_proposal': value=dryRun(args); break;
        case 'jueony_inspect_document': value=await (await documentFiles()).inspect(args?.source); break;
        case 'jueony_save_edited_copy': value=await (await documentFiles()).applyCopy(args); break;
      }
      respond({content:[{type:'text',text:JSON.stringify(value)}]});
    } catch(error) {respond({isError:true,content:[{type:'text',text:error instanceof Error?error.message:'Proposal failed validation'}]});}
  }
}

try {
  const [command,file,...rest]=process.argv.slice(2);
  const usage='Use catalog, schema, dry-run <json|->, inspect <hwp|hwpx>, apply-copy <json|->, or mcp.';
  if(rest.length)throw new Error(usage);
  if(command==='mcp'&&!file)await serveStdio();
  else {
    let value;
    if(command==='catalog'&&!file)value=catalog();
    else if(command==='schema'&&!file)value=generationSchema();
    else if(command==='dry-run'&&file)value=dryRun(await readInput(file==='-'?process.stdin:createReadStream(file)));
    else if(command==='inspect'&&file)value=await (await documentFiles()).inspect(file);
    else if(command==='apply-copy'&&file)value=await (await documentFiles()).applyCopy(await readInput(file==='-'?process.stdin:createReadStream(file)));
    else throw new Error(usage);
    process.stdout.write(`${JSON.stringify(value,null,2)}\n`);
  }
} catch(error) {process.stderr.write(`${error instanceof Error?error.message:'Document plan failed'}\n`);process.exitCode=1;}
