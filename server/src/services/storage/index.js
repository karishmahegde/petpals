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

module.exports = {
  GOVERNMENT_IDS_BUCKET,
  uploadPrivateFile,
  deletePrivateFile,
};
