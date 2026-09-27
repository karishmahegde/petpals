// components/ui/profile/ProfileAddressSection.tsx
// The "Address" card on a self-service Profile page — one field per address
// column (line 1/2, city, state, ZIP, country), shown read-only or as inputs
// while editing. Every role table carries the same six columns, so every
// role's Profile renders this same card. The page owns the draft: `draft`
// + `onChange` are its edit state, `value` the saved profile.
import type { Address } from "../../../logic/utils/address";

const FIELDS: { key: keyof Address; label: string; maxLength: number }[] = [
  { key: "addressLine1", label: "Address line 1", maxLength: 100 },
  { key: "addressLine2", label: "Address line 2", maxLength: 100 },
  { key: "city", label: "City", maxLength: 45 },
  { key: "state", label: "State", maxLength: 45 },
  { key: "zip", label: "ZIP", maxLength: 10 },
  { key: "country", label: "Country", maxLength: 45 },
];

const inputClass =
  "w-full rounded-lg border border-rose-light bg-white px-3 py-1.5 font-body text-sm text-neutral-dark focus:border-teal-dark focus:outline-none";

interface ProfileAddressSectionProps {
  value: Address;
  isEditing: boolean;
  draft: Address | null;
  onChange: (part: Partial<Address>) => void;
}

const ProfileAddressSection = ({
  value,
  isEditing,
  draft,
  onChange,
}: ProfileAddressSectionProps) => (
  <section className="rounded-2xl border border-rose-light bg-white p-5 md:p-6">
    <h2 className="mb-4 font-display text-lg text-neutral-dark">Address</h2>
    <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
      {FIELDS.map(({ key, label, maxLength }) => (
        <div key={key}>
          <dt className="font-body text-xs text-neutral-gray">
            <label htmlFor={`profile-${key}`}>{label}</label>
          </dt>
          <dd className="mt-1 font-body text-sm text-neutral-dark">
            {isEditing && draft ? (
              <input
                id={`profile-${key}`}
                type="text"
                value={draft[key] ?? ""}
                maxLength={maxLength}
                onChange={(e) =>
                  onChange({
                    // addressLine2 is the one optional column — blank
                    // clears it to null; the rest clear to "".
                    [key]:
                      key === "addressLine2"
                        ? e.target.value || null
                        : e.target.value,
                  })
                }
                className={inputClass}
              />
            ) : (
              value[key] || <span className="text-neutral-gray">—</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  </section>
);

export default ProfileAddressSection;
