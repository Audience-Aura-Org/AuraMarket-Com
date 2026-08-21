/**
 * utils/pagination.js
 * Auradime — Consistent pagination helper for Mongoose queries.
 *
 * Usage:
 *   const { limit, skip, page } = parsePagination(req.query);
 *   const docs = await Product.find(filter).skip(skip).limit(limit).lean();
 *   res.json({ data: docs, pagination: { page, limit, total } });
 *
 * Or with a query object:
 *   const docs = await applyLimit(Product.find(filter), req.query).lean();
 */

const DEFAULT_LIMIT = 50;
const MAX_LIMIT     = 200;

/**
 * Parse pagination parameters from a query object.
 * @param {object} query - req.query
 * @param {object} [opts]
 * @param {number} [opts.def=50]  - Default page size
 * @param {number} [opts.max=200] - Hard maximum page size
 * @returns {{ page: number, limit: number, skip: number }}
 */
const parsePagination = (query = {}, { def = DEFAULT_LIMIT, max = MAX_LIMIT } = {}) => {
  const page  = Math.max(1, parseInt(query.page,  10) || 1);
  const limit = Math.min(max, Math.max(1, parseInt(query.limit, 10) || def));
  const skip  = (page - 1) * limit;
  return { page, limit, skip };
};

/**
 * Apply .skip() and .limit() to an existing Mongoose query.
 * @param {import('mongoose').Query} mongooseQuery
 * @param {object} reqQuery - req.query
 * @param {object} [opts]
 * @returns {import('mongoose').Query} The same query, chainable
 */
const applyLimit = (mongooseQuery, reqQuery = {}, opts = {}) => {
  const { limit, skip } = parsePagination(reqQuery, opts);
  return mongooseQuery.skip(skip).limit(limit);
};

/**
 * Build a pagination metadata object to include in API responses.
 * @param {{ page, limit, total }} params
 * @returns {{ page, limit, total, totalPages, hasNextPage, hasPrevPage }}
 */
const buildPaginationMeta = ({ page, limit, total }) => ({
  page,
  limit,
  total,
  totalPages:  Math.ceil(total / limit),
  hasNextPage: page * limit < total,
  hasPrevPage: page > 1,
});

module.exports = { parsePagination, applyLimit, buildPaginationMeta };
