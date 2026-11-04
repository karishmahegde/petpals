// What a form shows when a request fails. The API's own error message wins;
// without one, no response or a 502/503/504 almost always means the free-plan
// API is still waking up (it sleeps after 15 idle minutes and the first
// request waits up to a minute — long enough for the proxy in front of it to
// give up), so say that instead of a bare "unable to connect".
import axios from "axios";

export const SERVER_WAKING_MESSAGE =
  "Couldn't reach the server. If PetPals hasn't been used for a while, it takes up to a minute to wake up — please try again shortly.";

export const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

const UNREACHABLE_STATUSES = new Set([502, 503, 504]);

export const requestErrorMessage = (err: unknown): string => {
  if (!axios.isAxiosError(err)) return GENERIC_ERROR_MESSAGE;
  const message = err.response?.data?.message;
  if (message) return String(message);
  if (!err.response || UNREACHABLE_STATUSES.has(err.response.status)) {
    return SERVER_WAKING_MESSAGE;
  }
  return GENERIC_ERROR_MESSAGE;
};
