// VolunteerDetailPanel.tsx
// Detail slide-over for one volunteer — opened from a Volunteer Approvals or
// All Volunteers row's "View Details". Every Volunteer column (plus login
// email and government ID type/masked number), same identity banner +
// InfoRow layout as the admin StaffDetailPanel; a Pending volunteer also
// shows what approval is waiting on (onboarding, ID status), and the weekly
// availability shows as a grid. Footer: Deactivate Account, only while
// Active, behind ConfirmActionModal.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import toast from "react-hot-toast";
import SlideOver from "../../../../../../components/ui/SlideOver";
import ButtonElement from "../../../../../../components/ui/ButtonElement";
import Avatar from "../../../../../../components/ui/Avatar";
import Badge from "../../../../../../components/ui/Badge";
import ConfirmActionModal from "../../../../../../components/ui/ConfirmActionModal";
import PhoneDisplay from "../../../../../../components/ui/PhoneDisplay";
import {
  getVolunteerDetail,
  updateVolunteerStatus,
} from "../../../../../../logic/api/shelterVolunteersApi";
import { VOLUNTEER_STATUS_TONE } from "../../../../../../logic/staff/volunteerStatus";
import { formatFullDate } from "../../../../../../logic/utils/datetime";
import { formatAddress } from "../../../../../../logic/utils/address";
import { hasAnyAvailability } from "../../../../../../logic/utils/availability";
import { approvalBlockers } from "../../../../../../logic/staff/approvalReadiness";
import AvailabilityGrid from "../../../../../../components/ui/AvailabilityGrid";

interface VolunteerDetailPanelProps {
  userID: number | null;
  onClose: () => void;
}

const label = "font-body text-sm font-semibold text-teal-dark";
const value = "font-body text-sm text-neutral-charcoal";
const sectionHeading = "font-body text-sm font-semibold text-neutral-dark";
const divider = "my-5 border-t border-neutral-lightgray";

const InfoRow = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <>
    <dt className={label}>{k}</dt>
    <dd className={value}>{v}</dd>
  </>
);

const extractError = (err: unknown): string =>
  axios.isAxiosError(err) && err.response?.data?.message
    ? String(err.response.data.message)
    : "Something went wrong. Please try again.";

const VolunteerDetailPanel = ({ userID, onClose }: VolunteerDetailPanelProps) => {
  const queryClient = useQueryClient();
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["staff", "volunteer", userID],
    queryFn: () => getVolunteerDetail(userID!),
    enabled: userID !== null,
  });

  const deactivate = useMutation({
    mutationFn: () => updateVolunteerStatus(userID!, "Deactivated"),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["staff", "volunteers"] });
      queryClient.setQueryData(["staff", "volunteer", userID], updated);
      toast.success("Volunteer deactivated");
      setConfirmingDeactivate(false);
    },
    onError: (err) => toast.error(extractError(err)),
  });

  // What a Pending volunteer's approval is still waiting on (empty = ready).
  const blockers = data ? approvalBlockers(data) : [];

  return (
    <>
      <SlideOver
        open={userID !== null}
        onClose={onClose}
        title="Volunteer Details"
        footer={
          data?.accountStatus === "Active" ? (
            <ButtonElement
              onClick={() => setConfirmingDeactivate(true)}
              size="panel"
              className="w-full bg-red hover:brightness-95"
            >
              Deactivate Account
            </ButtonElement>
          ) : undefined
        }
      >
        {isLoading && (
          <p className="p-8 text-center text-sm text-neutral-gray">
            Loading volunteer…
          </p>
        )}
        {isError && (
          <p className="p-8 text-center text-sm text-rose-dark">
            Couldn't load this volunteer. Please try again.
          </p>
        )}

        {data && (
          <div className="p-6">
            {/* Identity summary */}
            <div className="flex items-center gap-4 rounded-xl border-2 border-gold bg-gold-lightest p-4">
              <Avatar
                seed={data.avatarSeed}
                size={56}
                className="h-14 w-14 shrink-0 rounded-full ring-2 ring-teal-dark"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-body font-bold text-neutral-charcoal">
                  {data.volunteerName}
                </p>
                <p className="truncate text-xs text-neutral-gray">
                  {data.shelterName ?? "No shelter assigned"}
                </p>
              </div>
              <Badge tone={VOLUNTEER_STATUS_TONE[data.accountStatus]}>
                {data.accountStatus}
              </Badge>
            </div>

            {/* Profile info */}
            <dl className="mt-5 grid grid-cols-[9rem_1fr] gap-x-3 gap-y-2">
              <InfoRow k="Volunteer ID" v={data.volunteerCode ?? "—"} />
              <InfoRow k="ID Type" v={data.governmentID?.idType ?? "Not submitted"} />
              <InfoRow k="ID Number" v={data.governmentID?.idNumber ?? "Not submitted"} />
              <InfoRow k="Email" v={data.volunteerEmail} />
              <InfoRow
                k="Phone"
                v={data.volunteerPhone ? <PhoneDisplay value={data.volunteerPhone} /> : "—"}
              />
              <InfoRow
                k="Date of Birth"
                v={data.volunteerDOB ? formatFullDate(new Date(data.volunteerDOB)) : "—"}
              />
              <InfoRow k="Sex" v={data.volunteerSex ?? "—"} />
              <InfoRow k="Address" v={formatAddress(data) || "—"} />
              <InfoRow
                k="Volunteering Since"
                v={formatFullDate(new Date(data.createdAt))}
              />
              {data.accountStatus === "Pending" && (
                <>
                  <InfoRow
                    k="Onboarding"
                    v={
                      data.onboardingComplete
                        ? "Complete"
                        : `Not finished (step ${data.onboardingStep} of 5)`
                    }
                  />
                  <InfoRow
                    k="ID Status"
                    v={
                      <span className="flex flex-wrap items-center gap-x-3">
                        {data.governmentIdStatus ?? "Not submitted"}
                        {data.governmentIdStatus === "Pending" && (
                          <ButtonElement
                            to="/staff/id-verification"
                            size="bare"
                            variant="outline"
                            className="text-sm font-medium text-teal-dark underline"
                          >
                            Verify ID
                          </ButtonElement>
                        )}
                      </span>
                    }
                  />
                </>
              )}
            </dl>

            {data.accountStatus === "Pending" &&
              (blockers.length > 0 ? (
                <div className="mt-5 rounded-lg bg-gold-lightest px-4 py-3 font-body text-sm text-neutral-charcoal">
                  <p className="font-semibold">Can't approve yet</p>
                  <p className="mt-1">{blockers.join(" · ")}</p>
                </div>
              ) : (
                <p className="mt-5 font-body text-xs text-neutral-gray">
                  Onboarding is done and their ID is verified — ready to
                  approve from Volunteer Approvals.
                </p>
              ))}

            {/* Availability — the decoded weekly grid; older free-text
                schedules (availability null) still show as written. */}
            <div className={divider} />
            <h3 className={sectionHeading}>Availability</h3>
            <div className="mt-3">
              {data.availability === null ? (
                <p className={value}>{data.volunteerSchedule}</p>
              ) : hasAnyAvailability(data.availability) ? (
                <AvailabilityGrid value={data.availability} />
              ) : (
                <p className={value}>Not provided</p>
              )}
            </div>
          </div>
        )}
      </SlideOver>

      {data && (
        <ConfirmActionModal
          isOpen={confirmingDeactivate}
          title="Deactivate this volunteer?"
          confirmLabel="Deactivate"
          isPending={deactivate.isPending}
          onCancel={() => setConfirmingDeactivate(false)}
          onConfirm={() => deactivate.mutate()}
        >
          This deactivates {data.volunteerName}'s account. They won't be able
          to log in.
        </ConfirmActionModal>
      )}
    </>
  );
};

export default VolunteerDetailPanel;
