const express = require("express");
const request = require("supertest");

const { singleFile, MAX_FILE_BYTES } = require("../../../middleware/upload");
const errorHandler = require("../../../middleware/errorHandler");

// A bare app with just the middleware under test + the real errorHandler, so
// each rejection is checked as the client actually sees it (status + envelope).
const buildApp = () => {
  const app = express();
  app.post("/upload", singleFile("file"), (req, res) => {
    res.status(200).json({
      success: true,
      data: req.file
        ? {
            fieldname: req.file.fieldname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            isBuffer: Buffer.isBuffer(req.file.buffer),
            hasPath: "path" in req.file,
          }
        : null,
      body: req.body,
    });
  });
  app.use(errorHandler);
  return app;
};

describe("singleFile upload middleware", () => {
  let app;
  let consoleErrorSpy;

  beforeAll(() => {
    app = buildApp();
  });

  beforeEach(() => {
    // errorHandler logs every non-UNAUTHORIZED error's stack outside production.
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test.each([
    ["id.jpg", "image/jpeg"],
    ["id.png", "image/png"],
    ["id.webp", "image/webp"],
    ["id.heic", "image/heic"],
    ["id.pdf", "application/pdf"],
  ])("%s (%s) accepted, kept in memory only, text fields still parsed", async (filename, mimetype) => {
    const res = await request(app)
      .post("/upload")
      .field("idType", "Passport")
      .attach("file", Buffer.from("fake-bytes"), { filename, contentType: mimetype });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      fieldname: "file",
      mimetype,
      size: 10,
      isBuffer: true,
      hasPath: false, // memoryStorage — never written to local disk
    });
    expect(res.body.body).toEqual({ idType: "Passport" });
  });

  test("no file at all -> passes through with req.file undefined (the controller decides)", async () => {
    const res = await request(app).post("/upload").field("idType", "Passport");

    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });

  test.each([
    ["id.txt", "text/plain"],
    ["id.gif", "image/gif"],
    ["id.svg", "image/svg+xml"],
    ["id.exe", "application/octet-stream"],
  ])("%s (%s) -> 400 BAD_REQUEST naming the type", async (filename, mimetype) => {
    const res = await request(app)
      .post("/upload")
      .attach("file", Buffer.from("fake-bytes"), { filename, contentType: mimetype });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("BAD_REQUEST");
    expect(res.body.message).toBe(
      `Unsupported file type '${mimetype}'. Allowed: JPEG, PNG, WebP, HEIC, PDF`,
    );
  });

  test("exactly 5 MB -> accepted", async () => {
    const res = await request(app)
      .post("/upload")
      .attach("file", Buffer.alloc(MAX_FILE_BYTES), {
        filename: "id.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(200);
    expect(res.body.data.size).toBe(MAX_FILE_BYTES);
  });

  test("one byte over 5 MB -> 400 BAD_REQUEST (not a raw multer 500)", async () => {
    const res = await request(app)
      .post("/upload")
      .attach("file", Buffer.alloc(MAX_FILE_BYTES + 1), {
        filename: "id.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
    expect(res.body.message).toBe("File exceeds the 5 MB limit");
  });

  test("file sent under the wrong field name -> 400 naming the expected field", async () => {
    const res = await request(app)
      .post("/upload")
      .attach("document", Buffer.from("fake-bytes"), {
        filename: "id.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Send exactly one file in the 'file' field");
  });

  test("two files -> 400 BAD_REQUEST", async () => {
    const res = await request(app)
      .post("/upload")
      .attach("file", Buffer.from("one"), { filename: "a.pdf", contentType: "application/pdf" })
      .attach("file", Buffer.from("two"), { filename: "b.pdf", contentType: "application/pdf" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
  });
});
