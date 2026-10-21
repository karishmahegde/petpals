// The five password rules shown as a checklist while typing — and that they
// agree with the server's (server/src/utils/password.js), which refuses any
// password that fails them.
import { describe, expect, test } from "vitest";
import { PASSWORD_REQUIREMENTS, meetsPasswordRequirements } from "./password";
// @ts-expect-error -- the server is plain CommonJS JavaScript with no type declarations
import serverPassword from "../../../../server/src/utils/password.js";

const server = serverPassword as { unmetPasswordRules: (password: string) => string[] };

const unmetLabels = (password: string) =>
  PASSWORD_REQUIREMENTS.filter((req) => !req.test(password)).map((req) => req.label);

describe("PASSWORD_REQUIREMENTS", () => {
  test.each([
    ["Secret123!", []],
    ["short1!", ["At least 8 characters", "One uppercase letter"]],
    ["SECRET123!", ["One lowercase letter"]],
    ["secret123!", ["One uppercase letter"]],
    ["SecretPass!", ["One number"]],
    ["Secret1234", ["One special character (!@#$%^&*)"]],
    ["", ["At least 8 characters", "One uppercase letter", "One lowercase letter", "One number", "One special character (!@#$%^&*)"]],
  ])("%j fails %j", (password, failed) => {
    expect(unmetLabels(password)).toEqual(failed);
  });

  test.each(["!", "@", "#", "$", "%", "^", "&", "*", "(", ")", ",", ".", "?", '"', ":", "{", "}", "|", "<", ">", "_", "-", "+", "="])(
    "%s counts as a special character",
    (char) => {
      expect(meetsPasswordRequirements(`Secret12${char}`)).toBe(true);
    },
  );

  test("a space or a slash doesn't count as a special character", () => {
    expect(meetsPasswordRequirements("Secret12 ")).toBe(false);
    expect(meetsPasswordRequirements("Secret12/")).toBe(false);
  });
});

describe("matches the server's rules", () => {
  test.each([
    "Secret123!",
    "short1!",
    "SECRET123!",
    "secret123!",
    "SecretPass!",
    "Secret1234",
    "",
    "Secret12 ",
    "Ünïcödé123!",
    "a".repeat(200) + "A1!",
  ])("%j: the client and server agree on how many rules fail", (password) => {
    expect(unmetLabels(password)).toHaveLength(server.unmetPasswordRules(password).length);
    expect(meetsPasswordRequirements(password)).toBe(server.unmetPasswordRules(password).length === 0);
  });

  test("the same five rules, in the same order", () => {
    expect(PASSWORD_REQUIREMENTS.map((req) => req.label.toLowerCase().replace(/ \(.*\)$/, ""))).toEqual(
      server.unmetPasswordRules(""),
    );
  });
});
