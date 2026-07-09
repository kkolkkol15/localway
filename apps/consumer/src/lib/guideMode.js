export function getGuideModeOverview({ bookings = [], drafts = [], unavailableDates = [], reviewsWritten = [] } = {}) {
  const completedBookings = bookings.filter((booking) => booking.status === 'completed');
  const reservedBookings = bookings.filter((booking) => booking.status !== 'completed');
  const estimatedEarnings = completedBookings.reduce((sum, booking) => sum + Number(booking.amount || 0), 0);

  return {
    upcomingTrips: reservedBookings.length,
    savedDrafts: drafts.length,
    unavailableDates: unavailableDates.length,
    reviews: reviewsWritten.length,
    estimatedEarnings
  };
}

export function getGuideModeSections() {
  return [
    { id: 'my-tours', label: 'My Tours', description: 'Published tours, visibility, edits' },
    { id: 'create-tour', label: 'Create New Tour', description: 'Build a new local experience' },
    { id: 'saved-drafts', label: 'Saved Drafts', description: 'Continue unfinished tours' },
    { id: 'calendar', label: 'Calendar & Availability', description: 'Unavailable dates and schedule' },
    { id: 'booking-requests', label: 'Booking Requests', description: 'Approve, decline, and prepare' },
    { id: 'messages', label: 'Messages', description: 'Traveler conversations' },
    { id: 'reviews', label: 'Reviews', description: 'Guest reviews and replies' },
    { id: 'earnings', label: 'Earnings', description: 'Monthly, pending, completed' },
    { id: 'payments-payouts', label: 'Payments & Payouts', description: 'Payout method, history, service fee' },
    { id: 'guide-profile', label: 'Guide Profile', description: 'Public guide information' },
    { id: 'performance', label: 'Performance', description: 'Views, conversion, response rate' },
    { id: 'policy-center', label: 'Policy Center', description: 'Commission, safety, refund policy' },
    { id: 'support', label: 'Support', description: 'Guide support and disputes' },
    { id: 'donation', label: 'Donation', description: 'Giving settings and records' }
  ];
}
