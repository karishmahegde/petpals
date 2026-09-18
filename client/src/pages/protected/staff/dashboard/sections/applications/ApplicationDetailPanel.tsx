// ApplicationDetailPanel.tsx
// Detail slide-over for one adoption application, staff/admin side — opened
// from an Applications row's "View Details" (and deep-linked via
// ?applicationID from the Overview widget). Mirrors the adopter dashboard's
// own ApplicationDetailPanel (same pet-summary banner, same info-row
// layout) with three differences: an Adopter info section (the applicant's
// name/email — meaningless on the adopter's own copy, essential here),
// Accept/Reject actions instead of Withdraw, and a staffRemark textarea on
// both confirmations (the backend accepts it on either transition).
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import toast from "react-hot-toast";
import { FaPaw } from "react-icons/fa";
import {
  getApplicationById,
  reviewApplication,
  type StaffReviewStatus,
} from "../../../../../../logic/api/adoptionApplicationsApi";
import SlideOver from "../../../../../../components/ui/SlideOver";
import ButtonElement from "../../../../../../components/ui/ButtonElement";
import Badge, { type BadgeTone } from "../../../../../../components/ui/Badge";
import ConfirmActionModal from "../../../../../../components/ui/ConfirmActionModal";
import { formatFullDate } from "../../../../../../logic/utils/datetime";

interface ApplicationDetailPanelProps {
  applicationID: number | null;
  onClose: () => void;
}

type ApplicationStatus = "Pending" | "Accepted" | "Rejected" | "Withdrawn";

const STATUS_TONE: Record<ApplicationStatus, BadgeTone> = {
  Pending: "gold",
  Accepted: "green",
  Rejected: "red",
  Withdrawn: "gray",
};

const GOVERNMENT_ID_TONE: Record<"Pending" | "Verified" | "Rejected", BadgeTone> = {
  Pending: "gold",
  Verified: "green",
  Rejected: "red",
};

const MAX_REMARK_LEN = 500; // schema.prisma: staffRemark is VarChar(500)

const label = "font-body text-sm font-semibold text-teal-dark";
const value = "font-body text-sm text-neutral-charcoal";
const sectionHeading =
  "mt-4 font-body text-sm font-semibold text-neutral-dark";
const quoteBlock = "mt-1 font-body text-sm italic text-neutral-charcoal";
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

const ApplicationDetailPanel = ({
  applicationID,
  onClose,
}: ApplicationDetailPanelProps) => {
  const queryClient = useQueryClient();
  const [pendingAction, setPendingAction] = useState<StaffReviewStatus | null>(
    null,
  );
  const [remark, setRemark] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["staff", "application", applicationID],
    queryFn: () => getApplicationById(applicationID!),
    enabled: applicationID !== null,
  });

  const closeConfirm = () => {
    setPendingAction(null);
    setRemark("");
  };

  const review = useMutation({
    mutationFn: (status: StaffReviewStatus) =>
      reviewApplication(applicationID!, {
        status,
        staffRemark: remark.trim() || undefined,
      }),
    onSuccess: (_, status) => {
      // Accepting also marks the pet adopted server-side — the pets grid
      // needs to reflect that too, not just the applications queue.
      queryClient.invalidateQueries({
        queryKey: ["staff", "applications-queue"],
      });
      queryClient.invalidateQueries({ queryKey: ["staff", "shelter-pets"] });
      queryClient.invalidateQueries({
        queryKey: ["staff", "application", applicationID],
      });
      toast.success(
        status === "Accepted" ? "Application accepted" : "Application rejected",
      );
      closeConfirm();
      onClose();
    },
    onError: (err) => toast.error(extractError(err)),
  });

  const showActions = data?.applicationStatus === "Pending";

  return (
    <>
      <SlideOver
        open={applicationID !== null}
        onClose={onClose}
        title="Application Details"
        footer={
          showActions && (
            <div className="flex flex-col gap-3">
              <ButtonElement
                onClick={() => setPendingAction("Accepted")}
                size="panel"
                className="bg-green hover:brightness-95"
              >
                Accept
              </ButtonElement>
              <ButtonElement
                onClick={() => setPendingAction("Rejected")}
                size="panel"
                variant="outline"
                className="border border-rose-dark text-rose-dark hover:bg-rose-dark hover:text-white"
              >
                Reject
              </ButtonElement>
            </div>
          )
        }
      >
        {isLoading && (
          <p className="p-8 text-center text-sm text-neutral-gray">
            Loading application…
          </p>
        )}
        {isError && (
          <p className="p-8 text-center text-sm text-rose-dark">
            Couldn't load this application. Please try again.
          </p>
        )}

        {data && (
          <div className="p-6">
            {/* Pet summary */}
            <div className="flex items-center gap-4 rounded-xl border-2 border-gold bg-gold-lightest p-4">
              {data.pet.petPhoto ? (
                <img
                  src={data.pet.petPhoto}
                  alt={`${data.pet.petName} photo`}
                  className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-teal-dark"
                />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-neutral-offwhite ring-2 ring-teal-dark">
                  <FaPaw className="h-6 w-6 text-rose-md" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-body font-bold text-neutral-charcoal">
                  {data.pet.petName}
                </p>
                <p className="truncate text-xs text-neutral-gray">
                  {data.pet.breedName} · {data.shelter.shelterName}
                </p>
              </div>
            </div>

            {/* Adopter details */}
            <h3 className={sectionHeading}>Adopter Details</h3>
            <dl className="mt-2 grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2">
              <InfoRow k="Name" v={data.adopter.adopterName} />
              <InfoRow k="Email" v={data.adopter.adopterEmail} />
              <InfoRow k="Phone" v={data.adopter.adopterPhone ?? "—"} />
              <InfoRow k="Housing Type" v={data.adopter.housingType ?? "—"} />
              <InfoRow k="Ownership Type" v={data.adopter.ownsOrRents ?? "—"} />
              <InfoRow k="Landlord Contact" v={data.adopter.landlordContact ?? "—"} />
              <InfoRow k="Household Size" v={data.adopter.householdSize ?? "—"} />
              <InfoRow k="No. of Children" v={data.adopter.numChildren ?? "—"} />
              <dt className={label}>Government ID</dt>
              <dd>
                {data.governmentIdStatus ? (
                  <Badge tone={GOVERNMENT_ID_TONE[data.governmentIdStatus]}>
                    {data.governmentIdStatus}
                  </Badge>
                ) : (
                  <Badge tone="gray">Not Submitted</Badge>
                )}
              </dd>
            </dl>
            {data.adopter.preQualifyFlag && (
              <Badge tone="green" className="mt-3">
                Pre Approved
              </Badge>
            )}

            {/* Application info */}
            <div className={divider} />
            <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2">
              <InfoRow k="Application ID" v={`#${data.applicationCode}`} />
              <InfoRow
                k="Submitted on"
                v={formatFullDate(new Date(data.createdAt))}
              />
              <InfoRow k="Adoption Type" v={data.applicationType} />
              <InfoRow
                k="Assigned staff"
                v={data.assignedStaffName ?? "Not assigned yet"}
              />
              <dt className={label}>Status</dt>
              <dd>
                <Badge tone={STATUS_TONE[data.applicationStatus]}>
                  {data.applicationStatus}
                </Badge>
              </dd>
            </dl>

            {/* Applicant's message */}
            <div className={divider} />
            <h3 className={sectionHeading}>Applicant's Message</h3>
            <p className={quoteBlock}>
              {data.shelterMessage
                ? `"${data.shelterMessage}"`
                : "No message was sent with this application."}
            </p>

            {/* Remarks from shelter */}
            <h3 className={sectionHeading}>Remarks from Shelter</h3>
            <p className="mt-1 rounded-lg border border-neutral-lightgray bg-neutral-offwhite p-3 font-body text-sm text-neutral-charcoal">
              {data.staffRemark || "No remarks yet."}
            </p>
          </div>
        )}
      </SlideOver>

      <ConfirmActionModal
        isOpen={pendingAction !== null}
        title={
          pendingAction === "Rejected" ? "Reject application?" : "Accept application?"
        }
        confirmLabel={pendingAction === "Rejected" ? "Reject" : "Accept"}
        isPending={review.isPending}
        onCancel={closeConfirm}
        onConfirm={() => pendingAction && review.mutate(pendingAction)}
      >
        {data && (
          <div className="flex flex-col gap-3">
            <p>
              {pendingAction === "Rejected" ? (
                <>
                  This rejects the application for{" "}
                  <strong>{data.pet.petName}</strong> from{" "}
                  {data.adopter.adopterName}. They'll be able to apply again
                  for a different pet.
                </>
              ) : (
                <>
                  This accepts the application for{" "}
                  <strong>{data.pet.petName}</strong> from{" "}
                  {data.adopter.adopterName}, and marks {data.pet.petName} as
                  adopted.
                </>
              )}
            </p>

            <div>
              <label
                htmlFor="review-remark"
                className="font-body text-xs text-neutral-gray"
              >
                {pendingAction === "Rejected"
                  ? "Remark for the applicant (optional)"
                  : "Welcome note for the adopter (optional)"}
              </label>
              <textarea
                id="review-remark"
                rows={3}
                maxLength={MAX_REMARK_LEN}
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                className="mt-1 w-full rounded-lg border border-rose-light bg-white px-3 py-1.5 font-body text-sm text-neutral-dark focus:border-teal-dark focus:outline-none"
              />
            </div>
          </div>
        )}
      </ConfirmActionModal>
    </>
  );
};

export default ApplicationDetailPanel;
