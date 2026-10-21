// The navbar bell: the unread badge, the dropdown (fetched only when open),
// opening a notification (marks it read, follows its link), Mark all as read,
// View all, closing on Escape or an outside click, and the sound toggle. The
// notifications API is faked.
import { beforeEach, describe, expect, test, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import NotificationBell from "./NotificationBell";
import { renderWithProviders } from "../../../../test/render";
import {
  getNotifications,
  getUnreadCount,
  markAllNotificationsRead,
  markNotification,
  type AppNotification,
} from "../../../../logic/api/notificationsApi";

vi.mock("../../../../logic/api/notificationsApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../logic/api/notificationsApi")>()),
  getUnreadCount: vi.fn(),
  getNotifications: vi.fn(),
  markNotification: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}));

const notification = (overrides: Partial<AppNotification> = {}): AppNotification =>
  ({
    notificationID: 41,
    type: "VisitConfirmed",
    title: "Visit confirmed",
    body: "PetPals Downtown confirmed your visit to meet Biscuit.",
    link: "/adopter/visits?visitID=12",
    readAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  }) as AppNotification;

const listOf = (items: AppNotification[]) => ({
  data: items,
  pagination: { page: 1, limit: 10, total: items.length, totalPages: 1 },
  unreadCount: items.filter((n) => n.readAt === null).length,
});

const Url = () => <p data-testid="url">{useLocation().pathname + useLocation().search}</p>;

const renderBell = (role = "Adopter") =>
  renderWithProviders(
    <>
      <NotificationBell />
      <button type="button">Somewhere else</button>
      <Url />
    </>,
    { route: "/adopter", user: { role } },
  );

const bell = () => screen.getAllByRole("button")[0];
const openDropdown = async () => {
  await userEvent.click(bell());
  return screen.findByRole("region", { name: "Notifications" });
};

beforeEach(() => {
  vi.mocked(getUnreadCount).mockReset().mockResolvedValue(0);
  vi.mocked(getNotifications).mockReset().mockResolvedValue(listOf([]));
  vi.mocked(markNotification).mockReset();
  vi.mocked(markAllNotificationsRead).mockReset();
});

describe("the badge", () => {
  test("shows the unread count, and says it to screen readers", async () => {
    vi.mocked(getUnreadCount).mockResolvedValue(3);
    renderBell();

    expect(await screen.findByRole("button", { name: "Notifications, 3 unread" })).toHaveTextContent("3");
  });

  test("past nine it reads 9+", async () => {
    vi.mocked(getUnreadCount).mockResolvedValue(12);
    renderBell();

    expect(await screen.findByRole("button", { name: "Notifications, 12 unread" })).toHaveTextContent("9+");
  });

  test("nothing unread: no badge", async () => {
    renderBell();

    await waitFor(() => expect(getUnreadCount).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Notifications" })).toHaveTextContent("");
  });
});

describe("the dropdown", () => {
  test("the list is only fetched once it's opened, the latest 10", async () => {
    renderBell();
    await waitFor(() => expect(getUnreadCount).toHaveBeenCalled());
    expect(getNotifications).not.toHaveBeenCalled();

    await openDropdown();

    expect(getNotifications).toHaveBeenCalledWith({ limit: 10 });
    expect(bell()).toHaveAttribute("aria-expanded", "true");
  });

  test("opening moves focus to its heading", async () => {
    renderBell();
    await openDropdown();

    expect(screen.getByRole("heading", { name: "Notifications" })).toHaveFocus();
  });

  test("an empty list says so", async () => {
    renderBell();
    await openDropdown();

    expect(await screen.findByText("You're all caught up — nothing here yet.")).toBeInTheDocument();
  });

  test("a failed load says so", async () => {
    vi.mocked(getNotifications).mockRejectedValue(new Error("500"));
    renderBell();
    await openDropdown();

    expect(await screen.findByText("Couldn't load your notifications. Please try again.")).toBeInTheDocument();
  });

  test("Escape closes it and gives focus back to the bell", async () => {
    renderBell();
    await openDropdown();

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("region", { name: "Notifications" })).not.toBeInTheDocument();
    expect(bell()).toHaveFocus();
  });

  test("a click outside closes it", async () => {
    renderBell();
    await openDropdown();

    await userEvent.click(screen.getByRole("button", { name: "Somewhere else" }));

    expect(screen.queryByRole("region", { name: "Notifications" })).not.toBeInTheDocument();
  });
});

describe("opening a notification", () => {
  test("an unread one is marked read, and its link followed", async () => {
    vi.mocked(getUnreadCount).mockResolvedValue(1);
    vi.mocked(getNotifications).mockResolvedValue(listOf([notification()]));
    vi.mocked(markNotification).mockResolvedValue({ notification: notification(), unreadCount: 0 });
    renderBell();
    const region = await openDropdown();

    await userEvent.click(await within(region).findByRole("button", { name: /^Unread: Visit confirmed/ }));

    expect(markNotification).toHaveBeenCalledWith(41, true);
    expect(screen.getByTestId("url")).toHaveTextContent("/adopter/visits?visitID=12");
    expect(screen.queryByRole("region", { name: "Notifications" })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument());
  });

  test("an already-read one just follows its link", async () => {
    vi.mocked(getNotifications).mockResolvedValue(
      listOf([notification({ readAt: new Date().toISOString(), link: "/adopter/applications" })]),
    );
    renderBell();
    const region = await openDropdown();

    await userEvent.click(await within(region).findByRole("button", { name: /^Visit confirmed/ }));

    expect(markNotification).not.toHaveBeenCalled();
    expect(screen.getByTestId("url")).toHaveTextContent("/adopter/applications");
  });
});

describe("Mark all as read and View all", () => {
  test("Mark all as read only shows with something unread, and clears the badge", async () => {
    vi.mocked(getUnreadCount).mockResolvedValue(2);
    vi.mocked(markAllNotificationsRead).mockResolvedValue({ updated: 2, unreadCount: 0 });
    renderBell();
    await screen.findByRole("button", { name: "Notifications, 2 unread" });
    await openDropdown();

    await userEvent.click(screen.getByRole("button", { name: "Mark all as read" }));

    expect(markAllNotificationsRead).toHaveBeenCalled();
    expect(await screen.findByRole("button", { name: "Notifications" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark all as read" })).not.toBeInTheDocument();
  });

  test.each([
    ["Adopter", "/adopter/notifications"],
    ["Veterinarian", "/vet/notifications"],
    ["Staff", "/staff/notifications"],
  ])("View all (%s) → %s", async (role, path) => {
    renderBell(role);
    await openDropdown();

    await userEvent.click(screen.getByRole("button", { name: "View all" }));

    expect(screen.getByTestId("url")).toHaveTextContent(path);
  });
});

describe("the sound toggle", () => {
  test("on by default; turning it off is remembered", async () => {
    renderBell();
    await openDropdown();
    const toggle = screen.getByRole("button", { name: "Notification sound" });
    expect(toggle).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(window.localStorage.getItem("petpals:notification-sound")).toBe("off");
  });
});
