// A volunteer's weekly availability — days (Mon–Sun) × slots (Morning,
// Afternoon, Evening). The API speaks the structured form,
//   { Mon: ["Morning", "Afternoon"], Wed: ["Evening"] }
// and Volunteer.volunteerSchedule (VARCHAR(100)) stores it compactly,
//   "Mon:MA;Wed:E"
// in a canonical order (days Mon→Sun, slots M→A→E), so the same availability
// always encodes to the same string. Worst case, every slot of every day, is
// 55 characters.
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SLOTS = ["Morning", "Afternoon", "Evening"];
const SLOT_CODE = { Morning: "M", Afternoon: "A", Evening: "E" };

const badRequest = (message) => {
  const err = new Error(message);
  err.code = "BAD_REQUEST";
  return err;
};

// Validates the request body's `availability` and returns it in canonical
// form (known days only, each day's slots deduplicated and ordered; days
// with no slots dropped). Unknown days/slots and wrong types are 400 —
// availability is a closed set, validated strictly.
const parseAvailabilityInput = (value) => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw badRequest(
      "availability must be an object mapping days (Mon–Sun) to lists of slots (Morning, Afternoon, Evening)",
    );
  }

  const unknownDays = Object.keys(value).filter((day) => !DAYS.includes(day));
  if (unknownDays.length > 0) {
    throw badRequest(
      `Unknown day(s): ${unknownDays.join(", ")} — use ${DAYS.join(", ")}`,
    );
  }

  const availability = {};
  for (const day of DAYS) {
    if (!(day in value)) continue;
    const slots = value[day];
    if (!Array.isArray(slots)) {
      throw badRequest(`availability.${day} must be a list of slots`);
    }
    const unknownSlots = slots.filter((slot) => !SLOTS.includes(slot));
    if (unknownSlots.length > 0) {
      throw badRequest(
        `Unknown slot(s) for ${day}: ${unknownSlots.join(", ")} — use ${SLOTS.join(", ")}`,
      );
    }
    const ordered = SLOTS.filter((slot) => slots.includes(slot));
    if (ordered.length > 0) {
      availability[day] = ordered;
    }
  }
  return availability;
};

// Canonical availability → the stored string; no availability at all → null.
const encodeAvailability = (availability) => {
  const parts = DAYS.filter((day) => availability[day]?.length).map(
    (day) => `${day}:${availability[day].map((slot) => SLOT_CODE[slot]).join("")}`,
  );
  return parts.length > 0 ? parts.join(";") : null;
};

const STORED_PART = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun):([MAE]+)$/;

// The stored string → the structured form. Returns {} for no availability
// (null), and null for a value that isn't in the encoded format at all —
// free text from before availability was structured (e.g. "Weekends"),
// which callers still expose as the raw volunteerSchedule.
const decodeAvailability = (stored) => {
  if (stored === null || stored === undefined || stored === "") return {};

  const availability = {};
  for (const part of stored.split(";")) {
    const match = STORED_PART.exec(part);
    if (!match || availability[match[1]]) return null;
    const codes = match[2].split("");
    if (new Set(codes).size !== codes.length) return null;
    availability[match[1]] = SLOTS.filter((slot) =>
      codes.includes(SLOT_CODE[slot]),
    );
  }
  return availability;
};

module.exports = {
  DAYS,
  SLOTS,
  parseAvailabilityInput,
  encodeAvailability,
  decodeAvailability,
};
