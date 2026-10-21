// Every row an integration suite creates, recorded the moment it exists, and
// removed by one cleanUp() in afterAll. The suites run against the dev
// database, and on 2026-10-21 a cleanup that crashed part-way left shelters,
// species, pets and six test logins behind — so cleanUp() never assumes the
// setup finished, and runs each step on its own: a failed step is logged and
// the rest still run.
//
//   const data = trackTestData();
//   data.user(registerRes.body.data.userID);   // right after it's created
//   data.shelter(shelter.shelterID);
//   afterAll(async () => {
//     await data.cleanUp();
//     await prisma.$disconnect();
//   });
//
// Track the roots — users, shelters, species, breeds, pets, vaccines.
// Everything hanging off them (applications, visits, appointments and their
// doses and notes, transfers, tasks, events, donations, photos, favorites,
// government IDs, role rows) is found and removed with them, children first.
// Staff, vets and volunteers at a tracked shelter count as tracked users.
// Notifications, account tokens, quiz answers and cached matches cascade.
const prisma = require("../../../config/prisma");

const ints = (set) => [...set].filter(Number.isInteger);

const trackTestData = () => {
  const tracked = {
    users: new Set(),
    shelters: new Set(),
    species: new Set(),
    breeds: new Set(),
    pets: new Set(),
    vaccines: new Set(),
  };

  // Each recorder takes the ID (or undefined, when the create failed) and
  // returns it, so it can wrap the value inline.
  const recorder = (set) => (id) => {
    if (Number.isInteger(id)) set.add(id);
    return id;
  };

  const step = async (label, fn) => {
    try {
      await fn();
    } catch (err) {
      console.error(`[test cleanup] ${label} failed: ${err.message}`);
    }
  };

  const cleanUp = async () => {
    const S = ints(tracked.shelters);
    const SP = ints(tracked.species);

    // Work out the full set before deleting anything.
    let B = ints(tracked.breeds);
    let U = ints(tracked.users);
    let P = ints(tracked.pets);
    await step("finding the species' breeds", async () => {
      const rows = await prisma.breed.findMany({ where: { speciesID: { in: SP } }, select: { breedID: true } });
      B = [...new Set([...B, ...rows.map((r) => r.breedID)])];
    });
    await step("finding the shelters' people", async () => {
      const where = { shelterID: { in: S } };
      const select = { userID: true };
      const rows = (
        await Promise.all([
          prisma.staff.findMany({ where, select }),
          prisma.veterinarian.findMany({ where, select }),
          prisma.volunteer.findMany({ where, select }),
        ])
      ).flat();
      U = [...new Set([...U, ...rows.map((r) => r.userID)])];
    });
    await step("finding the pets", async () => {
      const rows = await prisma.pet.findMany({
        where: { OR: [{ shelterID: { in: S } }, { breedID: { in: B } }] },
        select: { petID: true },
      });
      P = [...new Set([...P, ...rows.map((r) => r.petID)])];
    });

    const byPetOrShelter = { OR: [{ petID: { in: P } }, { shelterID: { in: S } }] };

    // Appointments and what hangs off them.
    let A = [];
    await step("finding appointments", async () => {
      const rows = await prisma.appointment.findMany({
        where: {
          OR: [
            ...byPetOrShelter.OR,
            { vetID: { in: U } },
            { volunteerID: { in: U } },
            { staffID: { in: U } },
          ],
        },
        select: { appointmentID: true },
      });
      A = rows.map((r) => r.appointmentID);
    });
    await step("vaccination records", () =>
      prisma.vaccinationRecord.deleteMany({
        where: {
          OR: [
            { petID: { in: P } },
            { appointmentID: { in: A } },
            { administeredAt: { in: S } },
            { administeredBy: { in: U } },
            { vaccineID: { in: ints(tracked.vaccines) } },
          ],
        },
      }),
    );
    await step("health records", () =>
      prisma.healthRecord.deleteMany({
        where: { OR: [{ petID: { in: P } }, { appointmentID: { in: A } }, { vetID: { in: U } }] },
      }),
    );
    await step("appointments", () => prisma.appointment.deleteMany({ where: { appointmentID: { in: A } } }));

    await step("transfers", () =>
      prisma.transferHistory.deleteMany({
        where: {
          OR: [
            { petID: { in: P } },
            { fromShelterID: { in: S } },
            { toShelterID: { in: S } },
            { fromShelterStaff: { in: U } },
            { toShelterStaff: { in: U } },
          ],
        },
      }),
    );
    await step("pet photos", () => prisma.petPhoto.deleteMany({ where: { petID: { in: P } } }));
    await step("favorites", () =>
      prisma.favorite.deleteMany({ where: { OR: [{ petID: { in: P } }, { adopterID: { in: U } }] } }),
    );
    await step("visits", () =>
      prisma.visit.deleteMany({
        where: { OR: [...byPetOrShelter.OR, { adopterID: { in: U } }, { staffID: { in: U } }] },
      }),
    );
    await step("adoption applications", () =>
      prisma.adoptionApplication.deleteMany({
        where: { OR: [...byPetOrShelter.OR, { adopterID: { in: U } }, { staffID: { in: U } }] },
      }),
    );

    // Tasks, events and volunteer applications at the shelters or by the people.
    const byShelterOrStaff = { OR: [{ shelterID: { in: S } }, { staffID: { in: U } }] };
    await step("task assignments", () =>
      prisma.volunteerTask.deleteMany({
        where: { OR: [{ volunteerID: { in: U } }, { task: byShelterOrStaff }] },
      }),
    );
    await step("tasks", () => prisma.task.deleteMany({ where: byShelterOrStaff }));
    await step("event assignments", () =>
      prisma.volunteerEvent.deleteMany({
        where: { OR: [{ volunteerID: { in: U } }, { event: byShelterOrStaff }] },
      }),
    );
    await step("events", () => prisma.event.deleteMany({ where: byShelterOrStaff }));
    await step("volunteer applications", () =>
      prisma.volunteerApplication.deleteMany({
        where: { OR: [{ shelterID: { in: S } }, { staffID: { in: U } }, { volunteerID: { in: U } }] },
      }),
    );
    await step("donations", () =>
      prisma.donation.deleteMany({ where: { OR: [{ shelterID: { in: S } }, { donorID: { in: U } }] } }),
    );

    // Pets last among the children — matches and health summaries cascade.
    await step("pets kept elsewhere, unassigned from the test staff", () =>
      prisma.pet.updateMany({ where: { staffID: { in: U }, petID: { notIn: P } }, data: { staffID: null } }),
    );
    await step("pets", () => prisma.pet.deleteMany({ where: { petID: { in: P } } }));

    // People.
    await step("shelter managers", () =>
      prisma.shelter.updateMany({
        where: { OR: [{ shelterID: { in: S } }, { managerStaffID: { in: U } }] },
        data: { managerStaffID: null },
      }),
    );
    await step("adopters' preferred breeds", () =>
      prisma.adopter.updateMany({ where: { preferredBreedID: { in: B } }, data: { preferredBreedID: null } }),
    );
    await step("government IDs", () => prisma.governmentID.deleteMany({ where: { userID: { in: U } } }));
    for (const model of ["staff", "veterinarian", "volunteer", "adopter", "donor", "admin"]) {
      await step(`${model} rows`, () => prisma[model].deleteMany({ where: { userID: { in: U } } }));
    }
    await step("logins", () => prisma.users.deleteMany({ where: { userID: { in: U } } }));

    // Catalogue rows.
    await step("breeds", () => prisma.breed.deleteMany({ where: { breedID: { in: B } } }));
    await step("species", () => prisma.species.deleteMany({ where: { speciesID: { in: SP } } }));
    await step("vaccines", () => prisma.vaccine.deleteMany({ where: { vaccineID: { in: ints(tracked.vaccines) } } }));
    await step("shelters", () => prisma.shelter.deleteMany({ where: { shelterID: { in: S } } }));
  };

  return {
    user: recorder(tracked.users),
    shelter: recorder(tracked.shelters),
    species: recorder(tracked.species),
    breed: recorder(tracked.breeds),
    pet: recorder(tracked.pets),
    vaccine: recorder(tracked.vaccines),
    cleanUp,
  };
};

module.exports = { trackTestData };
