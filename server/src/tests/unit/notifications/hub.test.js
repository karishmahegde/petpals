// The in-process stream registry (services/notifications/hub.js): publish
// reaches every open stream of that user and nobody else's, and a stream
// that's gone is dropped.
const hub = require("../../../services/notifications/hub");

const fakeStream = () => ({ write: jest.fn() });

describe("frame", () => {
  test("is one SSE event: name, JSON data on one line, blank line", () => {
    expect(hub.frame("unread-count", { unreadCount: 3 })).toBe(
      'event: unread-count\ndata: {"unreadCount":3}\n\n',
    );
  });
});

describe("subscribe / publish", () => {
  const unsubscribers = [];
  const subscribe = (userID, res) => {
    const unsubscribe = hub.subscribe(userID, res);
    unsubscribers.push(unsubscribe);
    return unsubscribe;
  };

  afterEach(() => {
    unsubscribers.splice(0).forEach((unsubscribe) => unsubscribe());
  });

  test("writes to every stream the user has open (one per tab)", () => {
    const tab1 = fakeStream();
    const tab2 = fakeStream();
    subscribe(4, tab1);
    subscribe(4, tab2);

    hub.publish(4, "notification", { notificationID: 1 });

    const expected = hub.frame("notification", { notificationID: 1 });
    expect(tab1.write).toHaveBeenCalledWith(expected);
    expect(tab2.write).toHaveBeenCalledWith(expected);
  });

  test("never reaches another user's streams", () => {
    const mine = fakeStream();
    const theirs = fakeStream();
    subscribe(4, mine);
    subscribe(9, theirs);

    hub.publish(4, "notification", {});

    expect(mine.write).toHaveBeenCalledTimes(1);
    expect(theirs.write).not.toHaveBeenCalled();
  });

  test("a user with no open stream is a no-op", () => {
    expect(() => hub.publish(77, "notification", {})).not.toThrow();
  });

  test("an unsubscribed stream gets nothing more; the others still do", () => {
    const closed = fakeStream();
    const open = fakeStream();
    const unsubscribe = subscribe(4, closed);
    subscribe(4, open);

    unsubscribe();
    hub.publish(4, "notification", {});

    expect(closed.write).not.toHaveBeenCalled();
    expect(open.write).toHaveBeenCalledTimes(1);
  });

  test("unsubscribing twice is harmless", () => {
    const unsubscribe = subscribe(4, fakeStream());
    unsubscribe();
    expect(() => unsubscribe()).not.toThrow();
  });

  test("a stream whose write throws is dropped, and the rest still get the event", () => {
    const broken = fakeStream();
    broken.write.mockImplementation(() => {
      throw new Error("write after end");
    });
    const healthy = fakeStream();
    subscribe(4, broken);
    subscribe(4, healthy);

    hub.publish(4, "notification", {});
    hub.publish(4, "notification", {});

    expect(broken.write).toHaveBeenCalledTimes(1);
    expect(healthy.write).toHaveBeenCalledTimes(2);
  });
});
