// Isolated storage module — the ONLY file that talks to Supabase Storage.
// Everything else imports from here. Swapping storage providers means rewriting
// this one file and nothing else (same pattern as services/geocoding/).
//
// Uses the Storage REST API directly via global fetch (Node 18+) so no SDK
// dependency is needed. Writes require the SERVICE ROLE key — the anon key
// cannot write to a private bucket.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Name of the private bucket holding identity documents. Must be created in the
// Supabase dashboard as a NON-public bucket.
const GOVERNMENT_IDS_BUCKET = "government-ids";

// Name of the public bucket holding pet photos — unlike government-ids,
// this one is publicly readable (pet photos are shown on the unauthenticated
// public catalog). Writes/deletes still require the service role key
// regardless of a bucket's public/private read setting, so
// deletePrivateFile below works unchanged for this bucket too — "Private"
// in its name describes its original use case, not a restriction on which
// bucket it can target.
const PET_IMAGES_BUCKET = "pet-images";

const storageError = (message) => {
  const err = new Error(message);
  err.code = "INTERNAL_SERVER_ERROR";
  return err;
};

const assertConfigured = () => {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw storageError(
      "Supabase Storage is not configured — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  // Catch a leftover placeholder / malformed value here, with a clear message,
  // rather than deep inside fetch() as "Failed to parse URL".
  try {
    new URL(SUPABASE_URL);
  } catch {
    throw storageError(`SUPABASE_URL is not a valid URL: "${SUPABASE_URL}"`);
  }
};

const authHeaders = () => ({
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  apikey: SERVICE_ROLE_KEY,
});

const objectUrl = (bucket, objectPath) =>
  `${SUPABASE_URL}/storage/v1/object/${bucket}/${encodeURI(objectPath)}`;

// Turns a stored PET_IMAGES_BUCKET value into something an <img src> can
// load. New uploads (addPhoto in staff/pets.service.js) store the bare
// Storage object path (e.g. "pets/5/photo-123.jpg"), which needs the
// bucket's public read URL prefix — but seed.js pets already have a full
// absolute URL in petPhoto (e.g. "https://.../1.png"), which must pass
// through unchanged. Only ever call this for PET_IMAGES_BUCKET (public);
// government-ids stays private and is never rendered as an <img>.
const toPublicFileUrl = (bucket, value) => {
  if (!value) return value;
  if (/^https?:\/\//i.test(value)) return value;
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${encodeURI(value)}`;
};

// Uploads a buffer to `bucket` at `objectPath` (no leading slash). Fails if an
// object already exists there (x-upsert: false). Returns the stored object path.
const uploadPrivateFile = async (bucket, objectPath, buffer, contentType) => {
  assertConfigured();

  const res = await fetch(objectUrl(bucket, objectPath), {
    method: "POST",
    headers: {
      ...authHeaders(),
      "Content-Type": contentType || "application/octet-stream",
      "x-upsert": "false",
      "cache-control": "max-age=3600",
    },
    body: buffer,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw storageError(`Storage upload failed (${res.status}): ${detail}`);
  }

  return objectPath;
};

// Best-effort delete — used to roll back an orphaned upload when the DB write
// that should have referenced it fails afterwards. Never throws.
const deletePrivateFile = async (bucket, objectPath) => {
  try {
    assertConfigured();
    await fetch(objectUrl(bucket, objectPath), {
      method: "DELETE",
      headers: authHeaders(),
    });
  } catch {
    /* swallow — rollback is best-effort */
  }
};

// Generates a short-lived signed URL for a private object (government-ids
// staff verification view — the only place a private-bucket file is ever
// rendered as an image, so this is the only caller). Never cache/persist the
// result; call it fresh every time the detail panel opens.
const createSignedUrl = async (bucket, objectPath, expiresInSeconds = 300) => {
  assertConfigured();

  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/sign/${bucket}/${encodeURI(objectPath)}`,
    {
      method: "POST",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn: expiresInSeconds }),
    },
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw storageError(`Failed to sign storage URL (${res.status}): ${detail}`);
  }

  // Supabase returns signedURL as "/object/sign/bucket/path?token=..." —
  // relative to /storage/v1, not to the bucket root. Confirmed by hitting
  // the naively-prefixed URL and getting a 404.
  const { signedURL } = await res.json();
  return `${SUPABASE_URL}/storage/v1${signedURL}`;
};

module.exports = {
  GOVERNMENT_IDS_BUCKET,
  PET_IMAGES_BUCKET,
  uploadPrivateFile,
  deletePrivateFile,
  createSignedUrl,
  toPublicFileUrl,
};
