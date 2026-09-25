// DonationDetailPanel.tsx
// Detail slide-over for one donation — opened from an All Donations row's
// "View Details". Read-only: the donation (ID, amount, date), the donor's
// note, and the donor's contact details. Same InfoRow layout as the other
// staff detail panels.
import { useQuery } from "@tanstack/react-query";
import SlideOver from "../../../../../../components/ui/SlideOver";
import PhoneDisplay from "../../../../../../components/ui/PhoneDisplay";
import { getDonation } from "../../../../../../logic/api/donationsApi";
import { formatFullDate } from "../../../../../../logic/utils/datetime";
import { formatUSD } from "../../../../../../logic/utils/currency";

interface DonationDetailPanelProps {
  donationID: number | null;
  onClose: () => void;
}

const label = "font-body text-sm font-semibold text-teal-dark";
const value = "font-body text-sm text-neutral-charcoal";
const sectionTitle = "font-display text-lg text-neutral-dark";
const divider = "my-5 border-t border-neutral-lightgray";

const InfoRow = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <>
    <dt className={label}>{k}</dt>
    <dd className={value}>{v}</dd>
  </>
);

const DonationDetailPanel = ({ donationID, onClose }: DonationDetailPanelProps) => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["staff", "donations", "detail", donationID],
    queryFn: () => getDonation(donationID!),
    enabled: donationID !== null,
  });

  return (
    <SlideOver open={donationID !== null} onClose={onClose} title="Donation Details">
      {isLoading && (
        <p className="p-8 text-center text-sm text-neutral-gray">Loading donation…</p>
      )}
      {isError && (
        <p className="p-8 text-center text-sm text-rose-dark">
          Couldn't load this donation. Please try again.
        </p>
      )}

      {data && (
        <div className="p-6">
          <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2">
            <InfoRow k="ID" v={data.donationCode ?? "—"} />
            <InfoRow k="Amount" v={formatUSD(data.donationAmt)} />
            <InfoRow k="Date" v={formatFullDate(new Date(data.donationDate))} />
          </dl>

          <div className={divider} />
          <h2 className={sectionTitle}>Donation Note</h2>
          {data.donationDesc ? (
            <p className="mt-2 rounded-lg border border-neutral-lightgray bg-neutral-offwhite p-3 font-body text-sm text-neutral-charcoal">
              {data.donationDesc}
            </p>
          ) : (
            <p className="mt-2 font-body text-xs text-neutral-gray">No note left.</p>
          )}

          <div className={divider} />
          <h2 className={sectionTitle}>Donor Details</h2>
          <dl className="mt-2 grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2">
            <InfoRow k="Name" v={data.donor.donorName} />
            <InfoRow k="Email" v={data.donor.donorEmail} />
            <InfoRow
              k="Phone"
              v={
                data.donor.donorPhone ? (
                  <PhoneDisplay value={data.donor.donorPhone} />
                ) : (
                  "—"
                )
              }
            />
          </dl>
        </div>
      )}
    </SlideOver>
  );
};

export default DonationDetailPanel;
