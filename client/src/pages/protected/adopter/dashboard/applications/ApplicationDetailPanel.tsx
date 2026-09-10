// ApplicationDetailPanel.tsx
// Detail slide-over for one adoption application — opened from an Applications
// row's "View Details" (and deep-linked via ?applicationID from the Overview
// widget). Fetch + render only; the generic SlideOver owns the chrome.
// The footer withdraw goes through the same confirm-then-mutate flow as the
// row action, invalidating the same query keys.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FaPaw } from "react-icons/fa";
import {
  getApplicationById,
  withdrawApplication,
} from "../../../../../logic/api/adoptionApplicationsApi";
import SlideOver from "../../../../../components/ui/SlideOver";
import ConfirmActionModal from "../../../../../components/ui/ConfirmActionModal";
import { formatFullDate } from "../../../../../logic/utils/datetime";
import {
  APPLICATION_STATUS_META,
  canWithdraw,
} from "../../../../../logic/adopter/applicationStatus";

interface ApplicationDetailPanelProps {
  applicationID: number | null;
  onClose: () => void;
}

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

const ApplicationDetailPanel = ({
  applicationID,
  onClose,
}: ApplicationDetailPanelProps) => {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["adopter", "application", applicationID],
    queryFn: () => getApplicationById(applicationID!),
    enabled: applicationID !== null,
  });

  const withdraw = useMutation({
    mutationFn: () => withdrawApplication(applicationID!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adopter", "applications"] });
      queryClient.invalidateQueries({
        queryKey: ["adopter", "applications-count"],
      });
      queryClient.invalidateQueries({
        queryKey: ["adopter", "application", applicationID],
      });
      toast.success("Application withdrawn");
      setConfirmOpen(false);
      onClose();
    },
    onError: () =>
      toast.error("Couldn't withdraw the application. Please try again."),
  });

  const status = data && APPLICATION_STATUS_META[data.applicationStatus];
  const showWithdraw = data ? canWithdraw(data.applicationStatus) : false;

  return (
    <>
      <SlideOver
        open={applicationID !== null}
        onClose={onClose}
        title="Application Details"
        footer={
          showWithdraw && (
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="w-full rounded-xl bg-rose-md px-4 py-3 font-body text-sm font-medium text-white transition-colors hover:brightness-95"
            >
              Withdraw Application
            </button>
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

        {data && status && (
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

            {/* Application info */}
            <dl className="mt-5 grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2">
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
                <span
                  className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${status.className}`}
                >
                  {status.label}
                </span>
              </dd>
            </dl>

            {/* Your message */}
            <div className={divider} />
            <h3 className={sectionHeading}>Your Message</h3>
            <p className={quoteBlock}>
              {data.shelterMessage
                ? `"${data.shelterMessage}"`
                : "No message was sent with this application."}
            </p>

            {/* Remarks from shelter */}
            <h3 className={sectionHeading}>Remarks from Shelter</h3>
            <p className={quoteBlock}>
              {data.staffRemark
                ? `"${data.staffRemark}"`
                : "No remarks yet."}
            </p>
          </div>
        )}
      </SlideOver>

      <ConfirmActionModal
        isOpen={confirmOpen}
        title="Withdraw application?"
        confirmLabel="Withdraw"
        isPending={withdraw.isPending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => withdraw.mutate()}
      >
        {data && (
          <>
            This withdraws your application for{" "}
            <strong>{data.pet.petName}</strong> at {data.shelter.shelterName}.
            The $15 processing fee isn't refunded, and you'd need to re-apply if
            you change your mind.
          </>
        )}
      </ConfirmActionModal>
    </>
  );
};

export default ApplicationDetailPanel;
