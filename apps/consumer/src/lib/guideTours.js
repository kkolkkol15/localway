export function buildTourRow(payload, { guideProfileId, fallbackCity = '' }) {
  if (!guideProfileId) throw new Error('A guide profile id is required to publish a tour.');

  const paymentType = payload.paymentType || 'pay_as_you_go';
  const priceAmount = paymentType === 'package'
    ? Number(payload.packagePrice || 0)
    : Number(payload.hourlyPrice || 0);

  return {
    guide_id: guideProfileId,
    city: payload.city || fallbackCity,
    title: payload.title,
    type: payload.type || payload.typeValue,
    description: payload.description || payload.contentHtml || '',
    price_amount: priceAmount,
    currency: payload.currency || 'USD',
    payment_type: paymentType,
    duration_minutes: Number(payload.durationMinutes || 60),
    max_people: Number(payload.maxPeople || 1),
    status: 'pending'
  };
}

export async function publishGuideTour(client, { payload, guideProfileId, fallbackCity }) {
  const row = buildTourRow(payload, { guideProfileId, fallbackCity });
  const { data, error } = await client
    .from('tours')
    .insert(row)
    .select()
    .single();

  if (error) throw error;
  return data;
}
