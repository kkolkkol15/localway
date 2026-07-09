function cleanFileName(name = 'file') {
  return name.replace(/[^a-zA-Z0-9._-]/g, '-');
}

function buildBirthDate(payload) {
  if (!payload.birthYear || !payload.birthMonth || !payload.birthDay) {
    throw new Error('Date of birth is required.');
  }
  return `${payload.birthYear}-${payload.birthMonth}-${payload.birthDay}`;
}

async function uploadGuideVerificationFile(client, { userId, file, kind }) {
  if (!file || !file.size) throw new Error(`${kind} file is required.`);
  const path = `${userId}/${kind}-${Date.now()}-${cleanFileName(file.name)}`;
  const { error } = await client.storage
    .from('guide-verification')
    .upload(path, file, { upsert: true });

  if (error) throw error;
  return path;
}

export function buildGuideApplicationRow(payload, { userId, realName, profileImagePath, idDocumentImagePath }) {
  return {
    user_id: userId,
    real_name: realName,
    nationality: payload.nationality,
    birth_date: buildBirthDate(payload),
    gender: payload.gender,
    city: payload.city,
    residence_years: Number(payload.years || 0),
    native_language: payload.nativeLanguage,
    additional_languages: payload.additionalLanguages || [],
    intro: payload.intro,
    profile_image_path: profileImagePath,
    id_document_image_path: idDocumentImagePath,
    status: 'pending'
  };
}

export async function submitGuideApplication(client, { payload, formElement, user }) {
  if (!user?.id) throw new Error('You must be logged in to submit a guide application.');

  const form = new FormData(formElement);
  const profileImagePath = await uploadGuideVerificationFile(client, {
    userId: user.id,
    file: form.get('profilePhoto'),
    kind: 'profile'
  });
  const idDocumentImagePath = await uploadGuideVerificationFile(client, {
    userId: user.id,
    file: form.get('idDocumentImage'),
    kind: 'id-document'
  });

  const row = buildGuideApplicationRow(payload, {
    userId: user.id,
    realName: user.name || user.email || 'Guide applicant',
    profileImagePath,
    idDocumentImagePath
  });

  const { data, error } = await client
    .from('guide_applications')
    .insert(row)
    .select()
    .single();

  if (error) throw error;
  return data;
}
