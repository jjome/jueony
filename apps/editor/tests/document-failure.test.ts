import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readDocumentFailure} from '../src/modules/document/public/index.ts';
test('remote editor Error keeps rollback name and message across the iframe constructor boundary',()=>{const error=vm.runInNewContext("Object.assign(new Error('실문서 실패'),{name:'RolledBackError'})");assert.equal(error instanceof Error,false);assert.deepEqual(readDocumentFailure(error),{name:'RolledBackError',message:'실문서 실패'});});
test('partial, conflict and normal same-realm failures retain their actual classification',()=>{for(const name of ['PartialApplyError','ConflictError','PreservationError','ApplyError'])assert.deepEqual(readDocumentFailure(Object.assign(new Error('원인'),{name})),{name,message:'원인'});assert.deepEqual(readDocumentFailure(new DOMException('취소','AbortError')),{name:'AbortError',message:'취소'});});
test('plain response objects and arbitrary values cannot become successful rollback classifications',()=>{for(const value of [null,undefined,5,{name:'RolledBackError',message:'위장'},[]])assert.deepEqual(readDocumentFailure(value),{name:'Error',message:'실행 오류'});assert.deepEqual(readDocumentFailure('원본 오류'),{name:'Error',message:'원본 오류'});});
test('throwing error properties are contained and never replace the original failure with another throw',()=>{const value=new Error();Object.defineProperty(value,'message',{get(){throw new Error('getter');}});assert.deepEqual(readDocumentFailure(value),{name:'Error',message:'실행 오류'});});
