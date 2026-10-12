import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CALENDAR_FORMAT_KEY, createCalendarFormatPreference } from '../src/adapters/browser/calendar-format-preference.ts';

function fixture(initial: string | null = null) {
  let value = initial;
  return { getItem: (key: string) => { assert.equal(key, CALENDAR_FORMAT_KEY); return value; },
    setItem: (key: string, next: string) => { assert.equal(key, CALENDAR_FORMAT_KEY); value = next; } };
}
test('fresh user defaults and reopened preference preserve unknown additions', () => {
  const storage = fixture(), preference = createCalendarFormatPreference(storage);
  assert.equal(preference.read(), 'date-dots'); preference.save('date-time');
  assert.equal(createCalendarFormatPreference(storage).read(), 'date-time');
  storage.setItem(CALENDAR_FORMAT_KEY, JSON.stringify({ version: 1, format: 'time', extension: { future: true } }));
  preference.save('date-iso');
  assert.deepEqual(JSON.parse(storage.getItem(CALENDAR_FORMAT_KEY)!), { version: 1, format: 'date-iso', extension: { future: true } });
});
test('corrupt, unknown and newer settings cannot be overwritten on confirmation', () => {
  for (const raw of ['{', '[]', 'null', '{"version":2,"format":"time"}', '{"version":1,"format":"unknown"}']) {
    const storage = fixture(raw), preference = createCalendarFormatPreference(storage);
    assert.throws(() => preference.read()); assert.throws(() => preference.save('time'));
    assert.equal(storage.getItem(CALENDAR_FORMAT_KEY), raw);
  }
});
test('read and quota failures are explicit and retain previous preference', () => {
  const storage = fixture('{"version":1,"format":"time"}');
  const quota = createCalendarFormatPreference({ ...storage, setItem: () => { throw Error('quota'); } });
  assert.throws(() => quota.save('date-time'), /저장하지 못했습니다/);
  assert.equal(createCalendarFormatPreference(storage).read(), 'time');
  assert.throws(() => createCalendarFormatPreference({ ...storage, getItem: () => { throw Error('blocked'); } }).read(), /읽지 못했습니다/);
  assert.throws(() => quota.save('unknown'));
});
