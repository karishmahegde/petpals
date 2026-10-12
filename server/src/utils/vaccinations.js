// The overdue-vaccination rule, shared by the vet Overview
// (vet/overview.service.js) and the health-passport summary
// (staff/healthPassportSummary.service.js) so they can't drift.

const DAY_MS = 24 * 60 * 60 * 1000;

// Pets that are still the shelter's to look after — an adopted pet's
// boosters are its adopter's vet's business, and a deceased one has none.
const INACTIVE_PET_STATUSES = ["adopted", "deceased"];

// For each pet and vaccine, only the LATEST dose counts: it's overdue when its
// next-due date has passed. A latest dose with no due date (no further dose
// planned) is never overdue, and an older dose whose booster was since given
// isn't either. `doses` need petID, vaccineID, administeredDate and dueDate.
// Returns { dose, doseNumber, daysOverdue } — doseNumber is the dose now due
// (doses given + 1) — most overdue first.
const overdueLatestDoses = (doses, now = new Date()) => {
  const sorted = [...doses].sort(
    (a, b) => new Date(a.administeredDate) - new Date(b.administeredDate),
  );
  // Ascending by administeredDate, so the last one per pet+vaccine wins.
  const latest = new Map();
  const counts = new Map();
  for (const dose of sorted) {
    const key = `${dose.petID}:${dose.vaccineID}`;
    latest.set(key, dose);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const nowMs = now.getTime();
  return [...latest.entries()]
    .filter(([, dose]) => dose.dueDate && new Date(dose.dueDate).getTime() < nowMs)
    .map(([key, dose]) => ({
      dose,
      doseNumber: counts.get(key) + 1,
      daysOverdue: Math.floor((nowMs - new Date(dose.dueDate).getTime()) / DAY_MS),
    }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue);
};

module.exports = { INACTIVE_PET_STATUSES, overdueLatestDoses };
