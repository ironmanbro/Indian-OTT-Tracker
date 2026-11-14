// Which of the user's subscriptions / free platforms cover a movie.

/** Access info for one movie given the set of active subscriptions. Pure → memoizable. */
export function getAccess(movie, subs) {
  const included = movie.platforms.flatrate.filter((p) => subs.has(p));
  // A free listing on a platform you also subscribe to counts as "free" too
  const free = movie.platforms.free;
  return {
    included,
    free,
    isIncluded: included.length > 0,
    isFree: free.length > 0,
    // green star = on my sub OR free
    accessible: included.length > 0 || free.length > 0,
    requires: movie.platforms.flatrate.filter((p) => !subs.has(p)),
  };
}
