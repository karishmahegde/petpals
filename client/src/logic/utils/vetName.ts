// Display name for a veterinarian — "Dr." prefixed, everywhere a vet's name
// is shown. Stored names stay as entered; a name that already starts with
// "Dr"/"Dr." (any case) is left alone so it never reads "Dr. Dr. …". A
// missing name means the vet has since deleted their account — their past
// appointments keep existing with no vet.
export const formatVetName = (name: string | null | undefined): string => {
  if (!name) return "Former vet";
  return /^dr\.?\s/i.test(name.trim()) ? name.trim() : `Dr. ${name.trim()}`;
};
