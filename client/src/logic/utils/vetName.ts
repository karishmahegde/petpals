// Display name for a veterinarian — "Dr." prefixed, everywhere a vet's name
// is shown. Stored names stay as entered; a name that already starts with
// "Dr"/"Dr." (any case) is left alone so it never reads "Dr. Dr. …".
export const formatVetName = (name: string): string =>
  /^dr\.?\s/i.test(name.trim()) ? name.trim() : `Dr. ${name.trim()}`;
