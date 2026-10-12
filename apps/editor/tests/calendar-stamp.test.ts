import {test} from 'node:test';
import assert from 'node:assert/strict';
import {formatCalendarStamp,calendarStampFormats} from '../src/modules/document/public/index.ts';
const stamp={year:2026,month:1,day:2,hour:3,minute:4,second:5};
test('calendar stamps preserve local components with explicit civil document formats',()=>{
  assert.deepEqual(calendarStampFormats.map(format=>formatCalendarStamp(stamp,format)),['2026.01.02','2026년 1월 2일','2026-01-02','03:04:05','2026.01.02 03:04:05']);
});
test('Gregorian boundaries and invalid clock or format values cannot produce misleading dates',()=>{
  assert.equal(formatCalendarStamp({...stamp,year:2000,month:2,day:29},'date-iso'),'2000-02-29');
  for(const value of [{...stamp,year:1900,month:2,day:29},{...stamp,month:4,day:31},{...stamp,day:0},{...stamp,hour:24},{...stamp,second:NaN},{...stamp,year:0},{...stamp,month:1.5}])assert.throws(()=>formatCalendarStamp(value,'date-dots'));
  assert.throws(()=>formatCalendarStamp(stamp,'field-code'));
});
