// Where people land: after login (resolveDestination), when a session ends
// (loginPathFor, logoutDestinationFor) and when a signed-out visitor opens a
// protected page (loginPathForPage).
import { describe, expect, test } from "vitest";
import {
  dashboardPathFor,
  loginPathFor,
  loginPathForPage,
  logoutDestinationFor,
  resolveDestination,
} from "./resolveDestination";

const ROLES = ["Admin", "Adopter", "Staff", "Veterinarian", "Volunteer", "Donor"];

describe("dashboardPathFor", () => {
  test.each([
    ["Admin", "/admin"],
    ["Adopter", "/adopter"],
    ["Staff", "/staff"],
    ["Veterinarian", "/vet"],
    ["Volunteer", "/volunteer"],
    ["Donor", "/donor"],
    ["Wizard", "/"],
  ])("%s → %s", (role, path) => {
    expect(dashboardPathFor(role)).toBe(path);
  });
});

describe("resolveDestination (after login)", () => {
  test.each(ROLES)("%s with no redirect → their own dashboard", (role) => {
    expect(resolveDestination(role, null)).toBe(dashboardPathFor(role));
    expect(resolveDestination(role, "")).toBe(dashboardPathFor(role));
  });

  test("a redirect outside any dashboard is followed as-is, query string and all", () => {
    expect(resolveDestination("Adopter", "/adopt/apply/5")).toBe("/adopt/apply/5");
    expect(resolveDestination("Donor", "/adopt?species=1&size=Small")).toBe("/adopt?species=1&size=Small");
  });

  test("a redirect into their own dashboard is followed", () => {
    expect(resolveDestination("Adopter", "/adopter/visits?visitID=12")).toBe("/adopter/visits?visitID=12");
    expect(resolveDestination("Veterinarian", "/vet/health-records/4/health-passport")).toBe(
      "/vet/health-records/4/health-passport",
    );
  });

  test.each([
    ["Admin", "/staff/pets"],
    ["Staff", "/admin/shelters"],
    ["Adopter", "/vet/appointments"],
    ["Veterinarian", "/staff"],
    ["Donor", "/adopter/applications?x=1"],
  ])("%s redirected into another role's dashboard (%s) → their own instead", (role, redirect) => {
    expect(resolveDestination(role, redirect)).toBe(dashboardPathFor(role));
  });

  test("only the first path segment decides — /staff-portal isn't the staff dashboard", () => {
    expect(resolveDestination("Adopter", "/staff-portal/login")).toBe("/staff-portal/login");
    expect(resolveDestination("Adopter", "/adopters-info")).toBe("/adopters-info");
  });
});

describe("where a session ends up", () => {
  test.each([
    ["Admin", "/staff-portal/login", "/staff-portal/login"],
    ["Staff", "/staff-portal/login", "/staff-portal/login"],
    ["Veterinarian", "/staff-portal/login", "/staff-portal/login"],
    ["Volunteer", "/login", "/"],
    ["Adopter", "/login", "/"],
    ["Donor", "/login", "/"],
  ])("%s: after a 401 → %s; after Log out → %s", (role, login, logout) => {
    expect(loginPathFor(role)).toBe(login);
    expect(logoutDestinationFor(role)).toBe(logout);
  });

  test("no role (already signed out) → the public login and home", () => {
    expect(loginPathFor(null)).toBe("/login");
    expect(logoutDestinationFor(null)).toBe("/");
  });
});

describe("loginPathForPage (signed out on a protected page)", () => {
  test.each([
    ["/staff/pets", "/staff-portal/login"],
    ["/admin", "/staff-portal/login"],
    ["/vet/appointments?upcoming=true", "/staff-portal/login"],
    ["/adopter/visits", "/login"],
    ["/volunteer/tasks", "/login"],
    ["/donor/history", "/login"],
    ["/adopt/apply/5", "/login"],
  ])("%s → %s", (page, login) => {
    expect(loginPathForPage(page)).toBe(login);
  });
});
