import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildUnavailableDateRows,
  expandDateRange,
  getCalendarUnavailableSelection,
  saveGuideUnavailableDates
} from '../lib/guideAvailability.js';

test('expandDateRange returns one day when start and end match', () => {
  assert.deepEqual(expandDateRange('2026-07-10', '2026-07-10'), ['2026-07-10']);
});

test('expandDateRange expands an inclusive date range in order', () => {
  assert.deepEqual(expandDateRange('2026-07-10', '2026-07-12'), ['2026-07-10', '2026-07-11', '2026-07-12']);
});

test('expandDateRange normalizes reversed ranges', () => {
  assert.deepEqual(expandDateRange('2026-07-12', '2026-07-10'), ['2026-07-10', '2026-07-11', '2026-07-12']);
});

test('getCalendarUnavailableSelection starts with one selected day', () => {
  assert.deepEqual(getCalendarUnavailableSelection({ startDate: '', endDate: '' }, '2026-07-10'), {
    startDate: '2026-07-10',
    endDate: '2026-07-10'
  });
});

test('getCalendarUnavailableSelection extends one selected day into a date range', () => {
  assert.deepEqual(getCalendarUnavailableSelection({ startDate: '2026-07-10', endDate: '2026-07-10' }, '2026-07-12'), {
    startDate: '2026-07-10',
    endDate: '2026-07-12'
  });
});

test('getCalendarUnavailableSelection starts a new selection after a range exists', () => {
  assert.deepEqual(getCalendarUnavailableSelection({ startDate: '2026-07-10', endDate: '2026-07-12' }, '2026-07-15'), {
    startDate: '2026-07-15',
    endDate: '2026-07-15'
  });
});

test('buildUnavailableDateRows maps dates for Supabase upsert', () => {
  assert.deepEqual(buildUnavailableDateRows({
    guideProfileId: 'guide-1',
    userId: 'user-1',
    dates: ['2026-07-10']
  }), [{
    guide_id: 'guide-1',
    created_by: 'user-1',
    unavailable_date: '2026-07-10'
  }]);
});

test('saveGuideUnavailableDates upserts unavailable dates after resolving guide profile id', async () => {
  const calls = [];
  const fakeClient = {
    from: (table) => ({
      select: (columns) => ({
        eq: (column, value) => ({
          maybeSingle: async () => {
            calls.push(['select', table, columns, column, value]);
            return { data: { id: 'guide-1' }, error: null };
          }
        })
      }),
      upsert: async (rows, options) => {
        calls.push(['upsert', table, rows, options]);
        return { error: null };
      }
    })
  };

  const result = await saveGuideUnavailableDates(fakeClient, {
    userId: 'user-1',
    dates: ['2026-07-10', '2026-07-11']
  });

  assert.equal(result.guideProfileId, 'guide-1');
  assert.equal(result.count, 2);
  assert.deepEqual(calls[1], ['upsert', 'guide_unavailable_dates', [
    { guide_id: 'guide-1', created_by: 'user-1', unavailable_date: '2026-07-10' },
    { guide_id: 'guide-1', created_by: 'user-1', unavailable_date: '2026-07-11' }
  ], { onConflict: 'guide_id,unavailable_date', ignoreDuplicates: true }]);
});
