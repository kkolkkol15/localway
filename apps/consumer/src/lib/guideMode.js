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
