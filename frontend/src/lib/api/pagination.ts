/**
 * The most rows a list endpoint sends per page (`per_page`): staging refuses
 * more ("The per page field must not be greater than 100.", 2026-10-20). A
 * list read whole — page 1, then the rest at once — asks for this many, so it
 * takes a handful of requests, not one per 15 rows. A screen paged by the
 * server (Organizations, Users, Audit log) keeps the server's 15.
 */
export const MAX_PER_PAGE = 100
