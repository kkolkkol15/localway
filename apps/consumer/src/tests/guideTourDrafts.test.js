import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGuideTourDraftRow, saveGuideTourDraft } from '../lib/guideTourDrafts.js';

test('buildGuideTourDraftRow stores tour draft payload for later restore', () => {
  assert.deepEqual(buildGuideTourDraftRow({
    draftId: 'tour-draft-1',
    guideProfileId: 'guide-1',
    userId: 'user-1',
    payload: { title: 'Market walk', currency: 'USD' }
  }), {
    id: 'tour-draft-1',
    guide_id: 'guide-1',
    created_by: 'user-1',
    title: 'Market walk',
    payload: { title: 'Market walk', currency: 'USD' }
  });
});

test('saveGuideTourDraft upserts a guide tour draft', async () => {
  const calls = [];
  const fakeClient = {
    from: (table) => ({
      upsert: async (row, options) => {
        calls.push(['upsert', table, row, options]);
        return { error: null };
      }
    })
  };

  const result = await saveGuideTourDraft(fakeClient, {
    draftId: 'tour-draft-1',
    guideProfileId: 'guide-1',
    userId: 'user-1',
    payload: { title: 'Market walk' }
  });

  assert.equal(result.id, 'tour-draft-1');
  assert.deepEqual(calls[0], ['upsert', 'guide_tour_drafts', {
    id: 'tour-draft-1',
    guide_id: 'guide-1',
    created_by: 'user-1',
    title: 'Market walk',
    payload: { title: 'Market walk' }
  }, { onConflict: 'id' }]);
});
