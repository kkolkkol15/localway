export function buildGuideTourDraftRow({ draftId, guideProfileId, userId, payload }) {
  return {
    id: draftId,
    guide_id: guideProfileId,
    created_by: userId,
    title: payload.title || 'Untitled tour draft',
    payload
  };
}

export async function saveGuideTourDraft(client, { draftId, guideProfileId, userId, payload }) {
  if (!guideProfileId) throw new Error('A guide profile id is required to save a tour draft.');
  if (!userId) throw new Error('A user id is required to save a tour draft.');
  const row = buildGuideTourDraftRow({ draftId, guideProfileId, userId, payload });

  const { error } = await client
    .from('guide_tour_drafts')
    .upsert(row, { onConflict: 'id' });

  if (error) throw error;
  return { id: draftId };
}
