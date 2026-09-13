const prisma = require("../../config/prisma");

// Reshapes a Prisma groupBy() result — [{ <field>: value, _count: n }, ...] —
// into a plain { value: n } map, summing the group counts into `total` along
// the way (cheaper than a separate .count() query for the same where clause).
const toCountMap = (rows, field) => {
  const byStatus = {};
  let total = 0;
  for (const row of rows) {
    byStatus[row[field]] = row._count;
    total += row._count;
  }
  return { total, byStatus };
};

// ——————————————— OVERVIEW (GET /analytics/overview) ———————————————
// Four groupBy queries — one per entity, each a single aggregate query — no
// per-shelter or per-pet loop, so this stays O(1) queries regardless of how
// many shelters/pets/adopters/applications exist.
const getOverview = async () => {
  const [shelterGroups, petGroups, adopterGroups, applicationGroups] =
    await Promise.all([
      prisma.shelter.groupBy({ by: ["shelterStatus"], _count: true }),
      prisma.pet.groupBy({ by: ["adoptionStatus"], _count: true }),
      prisma.adopter.groupBy({ by: ["accountStatus"], _count: true }),
      prisma.adoptionApplication.groupBy({
        by: ["applicationStatus"],
        _count: true,
      }),
    ]);

  const shelters = toCountMap(shelterGroups, "shelterStatus");
  const pets = toCountMap(petGroups, "adoptionStatus");
  const adopters = toCountMap(adopterGroups, "accountStatus");
  const applications = toCountMap(applicationGroups, "applicationStatus");

  // 0-1 fraction rounded to 2dp, not a percentage — null (not 0) when there
  // are no applications yet, since a 0% rate would misleadingly imply every
  // application was rejected rather than none having been submitted.
  const accepted = applications.byStatus.Accepted ?? 0;
  const adoptionRate =
    applications.total === 0
      ? null
      : Math.round((accepted / applications.total) * 100) / 100;

  return {
    shelters,
    pets,
    adopters,
    applications: { ...applications, adoptionRate },
  };
};

// ——————————————— SHELTER BREAKDOWN (GET /analytics/shelters) ———————————————
// Three queries total, not one per shelter: the shelter list itself, pet
// counts grouped by [shelterID, adoptionStatus], and open (Pending)
// application counts grouped by shelterID — merged together in JS below.
const getShelterBreakdown = async (sortBy) => {
  const [shelters, petGroups, openApplicationGroups] = await Promise.all([
    prisma.shelter.findMany({
      select: { shelterID: true, shelterName: true, shelterSize: true },
      orderBy: { shelterName: "asc" },
    }),
    prisma.pet.groupBy({ by: ["shelterID", "adoptionStatus"], _count: true }),
    prisma.adoptionApplication.groupBy({
      by: ["shelterID"],
      where: { applicationStatus: "Pending" },
      _count: true,
    }),
  ]);

  const petsByShelter = new Map(); // shelterID -> { total, byStatus }
  for (const row of petGroups) {
    let entry = petsByShelter.get(row.shelterID);
    if (!entry) {
      entry = { total: 0, byStatus: {} };
      petsByShelter.set(row.shelterID, entry);
    }
    entry.byStatus[row.adoptionStatus] = row._count;
    entry.total += row._count;
  }

  const openApplicationsByShelter = new Map(
    openApplicationGroups.map((row) => [row.shelterID, row._count]),
  );

  const breakdown = shelters.map((shelter) => {
    const pets = petsByShelter.get(shelter.shelterID) ?? {
      total: 0,
      byStatus: {},
    };
    const openApplicationCount =
      openApplicationsByShelter.get(shelter.shelterID) ?? 0;
    // Percentage (not a 0-1 fraction, unlike adoptionRate above) — "utilization
    // %" in the spec. null, not 0 or Infinity, for a 0-capacity shelter.
    const utilization =
      shelter.shelterSize > 0
        ? Math.round((pets.total / shelter.shelterSize) * 100 * 100) / 100
        : null;

    return {
      shelterID: shelter.shelterID,
      shelterName: shelter.shelterName,
      shelterSize: shelter.shelterSize,
      petCount: pets.total,
      petsByStatus: pets.byStatus,
      openApplicationCount,
      utilization,
    };
  });

  // Already in shelterName order from the query above — only re-sort when a
  // ranking was explicitly requested. Both rankings put the highest value
  // first (most crowded / most pets), which is what capacity planning cares
  // about; shelters with no computable utilization sort last.
  if (sortBy === "utilization") {
    breakdown.sort((a, b) => (b.utilization ?? -1) - (a.utilization ?? -1));
  } else if (sortBy === "petCount") {
    breakdown.sort((a, b) => b.petCount - a.petCount);
  }

  return breakdown;
};

module.exports = { getOverview, getShelterBreakdown };
