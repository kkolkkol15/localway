import test from 'node:test';
import assert from 'node:assert/strict';
import {
  agreementSections,
  buildGuideInfoDetails,
  clampHourlyPrice,
  formatHourlyPrice,
  getPricingMode,
  hourlyPriceRange,
  majorCurrencyOptions,
  pricingModes,
  tourOptionGroups
} from '../lib/tourCreateForm.js';

test('tour option labels avoid abbreviations and define interpreter device correctly', () => {
  const labels = tourOptionGroups.map((option) => option.label);

  assert.equal(labels.includes('Restaurant recs'), false);
  assert.equal(labels.includes('Cafe recs'), false);
  assert.equal(labels.includes('Interpreter'), false);
  assert.equal(labels.includes('Interpreter device'), true);
});

test('non-priced tour options do not accept optional prices', () => {
  const freeCancellation = tourOptionGroups.find((option) => option.id === 'freeCancellation');
  const petFriendly = tourOptionGroups.find((option) => option.id === 'petFriendly');

  assert.equal(freeCancellation.allowsPrice, false);
  assert.equal(petFriendly.allowsPrice, false);
});

test('pricing modes use one active price field at a time', () => {
  assert.deepEqual(pricingModes.map((mode) => mode.fieldName), ['hourlyPrice', 'packagePrice']);
  assert.equal(getPricingMode('pay_as_you_go').priceLabel, 'Hourly price');
  assert.equal(getPricingMode('package').priceLabel, 'Product price');
});

test('hourly price range clamps to one dollar through one hundred plus', () => {
  assert.deepEqual(hourlyPriceRange, { min: 1, max: 100, defaultValue: 25 });
  assert.equal(clampHourlyPrice(0), 1);
  assert.equal(clampHourlyPrice('45'), 45);
  assert.equal(clampHourlyPrice(150), 100);
  assert.equal(clampHourlyPrice(''), 1);
  assert.equal(formatHourlyPrice(99), '$99');
  assert.equal(formatHourlyPrice(100), '$100+');
});

test('major currency options default to USD and stay concise', () => {
  assert.equal(majorCurrencyOptions[0].code, 'USD');
  assert.ok(majorCurrencyOptions.length <= 10);
});

test('agreement sections provide scrollable policy placeholders with explicit consent text', () => {
  assert.deepEqual(agreementSections.map((section) => section.title), [
    'Platform commission',
    'Liability waiver',
    'Refund policy'
  ]);
  assert.ok(agreementSections.every((section) => section.effectiveDate));
  assert.ok(agreementSections.every((section) => section.placeholderText.length > 80));
  assert.deepEqual(agreementSections.map((section) => section.consentText), [
    'I agree to the platform commission terms.',
    'I agree to the liability waiver.',
    'I agree to the refund policy.'
  ]);
});

test('guide info details expose readable saved guide profile fields without birthday', () => {
  const details = buildGuideInfoDetails({
    age: '',
    birthYear: '1990',
    birthMonth: '07',
    birthDay: '06',
    gender: 'Female',
    nativeLanguage: 'Korean',
    additionalLanguages: ['English', 'Japanese'],
    intro: 'I guide slow food walks.',
    nationality: 'Korea'
  }, new Date('2026-07-06T12:00:00Z'));

  assert.deepEqual(details.map((detail) => detail.label), [
    'Age',
    'Gender',
    'Nationality',
    'Native language',
    'Additional languages',
    'Guide introduction'
  ]);
  assert.equal(details.find((detail) => detail.label === 'Age').value, '36');
  assert.equal(details.find((detail) => detail.label === 'Additional languages').value, 'English, Japanese');
  assert.equal(details.some((detail) => /1990|07|06/.test(detail.value)), false);
});
