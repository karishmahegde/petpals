const { reserveDailyCall, resetDailyCap } = require("../../../services/ai/dailyCap");
const { AI_DAILY_CALL_LIMIT } = require("../../../config/aiUsage");
const { AI_ERROR_REASONS } = require("../../../services/ai");

const at = (iso) => new Date(iso);

beforeEach(() => {
  resetDailyCap();
});

test("allows AI_DAILY_CALL_LIMIT calls in a UTC day, then throws a DAILY_LIMIT AI error", () => {
  const noon = at("2026-10-25T12:00:00Z");
  for (let i = 0; i < AI_DAILY_CALL_LIMIT; i += 1) {
    expect(() => reserveDailyCall(noon)).not.toThrow();
  }
  expect(() => reserveDailyCall(noon)).toThrow(
    expect.objectContaining({ reason: AI_ERROR_REASONS.DAILY_LIMIT }),
  );
});

test("the count starts again at the next UTC day", () => {
  const lateNight = at("2026-10-25T23:59:00Z");
  for (let i = 0; i < AI_DAILY_CALL_LIMIT; i += 1) reserveDailyCall(lateNight);
  expect(() => reserveDailyCall(lateNight)).toThrow();

  expect(() => reserveDailyCall(at("2026-10-26T00:00:30Z"))).not.toThrow();
});
