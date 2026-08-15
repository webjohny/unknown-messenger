/**
 * Deliberately its own module with no `'use client'`: a value imported from a
 * client module into a server component arrives as a client reference, not as
 * the string, and `cookies().get()` then silently finds nothing.
 */
export const SKIN_COOKIE = 'messenger.skin';

export const SKIN_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
