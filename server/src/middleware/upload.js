// Multipart/form-data handling for file uploads. Files are kept in memory (never
// written to local disk) and handed to the storage module as a buffer.
const multer = require("multer");

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB — an ID scan never needs more

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      const err = new Error(
        `Unsupported file type '${file.mimetype}'. Allowed: JPEG, PNG, WebP, HEIC, PDF`,
      );
      err.code = "BAD_REQUEST";
      return cb(err);
    }
    cb(null, true);
  },
});

// Wraps multer's single-file handler so its own errors (file too large,
// unexpected field) surface as our standard BAD_REQUEST rather than a raw 500.
const singleFile = (fieldName) => (req, res, next) => {
  upload.single(fieldName)(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError) {
      const message =
        err.code === "LIMIT_FILE_SIZE"
          ? "File exceeds the 5 MB limit"
          : err.code === "LIMIT_UNEXPECTED_FILE"
            ? `Send exactly one file in the '${fieldName}' field`
            : err.message;
      const mapped = new Error(message);
      mapped.code = "BAD_REQUEST";
      return next(mapped);
    }

    // fileFilter errors already carry err.code = "BAD_REQUEST"
    next(err);
  });
};

module.exports = { singleFile, ALLOWED_MIME, MAX_FILE_BYTES };
