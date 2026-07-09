const img = (seed, w = 900, h = 620) => `https://picsum.photos/seed/local-way-${seed}/${w}/${h}`;

export const cities = ['Tokyo', 'Paris', 'Seoul', 'New York', 'Bangkok', 'Rome', 'Busan', 'Jeju'];

export const languages = ['Korean', 'English', 'Japanese', 'Chinese', 'Thai', 'Spanish', 'French'];

export const tourTypes = [
  'Outdoor',
  'Alley Local Tour',
  'Suburb Local Tour',
  'Food Tour',
  'Local Craft Experience',
  'House Tour',
  "Guide's Choice Tour"
];

export const transports = ['Walk', 'Bicycle', 'Public transport', '2-seat motorcycle', 'Car', '4+ seat vehicle'];

export const tours = [
  {
    id: 'tour-tokyo-1',
    city: 'Tokyo',
    title: 'Tokyo alley izakaya night walk',
    type: 'Food Tour',
    description: 'Slip through lantern alleys with a guide who knows tiny counters and local stories.',
    price: 68,
    rating: 4.92,
    reviews: 128,
    image: img('tokyo-night'),
    gallery: [img('tokyo-night-a'), img('tokyo-night-b'), img('tokyo-night-c')],
    guide: { id: 'guide-aiko', name: 'Aiko', avatar: img('aiko', 120, 120), years: 18, languages: ['Japanese', 'English'], city: 'Tokyo', nationality: 'Japan', gender: 'Female' },
    options: { pickup: true, interpreter: true, restaurant: true, cafe: true, cancellation: true, pet: false },
    transport: ['Walk', 'Public transport'],
    paymentType: 'Package Price',
    reviewsList: [{ id: 'r1', author: 'Mina', rating: 5, text: 'Warm, precise, and delicious from start to finish.' }]
  },
  {
    id: 'tour-seoul-1',
    city: 'Seoul',
    title: 'Bukchon, palace tea and hidden alleys',
    type: 'Alley Local Tour',
    description: 'A calm walking route through palaces, hanok lanes, and a tea room locals actually use.',
    price: 52,
    rating: 4.88,
    reviews: 94,
    image: img('seoul-hanok'),
    gallery: [img('seoul-a'), img('seoul-b'), img('seoul-c')],
    guide: { id: 'guide-minji', name: 'Minji', avatar: img('minji', 120, 120), years: 12, languages: ['Korean', 'English'], city: 'Seoul', nationality: 'Korea', gender: 'Female' },
    options: { pickup: false, interpreter: true, restaurant: true, cafe: true, cancellation: true, pet: true },
    transport: ['Walk'],
    paymentType: 'Package Price',
    reviewsList: []
  },
  {
    id: 'tour-paris-1',
    city: 'Paris',
    title: 'Montmartre bakeries before the crowds',
    type: 'Food Tour',
    description: 'Croissants, steep lanes, and family bakeries before the tour buses arrive.',
    price: 74,
    rating: 4.81,
    reviews: 76,
    image: img('paris-bakery'),
    gallery: [img('paris-a'), img('paris-b'), img('paris-c')],
    guide: { id: 'guide-claire', name: 'Claire', avatar: img('claire', 120, 120), years: 20, languages: ['French', 'English'], city: 'Paris', nationality: 'France', gender: 'Female' },
    options: { pickup: false, interpreter: false, restaurant: true, cafe: true, cancellation: false, pet: false },
    transport: ['Walk', 'Public transport'],
    paymentType: 'Pay as you go',
    reviewsList: [{ id: 'r2', author: 'Noah', rating: 5, text: 'Exactly the kind of morning we hoped for.' }]
  },
  {
    id: 'tour-bangkok-1',
    city: 'Bangkok',
    title: 'Canal markets and temple edges',
    type: 'Outdoor',
    description: 'A flexible route through canals, snacks, and quiet temple corners.',
    price: 45,
    rating: 4.77,
    reviews: 61,
    image: img('bangkok-canal'),
    gallery: [img('bangkok-a'), img('bangkok-b'), img('bangkok-c')],
    guide: { id: 'guide-nok', name: 'Nok', avatar: img('nok', 120, 120), years: 16, languages: ['Thai', 'English'], city: 'Bangkok', nationality: 'Thailand', gender: 'Female' },
    options: { pickup: true, interpreter: false, restaurant: true, cafe: false, cancellation: true, pet: false },
    transport: ['Public transport', 'Car'],
    paymentType: 'Package Price',
    reviewsList: [{ id: 'r3', author: 'Jules', rating: 4, text: 'Easy, kind, and full of little surprises.' }]
  },
  {
    id: 'tour-rome-1',
    city: 'Rome',
    title: 'Roman courtyards and espresso stops',
    type: "Guide's Choice Tour",
    description: 'Backstreet churches, courtyards, and coffee counters between major sights.',
    price: 59,
    rating: 4.69,
    reviews: 38,
    image: img('rome-courtyard'),
    gallery: [img('rome-a'), img('rome-b'), img('rome-c')],
    guide: { id: 'guide-luca', name: 'Luca', avatar: img('luca', 120, 120), years: 9, languages: ['English', 'Spanish'], city: 'Rome', nationality: 'Italy', gender: 'Male' },
    options: { pickup: false, interpreter: true, restaurant: true, cafe: true, cancellation: true, pet: true },
    transport: ['Walk', 'Bicycle'],
    paymentType: 'Pay as you go',
    reviewsList: []
  }
];

export const alerts = [
  { id: 'n1', title: 'Booking confirmed', text: 'Seoul alley walk is reserved.', time: 'Just now', type: 'booking' },
  { id: 'n2', title: 'New message', text: 'Minji sent meeting details.', time: '12m ago', type: 'message' },
  { id: 'n3', title: 'Guide tips updated', text: 'Review the latest application checklist.', time: 'Today', type: 'guide' }
];

export const faqs = [
  { q: 'Can I cancel a booking?', a: 'Yes. Mock cancellation rules are shown before payment.' },
  { q: 'How are guides approved?', a: 'Profiles are reviewed by the Local Way admin team in this simulation.' },
  { q: 'Can I message before booking?', a: 'Messaging opens after a mock booking is completed.' }
];
