import { revalidateTag, unstable_cache } from "next/cache";
import * as q from "./public-queries";

// Cached wrappers for pages. The pages are `force-dynamic` (the Docker build
// has no database, so nothing may be prerendered from empty fallbacks); these
// short caches keep repeat traffic off Postgres, and anything that changes
// what customers see calls `revalidateMarketplace()` to bust them immediately.
// The wrapped functions THROW on failure, so errors are never cached.

export const MARKETPLACE_TAG = "marketplace";
const opts = { revalidate: 60, tags: [MARKETPLACE_TAG] };

export const getPublished = unstable_cache(q.queryPublished, ["pub-listings"], opts);
export const getFeatured = unstable_cache(q.queryFeatured, ["pub-featured"], opts);
export const getCategories = unstable_cache(q.queryCategories, ["pub-categories"], opts);
export const getListingDetail = unstable_cache(q.queryListingDetail, ["pub-listing"], opts);
export const getCompanyPage = unstable_cache(q.queryCompanyPage, ["pub-company"], opts);
export const getRegionBySlug = unstable_cache(q.queryRegionBySlug, ["pub-region"], { revalidate: 3600, tags: [MARKETPLACE_TAG] });
export const getTodayBoard = unstable_cache(q.queryTodayBoard, ["pub-today-board"], { revalidate: 30, tags: [MARKETPLACE_TAG] });

/** Call after anything that changes what's publicly visible (publish, edit, pause, approve, suspend, bookings). */
export function revalidateMarketplace() {
  revalidateTag(MARKETPLACE_TAG);
}
