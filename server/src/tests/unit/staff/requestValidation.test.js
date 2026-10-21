// Request checks on the staff review screens' endpoints — government IDs,
// donations and the manager's team (staff/governmentIds, donations and
// shelterStaff controllers): every malformed query or body answers 400
// without reaching the service, and a service error is passed on unchanged.
// The services are faked; their behaviour has its own suites.
const request = require("supertest");
const jwt = require("jsonwebtoken");

jest.mock("../../../services/auth/auth.service", () => ({
  ...jest.requireActual("../../../services/auth/auth.service"),
  getAccountStatus: jest.fn(),
}));
jest.mock("../../../services/staff/governmentIds.service");
jest.mock("../../../services/staff/donations.service");
jest.mock("../../../services/staff/shelterStaff.service");

const authService = require("../../../services/auth/auth.service");
const governmentIdsService = require("../../../services/staff/governmentIds.service");
const donationsService = require("../../../services/staff/donations.service");
const shelterStaffService = require("../../../services/staff/shelterStaff.service");
const app = require("../../../app");

const token = (role) =>
  jwt.sign({ userID: role === "Admin" ? 1 : 42, role }, process.env.JWT_SECRET, { expiresIn: "1h" });

const send = (method, path, role, body) => {
  const req = request(app)[method](`/api/v1${path}`).set("Authorization", `Bearer ${token(role)}`);
  return body === undefined ? req : req.send(body);
};

const allServiceFns = () =>
  [governmentIdsService, donationsService, shelterStaffService].flatMap((service) =>
    Object.values(service).filter((value) => jest.isMockFunction(value)),
  );

let consoleErrorSpy;

beforeEach(() => {
  jest.resetAllMocks();
  authService.getAccountStatus.mockResolvedValue("Active");
  consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
});

// [method, path, role, body, message]
const BAD_REQUESTS = [
  // Government IDs
  ["get", "/government-ids", "Staff", undefined, "section is required and must be one of: pending, reviewed"],
  ["get", "/government-ids?section=pending&userType=Wizard", "Staff", undefined, "userType must be one of: Adopter, Volunteer, Staff, Veterinarian, Admin"],
  ["get", "/government-ids?section=pending&page=0", "Staff", undefined, "page must be an integer >= 1"],
  ["get", "/government-ids?section=pending&limit=101", "Staff", undefined, "limit must be an integer between 1 and 100"],
  ["get", "/government-ids?section=pending&shelterID=abc", "Admin", undefined, "shelterID must be a positive integer"],
  ["get", "/government-ids/abc", "Staff", undefined, "id is required and must be a positive integer"],
  ["patch", "/government-ids/abc/status", "Staff", { verificationStatus: "Verified" }, "id is required and must be a positive integer"],
  ["patch", "/government-ids/5/status", "Staff", { verificationStatus: "Maybe" }, "verificationStatus is required and must be one of: Verified, Rejected"],
  // Donations
  ["get", "/donations?dateFrom=soon", "Staff", undefined, "dateFrom must be a valid date"],
  ["get", "/donations?dateTo=later", "Staff", undefined, "dateTo must be a valid date"],
  ["get", "/donations?shelterID=0", "Admin", undefined, "shelterID must be a positive integer"],
  ["get", "/donations?page=0", "Staff", undefined, "page must be an integer >= 1"],
  ["get", "/donations?limit=0", "Staff", undefined, "limit must be an integer between 1 and 100"],
  ["get", "/donations/stats", "Staff", undefined, "monthStart is required and must be a valid date"],
  ["get", "/donations/stats?monthStart=someday", "Staff", undefined, "monthStart must be a valid date"],
  ["get", "/donations/abc", "Staff", undefined, "id must be a positive integer"],
  // The manager's team
  ["get", "/staff/me/team", "Staff", undefined, "section is required and must be one of: all, pending"],
  ["get", "/staff/me/team?section=all&staffDesignation=Boss", "Staff", undefined, "staffDesignation must be one of: Manager, Senior, Associate"],
  ["get", "/staff/me/team?section=all&page=0", "Staff", undefined, "page must be an integer >= 1"],
  ["get", "/staff/me/team?section=all&limit=500", "Staff", undefined, "limit must be an integer between 1 and 100"],
  ["patch", "/staff/me/team/abc", "Staff", { staffDesignation: "Senior" }, "id must be a positive integer"],
  ["patch", "/staff/me/team/5", "Staff", {}, "staffDesignation is required"],
  ["patch", "/staff/me/team/abc/status", "Staff", { accountStatus: "Active" }, "id must be a positive integer"],
  ["patch", "/staff/me/team/5/status", "Staff", { accountStatus: "Banned" }, "accountStatus is required and must be one of: Active, Deactivated, Declined"],
];

test.each(BAD_REQUESTS)("%s %s (%s) %j → 400: %s", async (method, path, role, body, message) => {
  const res = await send(method, path, role, body);

  expect(res.status).toBe(400);
  expect(res.body).toMatchObject({ success: false, error: { code: "BAD_REQUEST" } });
  expect(res.body.message).toBe(message);
  for (const fn of allServiceFns()) expect(fn).not.toHaveBeenCalled();
});

// [method, path, role, body, service fn]
const SERVICE_CALLS = [
  ["get", "/government-ids?section=pending", "Staff", undefined, () => governmentIdsService.listGovernmentIds],
  ["get", "/government-ids/5", "Staff", undefined, () => governmentIdsService.getGovernmentIdDetail],
  ["patch", "/government-ids/5/status", "Staff", { verificationStatus: "Verified" }, () => governmentIdsService.updateGovernmentIdStatus],
  ["get", "/donations", "Staff", undefined, () => donationsService.listDonations],
  ["get", "/donations/stats?monthStart=2026-10-01", "Staff", undefined, () => donationsService.getDonationStats],
  ["get", "/donations/5", "Staff", undefined, () => donationsService.getDonationDetail],
  ["get", "/staff/me/team?section=all", "Staff", undefined, () => shelterStaffService.listShelterStaff],
  ["patch", "/staff/me/team/5", "Staff", { staffDesignation: "Senior" }, () => shelterStaffService.updateDesignation],
  ["patch", "/staff/me/team/5/status", "Staff", { accountStatus: "Active" }, () => shelterStaffService.updateStatus],
];

test.each(SERVICE_CALLS)("%s %s: a service error is passed on unchanged", async (method, path, role, body, fn) => {
  fn().mockRejectedValue(Object.assign(new Error("Not allowed here"), { code: "CONFLICT" }));

  const res = await send(method, path, role, body);

  expect(res.status).toBe(409);
  expect(res.body.message).toBe("Not allowed here");
});

describe("values reach the services parsed", () => {
  test("donations: dates as Dates, the donor name trimmed, an Admin's shelter as a number", async () => {
    donationsService.listDonations.mockResolvedValue({ data: [], pagination: {} });

    await send("get", "/donations?dateFrom=2026-10-01&donorName=%20Sam%20&shelterID=3&page=2&limit=5", "Admin");

    expect(donationsService.listDonations).toHaveBeenCalledWith(
      { role: "Admin", userID: 1 },
      { dateFrom: new Date("2026-10-01"), dateTo: undefined, donorName: "Sam", shelterID: 3, page: 2, limit: 5 },
    );
  });

  test("a Staff caller's shelterID is ignored (always their own shelter)", async () => {
    donationsService.listDonations.mockResolvedValue({ data: [], pagination: {} });
    governmentIdsService.listGovernmentIds.mockResolvedValue({ data: [], pagination: {} });

    await send("get", "/donations?shelterID=3", "Staff");
    await send("get", "/government-ids?section=pending&shelterID=3", "Staff");

    expect(donationsService.listDonations.mock.calls[0][1].shelterID).toBeUndefined();
    expect(governmentIdsService.listGovernmentIds.mock.calls[0][1].shelterID).toBeUndefined();
  });

  test("government ID review: the success message names the decision", async () => {
    governmentIdsService.updateGovernmentIdStatus.mockResolvedValue({ governmentIDID: 5 });

    const res = await send("patch", "/government-ids/5/status", "Staff", { verificationStatus: "Rejected" });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Government ID rejected successfully");
  });

  test("team list: the name filter is trimmed", async () => {
    shelterStaffService.listShelterStaff.mockResolvedValue({ data: [], pagination: {} });

    await send("get", "/staff/me/team?section=pending&name=%20Jo%20", "Staff");

    expect(shelterStaffService.listShelterStaff).toHaveBeenCalledWith(42, {
      section: "pending",
      staffDesignation: undefined,
      name: "Jo",
      page: 1,
      limit: 20,
    });
  });
});
