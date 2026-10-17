const {
  isEmailConfigured,
  sendEmail,
  queueEmail,
  templates,
} = require("../../../services/email");

const message = {
  to: "adopter@example.test",
  subject: "Hello",
  text: "Plain body",
  html: "<p>HTML body</p>",
};

const jsonResponse = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

const savedEnv = {};
const EMAIL_VARS = ["EMAIL_API_KEY", "EMAIL_FROM", "EMAIL_FROM_NAME"];

// Lets the fire-and-forget promise chain inside queueEmail run.
const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  EMAIL_VARS.forEach((name) => {
    savedEnv[name] = process.env[name];
  });
  process.env.EMAIL_API_KEY = "test-key";
  process.env.EMAIL_FROM = "noreply@petpals.test";
  process.env.EMAIL_FROM_NAME = "";
  global.fetch = jest.fn();
});

afterEach(() => {
  EMAIL_VARS.forEach((name) => {
    if (savedEnv[name] === undefined) delete process.env[name];
    else process.env[name] = savedEnv[name];
  });
  delete global.fetch;
  jest.restoreAllMocks();
});

describe("isEmailConfigured", () => {
  test("true only when the API key and sender are both set", () => {
    expect(isEmailConfigured()).toBe(true);
    for (const name of ["EMAIL_API_KEY", "EMAIL_FROM"]) {
      const value = process.env[name];
      process.env[name] = "  ";
      expect(isEmailConfigured()).toBe(false);
      process.env[name] = value;
    }
  });
});

describe("sendEmail", () => {
  test("posts to Brevo with the key, sender, recipient and both bodies", async () => {
    global.fetch.mockResolvedValue(jsonResponse(201, { messageId: "m1" }));

    await expect(sendEmail(message)).resolves.toEqual({ delivered: true });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(options.method).toBe("POST");
    expect(options.headers["api-key"]).toBe("test-key");
    expect(JSON.parse(options.body)).toEqual({
      sender: { email: "noreply@petpals.test", name: "PetPals" },
      to: [{ email: "adopter@example.test" }],
      subject: "Hello",
      htmlContent: "<p>HTML body</p>",
      textContent: "Plain body",
    });
  });

  test("uses EMAIL_FROM_NAME as the sender name when set", async () => {
    process.env.EMAIL_FROM_NAME = "PetPals Shelters";
    global.fetch.mockResolvedValue(jsonResponse(201, {}));

    await sendEmail(message);

    expect(JSON.parse(global.fetch.mock.calls[0][1].body).sender.name).toBe(
      "PetPals Shelters",
    );
  });

  test("not configured → doesn't call the provider", async () => {
    process.env.EMAIL_API_KEY = "";

    await expect(sendEmail(message)).resolves.toEqual({ delivered: false });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("not configured outside tests → prints the email to the console", async () => {
    process.env.EMAIL_API_KEY = "";
    const savedNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    const info = jest.spyOn(console, "info").mockImplementation(() => {});

    try {
      await sendEmail(message);
    } finally {
      process.env.NODE_ENV = savedNodeEnv;
    }

    expect(info).toHaveBeenCalledTimes(1);
    expect(info.mock.calls[0][0]).toContain("adopter@example.test");
    expect(info.mock.calls[0][0]).toContain("Plain body");
  });

  test("provider error → throws with the provider's own message", async () => {
    global.fetch.mockResolvedValue(
      jsonResponse(400, { code: "invalid_parameter", message: "sender not verified" }),
    );

    await expect(sendEmail(message)).rejects.toThrow(
      "Email provider returned 400: sender not verified",
    );
  });

  test("timeout and network failure → throw", async () => {
    const timeout = new Error("timed out");
    timeout.name = "TimeoutError";
    global.fetch.mockRejectedValueOnce(timeout);
    await expect(sendEmail(message)).rejects.toThrow("timed out after");

    global.fetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    await expect(sendEmail(message)).rejects.toThrow("unreachable: ECONNREFUSED");
  });
});

describe("queueEmail", () => {
  test("returns straight away and sends in the background", async () => {
    global.fetch.mockResolvedValue(jsonResponse(201, {}));

    expect(queueEmail(message)).toBeUndefined();
    await flushPromises();

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("a failed send is logged, never thrown", async () => {
    global.fetch.mockRejectedValue(new Error("ECONNREFUSED"));
    const error = jest.spyOn(console, "error").mockImplementation(() => {});

    expect(() => queueEmail(message)).not.toThrow();
    await flushPromises();

    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0][0]).toContain('failed to send "Hello"');
  });
});

describe("templates", () => {
  test("clientLink builds a frontend URL with encoded query params", () => {
    const url = new URL(templates.clientLink("/verify-email", { token: "a b+c" }));
    expect(url.pathname).toBe("/verify-email");
    expect(url.searchParams.get("token")).toBe("a b+c");
  });

  test("renderEmail returns subject, text and HTML with the action link in both", () => {
    const email = templates.renderEmail({
      subject: "Verify your email",
      heading: "Hi Sam",
      paragraphs: ["Please confirm your address."],
      action: { label: "Verify email", url: "http://localhost:3000/verify-email?token=t" },
      footnote: "Didn't sign up? Ignore this email.",
    });

    expect(email.subject).toBe("Verify your email");
    expect(email.text).toContain("Please confirm your address.");
    expect(email.text).toContain("Verify email: http://localhost:3000/verify-email?token=t");
    expect(email.text).toContain("Didn't sign up?");
    expect(email.html).toContain('href="http://localhost:3000/verify-email?token=t"');
  });

  test("renderEmail escapes HTML in every value", () => {
    const email = templates.renderEmail({
      subject: "s",
      heading: "<b>Sam</b>",
      paragraphs: ['Remark: <script>alert("x")</script>'],
    });

    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;b&gt;Sam&lt;/b&gt;");
    expect(email.html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    // The text part is plain text — no escaping needed there.
    expect(email.text).toContain("<b>Sam</b>");
  });
});
