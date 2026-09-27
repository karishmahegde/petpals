// PetPals — Storage setup
// Run from server/ as part of `npm run setup` (or alone: `npm run setup:storage`).
//
// 1. Creates the two Supabase Storage buckets if they're missing:
//    pet-images (public — photo URLs are served directly) and
//    government-ids (private — only the service-role key can read it).
// 2. Uploads every photo in setup/pet-images/ to pet-images/seed/<name>.webp,
//    overwriting what's there. seed.js points each seeded pet at one of these.
// 3. Uploads setup/placeholder.jpg to pet-images/placeholder.jpg — the photo
//    every pet created through the app starts with until staff upload one
//    (PLACEHOLDER_PHOTO in server/src/services/staff/pets.service.js).
//
// Safe to re-run. It only writes pet-images/seed/ and pet-images/placeholder.jpg,
// so photos and ID documents uploaded through the app are left alone.
//
// Buckets live in Supabase's own `storage` schema rather than the app schema,
// which is why they're created here instead of in a Prisma migration.
//
// No dependencies of its own: `.env` is loaded by the `-r dotenv/config` in the
// npm script (resolved from server/node_modules), and all Storage calls go
// through the server's storage module.

const fs = require("fs");
const path = require("path");
const storage = require("../server/src/services/storage");

const PHOTOS_DIR = path.join(__dirname, "pet-images");
const SEED_PREFIX = "seed";
const PLACEHOLDER = "placeholder.jpg";

const main = async () => {
  for (const [bucket, isPublic] of [
    [storage.PET_IMAGES_BUCKET, true],
    [storage.GOVERNMENT_IDS_BUCKET, false],
  ]) {
    const result = await storage.ensureBucket(bucket, { isPublic });
    console.log(`Bucket ${bucket} (${isPublic ? "public" : "private"}): ${result}`);
  }

  const photos = fs.readdirSync(PHOTOS_DIR).filter((f) => f.endsWith(".webp"));
  for (const file of photos) {
    const objectPath = `${SEED_PREFIX}/${file}`;
    await storage.uploadPrivateFile(
      storage.PET_IMAGES_BUCKET,
      objectPath,
      fs.readFileSync(path.join(PHOTOS_DIR, file)),
      "image/webp",
      { upsert: true },
    );
  }
  console.log(`Uploaded ${photos.length} seed photos to ${storage.PET_IMAGES_BUCKET}/${SEED_PREFIX}/`);

  await storage.uploadPrivateFile(
    storage.PET_IMAGES_BUCKET,
    PLACEHOLDER,
    fs.readFileSync(path.join(__dirname, PLACEHOLDER)),
    "image/jpeg",
    { upsert: true },
  );
  console.log(`Uploaded the new-pet placeholder to ${storage.PET_IMAGES_BUCKET}/${PLACEHOLDER}`);
};

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
