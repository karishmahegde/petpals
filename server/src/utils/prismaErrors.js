// Detects a unique-constraint violation from either the Prisma error code
// (P2002) or the raw PostgreSQL SQLSTATE (23505). The raw code can surface when
// the violated constraint is not represented in the Prisma schema — e.g. a
// partial unique index added through the manual Supabase-SQL workaround.
const isUniqueViolation = (err) =>
  err && (err.code === "P2002" || err.code === "23505");

module.exports = { isUniqueViolation };
