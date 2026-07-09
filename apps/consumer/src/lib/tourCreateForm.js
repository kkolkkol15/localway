export const majorCurrencyOptions = [
  { code: 'USD', label: 'USD - US dollar' },
  { code: 'KRW', label: 'KRW - Korean won' },
  { code: 'EUR', label: 'EUR - Euro' },
  { code: 'JPY', label: 'JPY - Japanese yen' },
  { code: 'CNY', label: 'CNY - Chinese yuan' },
  { code: 'GBP', label: 'GBP - British pound' },
  { code: 'CAD', label: 'CAD - Canadian dollar' },
  { code: 'AUD', label: 'AUD - Australian dollar' },
  { code: 'SGD', label: 'SGD - Singapore dollar' }
];

export const tourOptionGroups = [
  { id: 'pickup', label: 'Pickup', description: 'Meet travelers at a selected location.', allowsPrice: true },
  { id: 'interpreterDevice', label: 'Interpreter device', description: 'You own or can provide a translation device.', allowsPrice: true },
  { id: 'restaurantRecommendations', label: 'Restaurant recommendations', description: 'Curated local restaurant suggestions.', allowsPrice: true },
  { id: 'cafeRecommendations', label: 'Cafe recommendations', description: 'Curated local cafe suggestions.', allowsPrice: true },
  { id: 'freeCancellation', label: 'Free cancellation', description: 'Travelers can cancel within your free cancellation window.', allowsPrice: false },
  { id: 'petFriendly', label: 'Pet-friendly', description: 'This tour can accommodate travelers with pets.', allowsPrice: false }
];

export const pricingModes = [
  {
    id: 'pay_as_you_go',
    label: 'Pay as you go',
    priceLabel: 'Hourly price',
    fieldName: 'hourlyPrice',
    helper: 'Charged per hour.'
  },
  {
    id: 'package',
    label: 'Package price',
    priceLabel: 'Product price',
    fieldName: 'packagePrice',
    helper: 'Charged once for the whole tour product.'
  }
];

export const hourlyPriceRange = {
  min: 1,
  max: 100,
  defaultValue: 25
};

export const agreementSections = [
  {
    id: 'platformCommission',
    title: 'Platform commission',
    effectiveDate: 'To be added',
    placeholderText: 'Platform commission terms will be added here later. This area is reserved for the commission rate, settlement timing, payout method, fee calculation rules, tax notes, and any service fee exceptions that guides must review before publishing a tour.',
    consentText: 'I agree to the platform commission terms.'
  },
  {
    id: 'liabilityWaiver',
    title: 'Liability waiver',
    effectiveDate: 'To be added',
    placeholderText: 'Liability waiver terms will be added here later. This area is reserved for guide responsibilities, traveler safety expectations, emergency handling, insurance notices, prohibited activity disclaimers, and limits of platform responsibility.',
    consentText: 'I agree to the liability waiver.'
  },
  {
    id: 'refundPolicy',
    title: 'Refund policy',
    effectiveDate: 'To be added',
    placeholderText: 'Refund policy terms will be added here later. This area is reserved for cancellation windows, no-show handling, weather or emergency exceptions, partial refund rules, dispute review timing, and traveler communication requirements.',
    consentText: 'I agree to the refund policy.'
  }
];

export function getPricingMode(modeId) {
  return pricingModes.find((mode) => mode.id === modeId) ?? pricingModes[0];
}

export function clampHourlyPrice(value) {
  const numericValue = Number.parseInt(value, 10);
  if (Number.isNaN(numericValue)) return hourlyPriceRange.min;
  return Math.min(hourlyPriceRange.max, Math.max(hourlyPriceRange.min, numericValue));
}

export function formatHourlyPrice(value) {
  const clampedValue = clampHourlyPrice(value);
  return clampedValue >= hourlyPriceRange.max ? `$${hourlyPriceRange.max}+` : `$${clampedValue}`;
}

export function buildGuideInfoDetails(profile = {}, currentDate = new Date()) {
  const age = profile.age || calculateAge(profile, currentDate);
  const details = [
    ['Age', age],
    ['Gender', profile.gender],
    ['Nationality', profile.nationality],
    ['Native language', profile.nativeLanguage],
    ['Additional languages', Array.isArray(profile.additionalLanguages) ? profile.additionalLanguages.join(', ') : profile.additionalLanguages],
    ['Guide introduction', profile.intro]
  ];

  return details
    .map(([label, value]) => ({ label, value: String(value ?? '').trim() }))
    .filter((detail) => detail.value);
}

function calculateAge(profile, currentDate) {
  const year = Number.parseInt(profile.birthYear, 10);
  if (!year) return '';
  const month = Number.parseInt(profile.birthMonth || '1', 10);
  const day = Number.parseInt(profile.birthDay || '1', 10);
  const today = currentDate instanceof Date ? currentDate : new Date(currentDate);
  let age = today.getFullYear() - year;
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();
  if (currentMonth < month || (currentMonth === month && currentDay < day)) age -= 1;
  return age > 0 ? String(age) : '';
}
