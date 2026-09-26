// Profile.tsx
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import toast from "react-hot-toast";
import { PiArrowsClockwiseBold } from "react-icons/pi";
import DashboardHeading from "../../../../components/ui/dashboard/DashboardHeading";
import ButtonElement from "../../../../components/ui/ButtonElement";
import Avatar from "../../../../components/ui/Avatar";
import Badge, { type BadgeTone } from "../../../../components/ui/Badge";
import PhoneInputField from "../../../../components/ui/PhoneInputField";
import PhoneDisplay from "../../../../components/ui/PhoneDisplay";
import CloseAccountModal from "./shared/CloseAccountModal";
import GovernmentIdSection from "./shared/GovernmentIdSection";
import {
  getMyAdminProfile,
  updateMyAdminProfile,
  type AdminAccountStatus,
  type AdminListItem,
} from "../../../../logic/api/adminsApi";
import {
  formatShortDate,
  formatFullDate,
} from "../../../../logic/utils/datetime";
import type { Address } from "../../../../logic/utils/address";
import ProfileAddressSection from "../../../../components/ui/profile/ProfileAddressSection";
import EmailVerificationStatus from "../../../../components/ui/profile/EmailVerificationStatus";

const STATUS_TONE: Record<AdminAccountStatus, BadgeTone> = {
  Pending: "gold",
  Active: "green",
  Deactivated: "gray",
};

// Mirrors adopter Profile.tsx's SEX_LABELS/adopterSex handling.
const SEX_VALUES = ["M", "F", "O"];
const SEX_LABELS: Record<string, string> = {
  M: "Male",
  F: "Female",
  O: "Other",
};

interface EditableProfile extends Address {
  avatarSeed: string;
  adminName: string;
  adminPhone: string | null;
  adminDOB: string | null; // "YYYY-MM-DD"
  adminSex: string | null;
}

const toEditable = (p: AdminListItem): EditableProfile => ({
  avatarSeed: p.avatarSeed,
  adminName: p.adminName,
  adminPhone: p.adminPhone,
  addressLine1: p.addressLine1,
  addressLine2: p.addressLine2,
  city: p.city,
  state: p.state,
  zip: p.zip,
  country: p.country,
  adminDOB: p.adminDOB ? p.adminDOB.slice(0, 10) : null,
  adminSex: p.adminSex,
});

// Only send fields the admin actually changed — the endpoint is happy with
// a partial body.
const buildPayload = (original: EditableProfile, next: EditableProfile) => {
  const payload: Record<string, unknown> = {};
  (Object.keys(next) as (keyof EditableProfile)[]).forEach((key) => {
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

const Profile = () => {
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ["admin", "me"],
    queryFn: getMyAdminProfile,
  });
  const profile = profileQuery.data;

  const [isEditing, setIsEditing] = useState(false);
  const [formState, setFormState] = useState<EditableProfile | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isCloseAccountOpen, setIsCloseAccountOpen] = useState(false);

  const patch = (part: Partial<EditableProfile>) =>
    setFormState((s) => (s ? { ...s, ...part } : s));

  const beginEdit = () => {
    if (!profile) return;
    setFormState(toEditable(profile));
    setSaveError(null);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setFormState(null);
    setIsEditing(false);
    setSaveError(null);
  };

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      updateMyAdminProfile(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "me"] });
      setIsEditing(false);
      setFormState(null);
      setSaveError(null);
      toast.success("Profile updated");
    },
    onError: (err) => setSaveError(extractError(err)),
  });

  const handleSave = () => {
    if (!profile || !formState) return;
    if (!formState.adminName.trim()) {
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

  return (
    <div className="mx-auto max-w-3xl">
      <DashboardHeading
        title="Profile"
        emoji="👤"
        message="Manage your admin account"
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
              <div className="relative shrink-0">
                <Avatar
                  seed={
                    isEditing && formState
                      ? formState.avatarSeed
                      : profile.avatarSeed
                  }
                  size={72}
                  className="h-16 w-16 shrink-0 rounded-full border border-rose-light bg-white md:h-[72px] md:w-[72px]"
                />
                {isEditing && (
                  <ButtonElement
                    onClick={() => patch({ avatarSeed: crypto.randomUUID() })}
                    aria-label="Randomize avatar"
                    title="Randomize avatar"
                    size="bare"
                    variant="outline"
                    className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-rose-dark text-white shadow-sm transition-colors hover:brightness-95"
                  >
                    <PiArrowsClockwiseBold
                      className="h-3.5 w-3.5"
                      aria-hidden
                    />
                  </ButtonElement>
                )}
              </div>
              <div>
                <p className="font-display text-2xl text-rose-md md:text-3xl">
                  {profile.adminName}
                </p>
                <p className="mt-1 font-body text-xs text-neutral-gray">
                  Joined on {formatShortDate(new Date(profile.createdAt))}
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
                <Badge tone={STATUS_TONE[profile.accountStatus]}>
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
              <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                <div>
                  <dt className="font-body text-xs text-neutral-gray">
                    Full name
                  </dt>
                  <dd className="mt-1 font-body text-sm text-neutral-dark">
                    {isEditing && formState ? (
                      <input
                        type="text"
                        value={formState.adminName}
                        maxLength={45}
                        onChange={(e) => patch({ adminName: e.target.value })}
                        className={inputClass}
                      />
                    ) : (
                      profile.adminName
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="font-body text-xs text-neutral-gray">Phone</dt>
                  <dd className="mt-1 font-body text-sm text-neutral-dark">
                    {isEditing && formState ? (
                      <PhoneInputField
                        value={formState.adminPhone}
                        onChange={(next) => patch({ adminPhone: next ?? null })}
                      />
                    ) : profile.adminPhone ? (
                      <PhoneDisplay value={profile.adminPhone} />
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
                    {isEditing && formState ? (
                      <input
                        type="date"
                        value={formState.adminDOB ?? ""}
                        onChange={(e) =>
                          patch({ adminDOB: e.target.value || null })
                        }
                        className={inputClass}
                      />
                    ) : profile.adminDOB ? (
                      formatShortDate(
                        new Date(`${profile.adminDOB.slice(0, 10)}T00:00:00`),
                      )
                    ) : (
                      <span className="text-neutral-gray">—</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="font-body text-xs text-neutral-gray">Sex</dt>
                  <dd className="mt-1 font-body text-sm text-neutral-dark">
                    {isEditing && formState ? (
                      <select
                        value={formState.adminSex ?? ""}
                        onChange={(e) =>
                          patch({ adminSex: e.target.value || null })
                        }
                        className={inputClass}
                      >
                        <option value="">— Select —</option>
                        {SEX_VALUES.map((opt) => (
                          <option key={opt} value={opt}>
                            {SEX_LABELS[opt]}
                          </option>
                        ))}
                      </select>
                    ) : profile.adminSex ? (
                      (SEX_LABELS[profile.adminSex] ?? profile.adminSex)
                    ) : (
                      <span className="text-neutral-gray">—</span>
                    )}
                  </dd>
                </div>
                {profile.statusChangedAt && (
                  <div>
                    <dt className="font-body text-xs text-neutral-gray">
                      Last status change
                    </dt>
                    <dd className="mt-1 font-body text-sm text-neutral-dark">
                      {formatFullDate(new Date(profile.statusChangedAt))}
                      {profile.statusChangedBy && (
                        <> by {profile.statusChangedBy.adminName}</>
                      )}
                    </dd>
                  </div>
                )}
              </dl>
              <GovernmentIdSection isEditing={isEditing} />
            </section>

            <ProfileAddressSection
              value={profile}
              isEditing={isEditing}
              draft={formState}
              onChange={patch}
            />
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
                  className="rounded-xl bg-red px-5 py-2 font-body text-sm font-medium hover:brightness-95 disabled:opacity-50"
                >
                  Cancel
                </ButtonElement>
                <ButtonElement
                  onClick={handleSave}
                  disabled={mutation.isPending}
                  size="bare"
                  className="rounded-xl bg-teal-dark px-5 py-2 font-body text-sm font-medium hover:brightness-95 disabled:opacity-50"
                >
                  {mutation.isPending ? "Saving…" : "Save"}
                </ButtonElement>
              </>
            ) : (
              <ButtonElement
                onClick={beginEdit}
                size="bare"
                className="rounded-xl bg-teal-dark px-5 py-2 font-body text-sm font-medium hover:brightness-95"
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
              className="mt-4 rounded-xl bg-red px-4 py-2 font-body text-sm font-medium hover:brightness-95"
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
