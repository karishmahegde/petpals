// Request checks on the admin endpoints for shelters, adopters and staff
// (admin/shelters, adopters and staff controllers): every malformed query or
// body answers 400 (an unparseable phone 422) without reaching the service,
// and a service error is passed on unchanged. The services are faked; their
// behaviour has its own suites.
const request = require("supertest");
const jwt = require("jsonwebtoken");

jest.mock("../../../services/auth/auth.service", () => ({
  ...jest.requireActual("../../../services/auth/auth.service"),
  getAccountStatus: jest.fn(),
}));
jest.mock("../../../services/admin/shelters.service");
jest.mock("../../../services/admin/adopters.service");
jest.mock("../../../services/admin/staff.service");

const authService = require("../../../services/auth/auth.service");
const sheltersService = require("../../../services/admin/shelters.service");
const adoptersService = require("../../../services/admin/adopters.service");
const staffService = require("../../../services/admin/staff.service");
const app = require("../../../app");

const token = (role = "Admin") =>
  jwt.sign({ userID: 1, role }, process.env.JWT_SECRET, { expiresIn: "1h" });

const send = (method, path, body, role) => {
  const req = request(app)[method](`/api/v1${path}`).set("Authorization", `Bearer ${token(role)}`);
  return body === undefined ? req : req.send(body);
};

const allServiceFns = () =>
  [sheltersService, adoptersService, staffService].flatMap((service) =>
    Object.values(service).filter((value) => jest.isMockFunction(value)),
  );

const VALID_SHELTER = {
  shelterName: "Uptown",
  shelterAddress: "2 Park Ave",
  shelterPhone: "+12125550105",
  shelterEmail: "uptown@petpals.org",
  shelterZIP: 10001,
  shelterSize: 40,
};

let consoleErrorSpy;

beforeEach(() => {
  jest.resetAllMocks();
  authService.getAccountStatus.mockResolvedValue("Active");
  consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
});

// [method, path, body, message]
const BAD_REQUESTS = [
  // Shelters
  ["post", "/shelters", { shelterName: "Uptown" }, "Missing required field(s): shelterAddress, shelterPhone, shelterEmail, shelterZIP, shelterSize"],
  ["post", "/shelters", { ...VALID_SHELTER, shelterName: "   " }, "shelterName must be a non-empty string of at most 45 characters"],
  ["post", "/shelters", { ...VALID_SHELTER, shelterAddress: "a".repeat(46) }, "shelterAddress must be a non-empty string of at most 45 characters"],
  ["post", "/shelters", { ...VALID_SHELTER, shelterEmail: "not-an-email" }, "shelterEmail must be a valid email address of at most 45 characters"],
  ["post", "/shelters", { ...VALID_SHELTER, shelterZIP: "10001" }, "shelterZIP must be a positive integer"],
  ["post", "/shelters", { ...VALID_SHELTER, shelterSize: 0 }, "shelterSize must be a positive integer"],
  ["put", "/shelters/abc", { shelterSize: 10 }, "id must be a positive integer"],
  ["put", "/shelters/3", {}, "No updatable fields provided"],
  ["put", "/shelters/3", { shelterSize: -5 }, "shelterSize must be a positive integer"],
  ["patch", "/shelters/abc/status", { shelterStatus: "Open" }, "id must be a positive integer"],
  ["patch", "/shelters/3/status", { shelterStatus: "Busy" }, "shelterStatus must be one of: Open, Full, Closed"],
  ["patch", "/shelters/abc/manager", { managerStaffID: 4 }, "id must be a positive integer"],
  ["patch", "/shelters/3/manager", { managerStaffID: "x" }, "managerStaffID must be a positive integer"],
  // Adopters
  ["get", "/adopters?page=0", undefined, "page must be an integer >= 1"],
  ["get", "/adopters?limit=101", undefined, "limit must be an integer between 1 and 100"],
  ["get", "/adopters?accountStatus=Gone", undefined, "accountStatus must be one of: Active, Banned, Deactivated, Closed"],
  ["get", "/adopters/abc", undefined, "id must be a positive integer"],
  ["patch", "/adopters/abc/status", { accountStatus: "Banned" }, "id must be a positive integer"],
  ["patch", "/adopters/7/status", { accountStatus: "Closed" }, "accountStatus must be one of: Active, Banned, Deactivated"],
  // Staff
  ["get", "/staff?page=0", undefined, "page must be an integer >= 1"],
  ["get", "/staff?limit=0", undefined, "limit must be an integer between 1 and 100"],
  ["get", "/staff?shelterID=abc", undefined, "shelterID must be a positive integer"],
  ["get", "/staff?staffDesignation=Boss", undefined, "staffDesignation must be one of: Manager, Senior, Associate"],
  ["get", "/staff?accountStatus=Gone", undefined, "accountStatus must be one of: Pending, Active, Deactivated, Closed, Declined"],
  ["get", "/staff/abc", undefined, "id must be a positive integer"],
  ["patch", "/staff/abc", { staffDesignation: "Senior" }, "id must be a positive integer"],
  ["patch", "/staff/42", {}, "No updatable fields provided"],
  ["patch", "/staff/42", { staffDesignation: "Boss" }, "staffDesignation must be one of: Manager, Senior, Associate"],
  ["patch", "/staff/42", { shelterID: "x" }, "shelterID must be a positive integer"],
  ["patch", "/staff/abc/status", { accountStatus: "Active" }, "id must be a positive integer"],
  ["patch", "/staff/42/status", { accountStatus: "Closed" }, "accountStatus must be one of: Active, Deactivated, Declined"],
];

test.each(BAD_REQUESTS)("%s %s %j → 400: %s", async (method, path, body, message) => {
  const res = await send(method, path, body);

  expect(res.status).toBe(400);
  expect(res.body).toMatchObject({ success: false, error: { code: "BAD_REQUEST" } });
  expect(res.body.message).toBe(message);
  for (const fn of allServiceFns()) expect(fn).not.toHaveBeenCalled();
});

test("an unparseable shelter phone → 422, nothing created", async () => {
  const res = await send("post", "/shelters", { ...VALID_SHELTER, shelterPhone: "call us" });

  expect(res.status).toBe(422);
  expect(sheltersService.createShelter).not.toHaveBeenCalled();
});

// [method, path, body, service fn]
const SERVICE_CALLS = [
  ["post", "/shelters", VALID_SHELTER, () => sheltersService.createShelter],
  ["put", "/shelters/3", { shelterSize: 10 }, () => sheltersService.updateShelter],
  ["patch", "/shelters/3/status", { shelterStatus: "Full" }, () => sheltersService.updateShelterStatus],
  ["patch", "/shelters/3/manager", { managerStaffID: 4 }, () => sheltersService.updateShelterManager],
  ["get", "/adopters", undefined, () => adoptersService.listAdopters],
  ["get", "/adopters/7", undefined, () => adoptersService.getAdopterDetail],
  ["patch", "/adopters/7/status", { accountStatus: "Banned" }, () => adoptersService.updateAdopterStatus],
  ["get", "/staff", undefined, () => staffService.listStaff],
  ["get", "/staff/42", undefined, () => staffService.getStaffDetail],
  ["patch", "/staff/42", { staffDesignation: "Senior" }, () => staffService.updateStaff],
  ["patch", "/staff/42/status", { accountStatus: "Active" }, () => staffService.updateStaffStatus],
];

test.each(SERVICE_CALLS)("%s %s: a service error is passed on unchanged", async (method, path, body, fn) => {
  fn().mockRejectedValue(Object.assign(new Error("Not allowed here"), { code: "CONFLICT" }));

  const res = await send(method, path, body);

  expect(res.status).toBe(409);
  expect(res.body.message).toBe("Not allowed here");
});

describe("values reach the services parsed", () => {
  test("a new shelter: the name trimmed, phone in E.164", async () => {
    sheltersService.createShelter.mockResolvedValue({ shelterID: 4 });

    const res = await send("post", "/shelters", {
      ...VALID_SHELTER,
      shelterName: "  Uptown  ",
      shelterPhone: "+1 (212) 555-0105",
    });

    expect(res.status).toBe(201);
    expect(sheltersService.createShelter).toHaveBeenCalledWith({
      ...VALID_SHELTER,
      shelterName: "Uptown",
      shelterPhone: "+12125550105",
    });
  });

  test("a shelter edit only passes the fields sent", async () => {
    sheltersService.updateShelter.mockResolvedValue({ shelterID: 3 });

    await send("put", "/shelters/3", { shelterSize: 60, unknown: "ignored" });

    expect(sheltersService.updateShelter).toHaveBeenCalledWith(3, { shelterSize: 60 });
  });

  test("adopters: the risk flag as a boolean and a blank name as no filter", async () => {
    adoptersService.listAdopters.mockResolvedValue({ data: [], pagination: {} });

    await send("get", "/adopters?adopterRiskFlag=true&name=%20%20&accountStatus=Banned");

    expect(adoptersService.listAdopters).toHaveBeenCalledWith({
      accountStatus: "Banned",
      adopterRiskFlag: true,
      name: undefined,
      page: 1,
      limit: 20,
    });
  });

  test("staff: awaitingAdmin as a boolean, shelterID as a number", async () => {
    staffService.listStaff.mockResolvedValue({ data: [], pagination: {} });

    await send("get", "/staff?awaitingAdmin=true&shelterID=3&name=%20Jo%20");

    expect(staffService.listStaff).toHaveBeenCalledWith(
      expect.objectContaining({ awaitingAdmin: true, shelterID: 3, name: "Jo" }),
    );
  });

  test("a staff edit: designation and shelter together", async () => {
    staffService.updateStaff.mockResolvedValue({ userID: 42 });

    await send("patch", "/staff/42", { staffDesignation: "Manager", shelterID: "3" });

    expect(staffService.updateStaff).toHaveBeenCalledWith(42, { staffDesignation: "Manager", shelterID: 3 });
  });
});
