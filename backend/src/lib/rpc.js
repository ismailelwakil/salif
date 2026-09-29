/**
 * سلف — typed wrappers for the Postgres RPCs in supabase/migrations.
 * The API server calls these with the service key. Error messages raised by
 * the functions are prefixed SALIF:<CODE>.
 */
'use strict';

const RPC_ERRORS = {
  UNAUTHORIZED: [401, 'UNAUTHORIZED', 'Sign in first.'],
  INVALID_DATES: [400, 'VALIDATION_ERROR', 'Pick a valid date range.'],
  NOT_FOUND: [404, 'NOT_FOUND', 'Listing not found.'],
  NOT_ACTIVE: [409, 'CONFLICT', 'This listing is not available.'],
  OWN_LISTING: [403, 'FORBIDDEN', 'You cannot book your own listing.'],
  DATE_CONFLICT: [409, 'CONFLICT', 'Those dates overlap with an existing booking.'],
};

function mapRpcError(body) {
  const text = typeof body === 'string' ? body : JSON.stringify(body || {});
  const m = text.match(/SALIF:([A-Z_]+)/);
  if (!m || !RPC_ERRORS[m[1]]) return null;
  const [status, code, message] = RPC_ERRORS[m[1]];
  return { status, code, message };
}

function createBooking(supaFetch, { listingId, requesterId, start, end, message }) {
  return supaFetch('/rest/v1/rpc/create_booking', {
    method: 'POST',
    service: true,
    body: {
      p_listing: listingId,
      p_start: start,
      p_end: end,
      p_message: message || '',
      p_requester: requesterId,
    },
  });
}

function toggleFavorite(supaFetch, { listingId, userId, remove }) {
  return supaFetch('/rest/v1/rpc/toggle_favorite', {
    method: 'POST',
    service: true,
    body: { p_listing: listingId, p_remove: !!remove, p_user: userId },
  });
}

function searchListings(supaFetch, { q, type, category, location, sort, limit }) {
  return supaFetch('/rest/v1/rpc/search_listings', {
    method: 'POST',
    service: true,
    body: {
      p_q: q || null,
      p_type: type || null,
      p_category: category || null,
      p_location: location || null,
      p_sort: sort || 'newest',
      p_limit: Number(limit) || 50,
    },
  });
}

function availableListings(supaFetch, { start, end, category, location, userId, limit }) {
  return supaFetch('/rest/v1/rpc/available_listings', {
    method: 'POST',
    service: true,
    body: {
      p_start: start,
      p_end: end,
      p_category: category || null,
      p_location: location || null,
      p_for_user: userId || null,
      p_limit: Number(limit) || 50,
    },
  });
}

module.exports = {
  mapRpcError,
  createBooking,
  toggleFavorite,
  searchListings,
  availableListings,
};
