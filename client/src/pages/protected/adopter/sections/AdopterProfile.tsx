import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import toast from "react-hot-toast";
import {
  PiArrowsClockwiseBold,
  PiLightningFill,
  PiSealCheck,
} from "react-icons/pi";
import DashboardHeading from "../../../../components/ui/DashboardHeading";
import Avatar from "../../../../components/ui/Avatar";
import PhoneInputField from "../../../../components/ui/PhoneInputField";
import PhoneDisplay from "../../../../components/ui/PhoneDisplay";
import CloseAccountModal from "./CloseAccountModal";
import {
  getAdopterProfile,
  updateAdopterProfile,
  type AdopterProfile as AdopterProfileData,
} from "../../../../logic/api/adoptersApi";
import {
  getSpecies,
  getBreeds,
  type Breed,
} from "../../../../logic/api/petsApi";
import { formatShortDate } from "../../../../logic/utils/datetime";

// ——————————————————————————————————————————————————————————————
// Field model — drives both view and edit rendering generically.
// ——————————————————————————————————————————————————————————————

interface EditableProfile {
  avatarSeed: string;
  adopterName: string;
  adopterDOB: string | null; // "YYYY-MM-DD"
  adopterSex: string | null;
  adopterPhone: string | null;
  adopterType: string | null;
  housingType: string | null;
  ownsOrRents: string | null;
  landlordContact: string | null;
  householdSize: number | null;
  numChildren: number | null;
  employmentStatus: string | null;
  activityLevel: string | null;
  yardAvailable: boolean;
  petExperience: string | null;
  currentPets: number;
  preferredBreedID: number | null;
  preferredAgeRange: string | null;
  preferredSize: string | null;
  openToSpecialNeeds: boolean;
}

type EditableKey = keyof EditableProfile;
type FieldType =
  | "text"
  | "date"
  | "number"
  | "select"
  | "boolean"
  | "breed"
  | "phone";

interface FieldDef {
  key: EditableKey;
  label: string;
  type: FieldType;
  nullable: boolean;
  maxLength?: number;
}

const SECTIONS: { title: string; fields: FieldDef[] }[] = [
  {
    title: "Personal",
    fields: [
      {
        key: "adopterName",
        label: "Full name",
        type: "text",
        nullable: false,
        maxLength: 45,
      },
      {
        key: "adopterDOB",
        label: "Date of birth",
        type: "date",
        nullable: true,
      },
      { key: "adopterSex", label: "Sex", type: "select", nullable: true },
      {
        key: "adopterPhone",
        label: "Phone",
        type: "phone",
        nullable: true,
      },
      {
        key: "adopterType",
        label: "Adopter type",
        type: "select",
        nullable: true,
      },
    ],
  },
  {
    title: "Household",
    fields: [
      {
        key: "housingType",
        label: "Housing type",
        type: "select",
        nullable: true,
      },
      {
        key: "ownsOrRents",
        label: "Owns or rents",
        type: "select",
        nullable: true,
      },
      {
        key: "landlordContact",
        label: "Landlord contact",
        type: "text",
        nullable: true,
        maxLength: 20,
      },
      {
        key: "householdSize",
        label: "Household size",
        type: "number",
        nullable: true,
      },
      {
        key: "numChildren",
        label: "Number of children",
        type: "number",
        nullable: true,
      },
      {
        key: "yardAvailable",
        label: "Yard available",
        type: "boolean",
        nullable: false,
      },
    ],
  },
  {
    title: "Lifestyle & Experience",
    fields: [
      {
        key: "employmentStatus",
        label: "Employment status",
        type: "select",
        nullable: true,
      },
      {
        key: "activityLevel",
        label: "Activity level",
        type: "select",
        nullable: true,
      },
      {
        key: "petExperience",
        label: "Pet experience",
        type: "select",
        nullable: true,
      },
      {
        key: "currentPets",
        label: "Current pets",
        type: "number",
        nullable: false,
      },
    ],
  },
  {
    title: "Adoption Preferences",
    fields: [
      {
        key: "preferredBreedID",
        label: "Preferred breed",
        type: "breed",
        nullable: true,
      },
      {
        key: "preferredAgeRange",
        label: "Preferred age range",
        type: "select",
        nullable: true,
      },
      {
        key: "preferredSize",
        label: "Preferred size",
        type: "select",
        nullable: true,
      },
      {
        key: "openToSpecialNeeds",
        label: "Open to special needs",
        type: "boolean",
        nullable: false,
      },
    ],
  },
];

// Enum values mirror server-side validation (adopters.controller.js).
const ENUM_VALUES: Partial<Record<EditableKey, string[]>> = {
  adopterSex: ["M", "F", "O"],
  adopterType: ["Fosterer", "Owner"],
  housingType: ["Apartment", "House", "Other"],
  ownsOrRents: ["Owns", "Rents"],
  employmentStatus: ["Unemployed", "Student", "Self_employed", "Employed"],
  activityLevel: ["Sedentary", "Medium", "Active"],
  petExperience: ["No", "Little", "Some", "Very"],
  preferredAgeRange: ["Young", "Adult", "Old"],
  preferredSize: ["Small", "Medium", "Large"],
};

const SEX_LABELS: Record<string, string> = {
  M: "Male",
  F: "Female",
  O: "Other",
};

const humanizeEnum = (value: string) => value.replace(/_/g, " ");

const optionLabel = (key: EditableKey, value: string) =>
  key === "adopterSex" ? (SEX_LABELS[value] ?? value) : humanizeEnum(value);

const toEditable = (p: AdopterProfileData): EditableProfile => ({
  avatarSeed: p.avatarSeed,
  adopterName: p.adopterName ?? "",
  adopterDOB: p.adopterDOB ? p.adopterDOB.slice(0, 10) : null,
  adopterSex: p.adopterSex ?? null,
  adopterPhone: p.adopterPhone ?? null,
  adopterType: p.adopterType ?? null,
  housingType: p.housingType ?? null,
  ownsOrRents: p.ownsOrRents ?? null,
  landlordContact: p.landlordContact ?? null,
  householdSize: p.householdSize ?? null,
  numChildren: p.numChildren ?? null,
  employmentStatus: p.employmentStatus ?? null,
  activityLevel: p.activityLevel ?? null,
  yardAvailable: p.yardAvailable,
  petExperience: p.petExperience ?? null,
  currentPets: p.currentPets,
  preferredBreedID: p.preferredBreedID ?? null,
  preferredAgeRange: p.preferredAgeRange ?? null,
  preferredSize: p.preferredSize ?? null,
  openToSpecialNeeds: p.openToSpecialNeeds,
});

// Only send fields the user actually changed — the endpoint is happy with a
// partial body.
const buildPayload = (original: EditableProfile, next: EditableProfile) => {
  const payload: Record<string, unknown> = {};
  (Object.keys(next) as EditableKey[]).forEach((key) => {
    if (next[key] !== original[key]) payload[key] = next[key];
  });
  return payload;
};

const extractError = (err: unknown): string =>
  axios.isAxiosError(err) && err.response?.data?.message
    ? String(err.response.data.message)
    : "Something went wrong. Please try again.";

const inputClass =
  "w-full rounded-lg border border-rose-light bg-white px-3 py-1.5 font-body text-sm text-neutral-dark focus:border-teal-dark focus:outline-none";

// ——————————————————————————————————————————————————————————————

const AdopterProfile = () => {
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ["adopter", "me"],
    queryFn: getAdopterProfile,
  });
  const profile = profileQuery.data;

  // Breeds — needed in view mode to resolve preferredBreedID → name, and reused
  // by the edit dropdown. GET /breeds requires speciesID(s), so fetch species
  // first, then every breed across all species.
  const speciesQuery = useQuery({ queryKey: ["species"], queryFn: getSpecies });
  const speciesIDs = (speciesQuery.data ?? []).map((s) => s.speciesID);
  const breedsQuery = useQuery({
    queryKey: ["breeds", speciesIDs],
    queryFn: () => getBreeds(speciesIDs),
    enabled: speciesIDs.length > 0,
  });
  const breeds = breedsQuery.data ?? [];
  const breedsSettled =
    speciesQuery.isFetched &&
    (speciesIDs.length === 0 || breedsQuery.isFetched);

  const breedsBySpecies = breeds.reduce<Record<string, Breed[]>>(
    (acc, breed) => {
      (acc[breed.speciesName] ??= []).push(breed);
      return acc;
    },
    {},
  );

  const [isEditing, setIsEditing] = useState(false);
  const [formState, setFormState] = useState<EditableProfile | null>(null);
  const [focusKey, setFocusKey] = useState<EditableKey | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fieldRefs = useRef<
    Record<string, HTMLInputElement | HTMLSelectElement | HTMLDivElement | null>
  >({});

  const patch = (part: Partial<EditableProfile>) =>
    setFormState((s) => (s ? { ...s, ...part } : s));

  const beginEdit = (focus?: EditableKey) => {
    if (!profile) return;
    setFormState(toEditable(profile));
    setSaveError(null);
    setIsEditing(true);
    if (focus) setFocusKey(focus);
  };

  const cancelEdit = () => {
    setFormState(null);
    setIsEditing(false);
    setSaveError(null);
  };

  // Focus / scroll to a field after entering edit mode via an empty-field prompt.
  useEffect(() => {
    if (!isEditing || !focusKey) return;
    const el = fieldRefs.current[focusKey];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.focus();
    }
    setFocusKey(null);
  }, [isEditing, focusKey]);

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      updateAdopterProfile(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adopter", "me"] });
      setIsEditing(false);
      setFormState(null);
      setSaveError(null);
      toast.success("Profile updated");
    },
    onError: (err) => setSaveError(extractError(err)),
  });

  const handleSave = () => {
    if (!profile || !formState) return;
    if (!formState.adopterName.trim()) {
      setSaveError("Full name can't be empty.");
      return;
    }
    const payload = buildPayload(toEditable(profile), formState);
    if (Object.keys(payload).length === 0) {
      cancelEdit();
      return;
    }
    setSaveError(null);
    mutation.mutate(payload);
  };

  // Stub — real flow is a separate task.
  const handleVerifyEmail = () => toast("Email verification is coming soon.");

  const [isCloseAccountOpen, setIsCloseAccountOpen] = useState(false);

  // ————————————————————————————————————————————————————————————

  const renderView = (field: FieldDef) => {
    if (!profile) return null;

    if (field.type === "breed") {
      if (profile.preferredBreedID == null)
        return <EmptyPrompt field={field} onAdd={beginEdit} />;
      if (!breedsSettled) {
        return (
          <span className="inline-block h-4 w-24 animate-pulse rounded bg-neutral-lightgray align-middle" />
        );
      }
      const match = breeds.find((b) => b.breedID === profile.preferredBreedID);
      return match ? match.breedName : `#${profile.preferredBreedID}`;
    }

    const raw = (profile as unknown as Record<string, unknown>)[field.key];

    if (raw === null || raw === undefined || raw === "") {
      return field.nullable ? (
        <EmptyPrompt field={field} onAdd={beginEdit} />
      ) : (
        <span className="text-neutral-gray">—</span>
      );
    }
    if (field.type === "boolean") return raw ? "Yes" : "No";
    if (field.type === "date") {
      // Date-only value — parse as local (no "Z") to avoid a timezone shift.
      return formatShortDate(new Date(`${String(raw).slice(0, 10)}T00:00:00`));
    }
    if (field.type === "select") return optionLabel(field.key, String(raw));
    if (field.type === "phone") return <PhoneDisplay value={String(raw)} />;
    return String(raw);
  };

  const renderInput = (field: FieldDef) => {
    if (!formState) return null;
    const setRef = (el: HTMLInputElement | HTMLSelectElement | null) => {
      fieldRefs.current[field.key] = el;
    };

    if (field.type === "boolean") {
      const checked = Boolean(formState[field.key]);
      return (
        <label className="inline-flex items-center gap-2">
          <input
            ref={setRef as (el: HTMLInputElement | null) => void}
            type="checkbox"
            checked={checked}
            onChange={(e) =>
              patch({
                [field.key]: e.target.checked,
              } as Partial<EditableProfile>)
            }
            className="h-4 w-4 accent-teal-dark"
          />
          <span className="font-body text-sm text-neutral-dark">
            {checked ? "Yes" : "No"}
          </span>
        </label>
      );
    }

    if (field.type === "select") {
      const value = (formState[field.key] as string | null) ?? "";
      return (
        <select
          ref={setRef}
          value={value}
          onChange={(e) =>
            patch({
              [field.key]: e.target.value === "" ? null : e.target.value,
            } as Partial<EditableProfile>)
          }
          className={inputClass}
        >
          <option value="">— Select —</option>
          {(ENUM_VALUES[field.key] ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {optionLabel(field.key, opt)}
            </option>
          ))}
        </select>
      );
    }

    if (field.type === "breed") {
      const value = formState.preferredBreedID;
      return (
        <select
          ref={setRef}
          value={value == null ? "" : String(value)}
          onChange={(e) =>
            patch({
              preferredBreedID:
                e.target.value === "" ? null : Number(e.target.value),
            })
          }
          className={inputClass}
        >
          <option value="">— Select —</option>
          {Object.entries(breedsBySpecies).map(([species, list]) => (
            <optgroup key={species} label={species}>
              {list.map((b) => (
                <option key={b.breedID} value={b.breedID}>
                  {b.breedName}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      );
    }

    if (field.type === "phone") {
      const value = formState[field.key] as string | null;
      return (
        <div
          ref={(el) => {
            fieldRefs.current[field.key] = el;
          }}
          tabIndex={-1}
        >
          <PhoneInputField
            value={value}
            onChange={(next) =>
              patch({ [field.key]: next ?? null } as Partial<EditableProfile>)
            }
          />
        </div>
      );
    }

    if (field.type === "number") {
      const value = formState[field.key] as number | null;
      return (
        <input
          ref={setRef}
          type="number"
          min={0}
          value={value == null ? "" : value}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") {
              patch({
                [field.key]: field.nullable ? null : 0,
              } as Partial<EditableProfile>);
              return;
            }
            const n = Math.max(0, Math.trunc(Number(raw)));
            patch({
              [field.key]: Number.isFinite(n) ? n : 0,
            } as Partial<EditableProfile>);
          }}
          className={inputClass}
        />
      );
    }

    // text / date
    const value = (formState[field.key] as string | null) ?? "";
    return (
      <input
        ref={setRef}
        type={field.type === "date" ? "date" : "text"}
        value={value}
        maxLength={field.maxLength}
        onChange={(e) =>
          patch({
            [field.key]:
              e.target.value === "" && field.nullable ? null : e.target.value,
          } as Partial<EditableProfile>)
        }
        className={inputClass}
      />
    );
  };

  // ————————————————————————————————————————————————————————————

  return (
    <div className="mx-auto max-w-3xl">
      <DashboardHeading
        title="Profile"
        emoji="👤"
        message="Manage your account and adoption preferences"
      />

      {profileQuery.isLoading && (
        <p className="font-body text-sm text-neutral-gray">Loading profile…</p>
      )}

      {profileQuery.isError && (
        <p className="font-body text-sm text-rose-dark">
          Couldn't load your profile: {extractError(profileQuery.error)}
        </p>
      )}

      {profile && (
        <>
          {/* Identity strip — account metadata, never editable (except the
              avatar, which re-rolls via formState like any other field) */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-rose-light pb-5">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Avatar
                  seed={
                    isEditing && formState
                      ? formState.avatarSeed
                      : profile.avatarSeed
                  }
                  size={72}
                  className="h-16 w-16 rounded-full border border-rose-light bg-white md:h-[72px] md:w-[72px]"
                />
                {isEditing && (
                  <button
                    type="button"
                    onClick={() => patch({ avatarSeed: crypto.randomUUID() })}
                    aria-label="Randomize avatar"
                    title="Randomize avatar"
                    className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-rose-dark text-white shadow-sm transition-colors hover:brightness-90"
                  >
                    <PiArrowsClockwiseBold className="h-3.5 w-3.5" aria-hidden />
                  </button>
                )}
              </div>
              <div>
                <p className="font-display text-2xl text-rose-md md:text-3xl">
                  {profile.adopterName}
                </p>
                <p className="mt-1 font-body text-xs text-neutral-gray">
                  Joined on {formatShortDate(new Date(profile.createdAt))}
                  {profile.lastLoginAt && (
                    <> · Last login {formatShortDate(new Date(profile.lastLoginAt))}</>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {profile.preQualifyFlag && (
                <span
                  className="inline-flex items-center gap-1.5 font-body text-sm font-medium text-gold-dark"
                  title="Pre-qualified based on experience and history — applications are fast-tracked"
                >
                  <PiLightningFill className="h-4 w-4" aria-hidden />
                  Pre-qualified
                </span>
              )}
              {profile.emailVerified ? (
                <span className="inline-flex items-center gap-1.5 font-body text-sm font-medium text-teal-dark">
                  <PiSealCheck className="h-4 w-4" aria-hidden />
                  Email verified
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleVerifyEmail}
                  className="rounded-xl border border-rose-dark px-4 py-1.5 font-body text-sm font-medium text-rose-dark transition-colors hover:bg-rose-dark hover:text-white"
                >
                  Verify email
                </button>
              )}
            </div>
          </div>

          {/* Sections */}
          <div className="space-y-5">
            {SECTIONS.map((section) => (
              <section
                key={section.title}
                className="rounded-2xl border border-rose-light bg-white p-5 md:p-6"
              >
                <h2 className="mb-4 font-display text-lg text-neutral-dark">
                  {section.title}
                </h2>
                <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                  {section.fields.map((field) => (
                    <div key={field.key}>
                      <dt className="font-body text-xs text-neutral-gray">
                        {field.label}
                      </dt>
                      <dd className="mt-1 font-body text-sm text-neutral-dark">
                        {isEditing ? renderInput(field) : renderView(field)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>

          {/* Save error */}
          {saveError && (
            <p className="mt-4 rounded-lg bg-rose-lightest px-4 py-2 font-body text-sm text-rose-dark">
              {saveError}
            </p>
          )}

          {/* Actions */}
          <div className="mt-6 flex justify-end gap-3">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={mutation.isPending}
                  className="rounded-xl border border-neutral-gray px-5 py-2 font-body text-sm font-medium text-neutral-dark transition-colors hover:bg-neutral-lightgray disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={mutation.isPending}
                  className="rounded-xl bg-rose-dark px-5 py-2 font-body text-sm font-medium text-white transition-colors hover:brightness-90 disabled:opacity-50"
                >
                  {mutation.isPending ? "Saving…" : "Save"}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => beginEdit()}
                className="rounded-xl bg-rose-dark px-5 py-2 font-body text-sm font-medium text-white transition-colors hover:brightness-90"
              >
                Edit profile
              </button>
            )}
          </div>

          {/* Danger zone */}
          <div className="mt-10 rounded-2xl border border-rose-md bg-rose-lightest p-5 md:p-6">
            <h2 className="font-display text-lg text-rose-dark">Danger zone</h2>
            <p className="mt-1 font-body text-sm text-neutral-charcoal">
              Closing your account removes your profile, applications and saved
              pets. This can't be undone.
            </p>
            <button
              type="button"
              onClick={() => setIsCloseAccountOpen(true)}
              className="mt-4 rounded-xl border border-rose-dark px-4 py-2 font-body text-sm font-medium text-rose-dark transition-colors hover:bg-rose-dark hover:text-white"
            >
              Close account
            </button>
          </div>
        </>
      )}

      <CloseAccountModal
        isOpen={isCloseAccountOpen}
        onClose={() => setIsCloseAccountOpen(false)}
      />
    </div>
  );
};

// Inline prompt shown in place of an empty nullable field's value.
const EmptyPrompt = ({
  field,
  onAdd,
}: {
  field: FieldDef;
  onAdd: (focus: EditableKey) => void;
}) => (
  <button
    type="button"
    onClick={() => onAdd(field.key)}
    className="font-body text-sm italic text-rose-dark hover:underline"
  >
    Add {field.label.toLowerCase()}
  </button>
);

export default AdopterProfile;
