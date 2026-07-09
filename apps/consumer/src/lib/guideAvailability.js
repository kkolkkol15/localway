const DAY_MS = 24 * 60 * 60 * 1000;

function toUtcDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  if (!match) throw new Error('Date must use YYYY-MM-DD format.');
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function formatUtcDate(date) {
  return date.toISOString().slice(0, 10);
}

export function expandDateRange(startDate, endDate = startDate) {
  const start = toUtcDate(startDate);
  const end = toUtcDate(endDate || startDate);
  const first = start <= end ? start : end;
  const last = start <= end ? end : start;
  const dates = [];

  for (let time = first.getTime(); time <= last.getTime(); time += DAY_MS) {
    dates.push(formatUtcDate(new Date(time)));
  }

  return dates;
}

export function uniqueSortedDates(dates) {
  return [...new Set((dates || []).filter(Boolean))].sort();
}

export function getCalendarUnavailableSelection({ startDate, endDate }, selectedDate) {
  if (!startDate || !endDate || startDate !== endDate) {
    return { startDate: selectedDate, endDate: selectedDate };
  }

  return { startDate, endDate: selectedDate };
}

export function buildUnavailableDateRows({ guideProfileId, userId, dates }) {
  return uniqueSortedDates(dates).map((date) => ({
    guide_id: guideProfileId,
    created_by: userId,
    unavailable_date: date
  }));
}

export async function resolveGuideProfileId(client, { guideProfileId, userId }) {
  if (guideProfileId) return guideProfileId;
  if (!userId) throw new Error('A user id is required to save unavailable dates.');

  const { data, error } = await client
    .from('guide_profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data?.id) throw new Error('No active guide profile was found for this user.');
  return data.id;
}

export async function saveGuideUnavailableDates(client, { guideProfileId, userId, dates }) {
  const resolvedGuideProfileId = await resolveGuideProfileId(client, { guideProfileId, userId });
  const rows = buildUnavailableDateRows({ guideProfileId: resolvedGuideProfileId, userId, dates });
  if (!rows.length) return { guideProfileId: resolvedGuideProfileId, count: 0 };

  const { error } = await client
    .from('guide_unavailable_dates')
    .upsert(rows, { onConflict: 'guide_id,unavailable_date', ignoreDuplicates: true });

  if (error) throw error;
  return { guideProfileId: resolvedGuideProfileId, count: rows.length };
}
