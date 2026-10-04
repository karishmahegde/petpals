// Profile.tsx
// Self-service profile view/edit for a volunteer — same layout as the vet
// and staff dashboards' Profile.tsx (identity strip with last login + email
// verification, Personal and Address cards, government ID, danger zone).
// Editing reuses the onboarding wizard's PersonalFields + AddressFields, so
// the profile validates exactly like the Personal and Address steps did
// (phone, DOB, sex and a complete address are all required there too).
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import toast from "react-hot-toast";
import DashboardHeading from "../../../../components/ui/dashboard/DashboardHeading";
import ButtonElement from "../../../../components/ui/ButtonElement";
import Avatar from "../../../../components/ui/Avatar";
import Badge from "../../../../components/ui/Badge";
import PhoneDisplay from "../../../../components/ui/PhoneDisplay";
import PersonalFields, {
  type PersonalValues,
} from "../../../../components/ui/onboarding/PersonalFields";
import AddressFields from "../../../../components/ui/onboarding/AddressFields";
import ProfileAddressSection from "../../../../components/ui/profile/ProfileAddressSection";
import EmailVerificationStatus from "../../../../components/ui/profile/EmailVerificationStatus";
import CloseAccountModal from "./shared/CloseAccountModal";
import GovernmentIdSection from "../../shared/GovernmentIdSection";
import {
  getMyVolunteerProfile,
  updateMyVolunteerProfile,
  volunteerGovernmentIdApi,
  type VolunteerSelfProfile,
} from "../../../../logic/api/volunteersApi";
import { VOLUNTEER_STATUS_TONE } from "../../../../logic/staff/volunteerStatus";
import {
  isAddressComplete,
  isValidZipForCountry,
  toAddressPayload,
  type Address,
} from "../../../../logic/utils/address";
import { formatShortDate } from "../../../../logic/utils/datetime";
import useAuthStore from "../../../../logic/store/useAuthStore";

const SEX_LABELS: Record<string, string> = {
  M: "Male",
  F: "Female",
  O: "Other",
};

interface Draft {
  volunteerName: string;
  personal: PersonalValues;
  address: Address;
}

const toDraft = (p: VolunteerSelfProfile): Draft => ({
  volunteerName: p.volunteerName,
  personal: {
    avatarSeed: p.avatarSeed,
    dob: p.volunteerDOB ? p.volunteerDOB.slice(0, 10) : "",
    sex: p.volunteerSex ?? "",
    phone: p.volunteerPhone ?? undefined,
  },
  address: {
    addressLine1: p.addressLine1 ?? "",
    addressLine2: p.addressLine2 ?? "",
    city: p.city ?? "",
    state: p.state ?? "",
    zip: p.zip ?? "",
    country: p.country ?? "",
  },
});

// The full PUT /volunteers/me body for a draft, in the API's field names.
const toPayload = (d: Draft): Record<string, unknown> => ({
  volunteerName: d.volunteerName.trim(),
  avatarSeed: d.personal.avatarSeed,
  volunteerDOB: d.personal.dob,
  volunteerSex: d.personal.sex,
  volunteerPhone: d.personal.phone,
  ...toAddressPayload(d.address),
});

// Only send fields the volunteer actually changed — the endpoint is happy with a
// partial body.
const buildPayload = (original: Draft, next: Draft) => {
  const before = toPayload(original);
  const after = toPayload(next);
  const payload: Record<string, unknown> = {};
  Object.keys(after).forEach((key) => {
    if (after[key] !== before[key]) payload[key] = after[key];
  });
  return payload;
};

// Same required fields as the onboarding Personal + Address steps.
const validate = (d: Draft): string | null => {
  if (!d.volunteerName.trim()) return "Full name can't be empty.";
  if (!d.personal.dob || !d.personal.sex || !d.personal.phone) {
    return "Please fill in your date of birth, sex and phone.";
  }
  if (!isAddressComplete(d.address)) {
    return "Please fill in all required address fields.";
  }
  if (!isValidZipForCountry(d.address.zip, d.address.country)) {
    return "Please enter a valid ZIP/postal code for the selected country.";
  }
  return null;
};

const extractError = (err: unknown): string =>
  axios.isAxiosError(err) && err.response?.data?.message
    ? String(err.response.data.message)
    : "Something went wrong. Please try again.";

const inputClass =
  "w-full rounded-lg border border-rose-light bg-white px-3 py-1.5 font-body text-sm text-neutral-dark focus:border-teal-dark focus:outline-none";

const Profile = () => {
  const queryClient = useQueryClient();
  const updateUser = useAuthStore((state) => state.updateUser);

  const profileQuery = useQuery({
    queryKey: ["volunteer", "me"],
    queryFn: getMyVolunteerProfile,
  });
  const profile = profileQuery.data;

  const [draft, setDraft] = useState<Draft | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isCloseAccountOpen, setIsCloseAccountOpen] = useState(false);
  const isEditing = draft !== null;

  const beginEdit = () => {
    if (!profile) return;
    setDraft(toDraft(profile));
    setSaveError(null);
  };

  const cancelEdit = () => {
    setDraft(null);
    setSaveError(null);
  };

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      updateMyVolunteerProfile(payload),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["volunteer", "me"] });
      // The sidebar reads the name and avatar from the session, not this
      // query — patch them so a change shows immediately, not after reload.
      updateUser({ name: saved.volunteerName, avatarSeed: saved.avatarSeed });
      setDraft(null);
      setSaveError(null);
      toast.success("Profile updated");
    },
    onError: (err) => setSaveError(extractError(err)),
  });

  const handleSave = () => {
    if (!profile || !draft) return;
    const error = validate(draft);
    if (error) {
      setSaveError(error);
      return;
    }
    const payload = buildPayload(toDraft(profile), draft);
    if (Object.keys(payload).length === 0) {
      cancelEdit();
      return;
    }
    setSaveError(null);
    mutation.mutate(payload);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <DashboardHeading
        title="Profile"
        emoji="👤"
        message="Manage your volunteer account"
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
          {/* Identity strip — account metadata, never editable here (the
              avatar re-rolls inside PersonalFields while editing) */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-rose-light pb-5">
            <div className="flex items-center gap-4">
              <Avatar
                seed={draft ? draft.personal.avatarSeed : profile.avatarSeed}
                size={72}
                className="h-16 w-16 shrink-0 rounded-full border border-rose-light bg-white md:h-[72px] md:w-[72px]"
              />
              <div>
                <p className="font-display text-2xl text-rose-md md:text-3xl">
                  {profile.volunteerName}
                </p>
                <p className="mt-1 font-body text-xs text-neutral-gray">
                  Volunteer
                  {profile.volunteerCode && <> · {profile.volunteerCode}</>}
                  {profile.shelter?.shelterName && (
                    <> at {profile.shelter.shelterName}</>
                  )}
                  {profile.createdAt && (
                    <> · Joined {formatShortDate(new Date(profile.createdAt))}</>
                  )}
                  {profile.lastLoginAt && (
                    <>
                      {" "}
                      · Last login{" "}
                      {formatShortDate(new Date(profile.lastLoginAt))}
                    </>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <EmailVerificationStatus verified={profile.emailVerified} />
              {profile.accountStatus && (
                <Badge tone={VOLUNTEER_STATUS_TONE[profile.accountStatus]}>
                  {profile.accountStatus}
                </Badge>
              )}
            </div>
          </div>

          {/* Sections */}
          <div className="space-y-5">
            <section className="rounded-2xl border border-rose-light bg-white p-5 md:p-6">
              <h2 className="mb-4 font-display text-lg text-neutral-dark">
                Personal
              </h2>
              {draft ? (
                <>
                  <div className="mb-6 flex flex-col gap-1.5">
                    <label
                      htmlFor="volunteer-profile-name"
                      className="font-body text-xs text-neutral-gray"
                    >
                      Full name
                    </label>
                    <input
                      id="volunteer-profile-name"
                      type="text"
                      value={draft.volunteerName}
                      maxLength={45}
                      onChange={(e) =>
                        setDraft({ ...draft, volunteerName: e.target.value })
                      }
                      className={inputClass}
                    />
                  </div>
                  <PersonalFields
                    value={draft.personal}
                    onChange={(patch) =>
                      setDraft({
                        ...draft,
                        personal: { ...draft.personal, ...patch },
                      })
                    }
                  />
                </>
              ) : (
                <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                  <div>
                    <dt className="font-body text-xs text-neutral-gray">
                      Full name
                    </dt>
                    <dd className="mt-1 font-body text-sm text-neutral-dark">
                      {profile.volunteerName}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-body text-xs text-neutral-gray">
                      Email
                    </dt>
                    <dd className="mt-1 break-all font-body text-sm text-neutral-dark">
                      {profile.user.userEmail}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-body text-xs text-neutral-gray">
                      Phone
                    </dt>
                    <dd className="mt-1 font-body text-sm text-neutral-dark">
                      {profile.volunteerPhone ? (
                        <PhoneDisplay value={profile.volunteerPhone} />
                      ) : (
                        <span className="text-neutral-gray">—</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-body text-xs text-neutral-gray">
                      Date of birth
                    </dt>
                    <dd className="mt-1 font-body text-sm text-neutral-dark">
                      {profile.volunteerDOB ? (
                        formatShortDate(
                          new Date(`${profile.volunteerDOB.slice(0, 10)}T00:00:00`),
                        )
                      ) : (
                        <span className="text-neutral-gray">—</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-body text-xs text-neutral-gray">Sex</dt>
                    <dd className="mt-1 font-body text-sm text-neutral-dark">
                      {profile.volunteerSex ? (
                        (SEX_LABELS[profile.volunteerSex] ?? profile.volunteerSex)
                      ) : (
                        <span className="text-neutral-gray">—</span>
                      )}
                    </dd>
                  </div>
                </dl>
              )}
              <GovernmentIdSection
                api={volunteerGovernmentIdApi}
                isEditing={isEditing}
              />
            </section>

            {draft ? (
              <section className="rounded-2xl border border-rose-light bg-white p-5 md:p-6">
                <h2 className="mb-4 font-display text-lg text-neutral-dark">
                  Address
                </h2>
                <AddressFields
                  value={draft.address}
                  onChange={(patch) =>
                    setDraft({
                      ...draft,
                      address: { ...draft.address, ...patch },
                    })
                  }
                />
              </section>
            ) : (
              <ProfileAddressSection
                value={profile}
                isEditing={false}
                draft={null}
                onChange={() => {}}
              />
            )}
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
                <ButtonElement
                  onClick={cancelEdit}
                  disabled={mutation.isPending}
                  size="bare"
                  className="rounded-xl bg-red px-5 py-2 text-sm font-medium hover:brightness-95"
                >
                  Cancel
                </ButtonElement>
                <ButtonElement
                  onClick={handleSave}
                  disabled={mutation.isPending}
                  size="bare"
                  className="rounded-xl bg-teal-dark px-5 py-2 text-sm font-medium hover:brightness-95"
                >
                  {mutation.isPending ? "Saving…" : "Save"}
                </ButtonElement>
              </>
            ) : (
              <ButtonElement
                onClick={beginEdit}
                size="bare"
                className="rounded-xl bg-teal-dark px-5 py-2 text-sm font-medium hover:brightness-95"
              >
                Edit profile
              </ButtonElement>
            )}
          </div>

          {/* Danger zone */}
          <div className="mt-10 rounded-2xl border border-rose-md bg-rose-lightest p-5 md:p-6">
            <h2 className="font-display text-lg text-rose-dark">Danger zone</h2>
            <p className="mt-1 font-body text-sm text-neutral-charcoal">
              Closing your account deactivates or permanently deletes it. This
              can't be undone.
            </p>
            <ButtonElement
              onClick={() => setIsCloseAccountOpen(true)}
              size="bare"
              className="mt-4 rounded-xl bg-red px-4 py-2 text-sm font-medium hover:brightness-95"
            >
              Close account
            </ButtonElement>
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

export default Profile;
