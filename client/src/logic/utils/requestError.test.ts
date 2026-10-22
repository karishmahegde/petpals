// requestErrorMessage: the API's message first; "waking up" when the server
// couldn't be reached; a generic line for everything else.
import { describe, expect, test } from "vitest";
import { AxiosError, AxiosHeaders, type AxiosResponse } from "axios";
import {
  GENERIC_ERROR_MESSAGE,
  SERVER_WAKING_MESSAGE,
  requestErrorMessage,
} from "./requestError";

const axiosError = (response?: { status: number; data?: unknown }) => {
  const err = new AxiosError("Request failed");
  if (response) {
    err.response = {
      status: response.status,
      data: response.data,
      statusText: "",
      headers: {},
      config: { headers: new AxiosHeaders() },
    } as AxiosResponse;
  }
  return err;
};

describe("requestErrorMessage", () => {
  test("the API's own message wins, whatever the status", () => {
    expect(
      requestErrorMessage(axiosError({ status: 401, data: { message: "Invalid email or password" } })),
    ).toBe("Invalid email or password");
  });

  test("no response at all (asleep, timed out, offline) → waking-up message", () => {
    expect(requestErrorMessage(axiosError())).toBe(SERVER_WAKING_MESSAGE);
  });

  test.each([502, 503, 504])("%i from the proxy, with no API message → waking-up message", (status) => {
    expect(requestErrorMessage(axiosError({ status, data: "<html>Gateway Timeout</html>" }))).toBe(
      SERVER_WAKING_MESSAGE,
    );
  });

  test("another status with no message → generic message", () => {
    expect(requestErrorMessage(axiosError({ status: 500 }))).toBe(GENERIC_ERROR_MESSAGE);
  });

  test("not an axios error → generic message", () => {
    expect(requestErrorMessage(new Error("boom"))).toBe(GENERIC_ERROR_MESSAGE);
  });
});
