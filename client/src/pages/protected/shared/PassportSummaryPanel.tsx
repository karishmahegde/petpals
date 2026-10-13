// PassportSummaryPanel.tsx
// "Summarize with AI" on the Health Passport (HealthPassport.tsx, Staff and
// Veterinarian alike): the AI summary paragraph plus Points to review, each
// with a link that scrolls the passport to the record, dose or transfer it
// cites. Mounted only while open, so the summary is fetched on the first
// click. Its query sits under the passport's own key — a vet adding a record
// invalidates the passport and this with it. The server caches the summary
// until the passport changes, so reopening it doesn't call the AI again.
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { FaTimes } from "react-icons/fa";
import { PiSparkleFill } from "react-icons/pi";
import ButtonElement from "../../../components/ui/ButtonElement";
import Badge from "../../../components/ui/Badge";
import { formatShortDate, formatTime } from "../../../logic/utils/datetime";
import {
  getHealthPassportSummary,
  type PassportSummarySourceType,
} from "../../../logic/api/staffPetsApi";

const SOURCE_LINK_LABEL: Record<PassportSummarySourceType, string> = {
  healthRecord: "View health record",
  vaccination: "View vaccination",
  transfer: "View transfer",
};

const extractError = (err: unknown): string =>
  axios.isAxiosError(err) && err.response?.data?.message
    ? String(err.response.data.message)
    : "Couldn't summarize this passport. Please try again.";

interface PassportSummaryPanelProps {
  petID: number;
  passportQueryKey: readonly unknown[];
  onViewSource: (type: PassportSummarySourceType, recordID: number) => void;
  onClose: () => void;
}

const PassportSummaryPanel = ({
  petID,
  passportQueryKey,
  onViewSource,
  onClose,
}: PassportSummaryPanelProps) => {
  const { data, error, isLoading, isFetching, refetch } = useQuery({
    queryKey: [...passportQueryKey, "summary"],
    queryFn: () => getHealthPassportSummary(petID),
    // A failed request is a failed AI call — retrying it three times in the
    // background would just spend three more. Try again leaves it to the user.
    retry: false,
    refetchOnWindowFocus: false,
  });

  const renderBody = () => {
    if (isLoading) {
      return (
        <p className="font-body text-sm text-neutral-gray">
          Summarizing this passport…
        </p>
      );
    }
    if (error) {
      return (
        <div className="flex flex-col items-start gap-3">
          <p className="font-body text-sm text-rose-dark">
            {extractError(error)}
          </p>
          <ButtonElement
            onClick={() => refetch()}
            disabled={isFetching}
            size="sm"
            className="bg-teal-dark hover:brightness-95"
          >
            {isFetching ? "Trying again…" : "Try again"}
          </ButtonElement>
        </div>
      );
    }
    if (!data || !data.aiAvailable) {
      return (
        <p className="font-body text-sm text-neutral-gray">
          AI summaries aren't available right now.
        </p>
      );
    }
    return (
      <>
        <p className="font-body text-sm text-neutral-charcoal">
          {data.summary}
        </p>

        {data.pointsToReview.length > 0 && (
          <div className="mt-4">
            <h4 className="font-body text-sm font-bold text-neutral-dark">
              Points to review
            </h4>
            <ul className="mt-2 flex flex-col gap-2">
              {data.pointsToReview.map((point) => (
                <li
                  key={`${point.source.type}-${point.source.recordID}-${point.origin}`}
                  className="flex flex-col gap-1 rounded-lg bg-white p-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
                >
                  <div className="flex min-w-0 items-start gap-2">
                    {point.origin === "rules" && (
                      <Badge tone="red" className="shrink-0">
                        Overdue
                      </Badge>
                    )}
                    <p className="font-body text-sm text-neutral-charcoal">
                      {point.text}
                    </p>
                  </div>
                  <ButtonElement
                    onClick={() =>
                      onViewSource(point.source.type, point.source.recordID)
                    }
                    size="bare"
                    variant="outline"
                    className="shrink-0 self-start font-body text-xs font-medium text-rose-dark hover:underline"
                  >
                    {SOURCE_LINK_LABEL[point.source.type]} →
                  </ButtonElement>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-4 font-body text-xs italic text-neutral-gray">
          AI-generated — check it against the records below before acting on it.
          {data.generatedAt &&
            ` Generated ${formatShortDate(new Date(data.generatedAt))}, ${formatTime(new Date(data.generatedAt))}.`}
        </p>
      </>
    );
  };

  return (
    <section
      aria-label="AI summary"
      className="mb-5 rounded-xl border border-rose-light bg-rose-lightest p-5"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-display text-xl text-neutral-dark">
          <PiSparkleFill className="text-rose-dark" aria-hidden /> AI Summary
        </h3>
        <ButtonElement
          onClick={onClose}
          aria-label="Close AI summary"
          size="bare"
          variant="outline"
          className="text-neutral-gray hover:text-neutral-dark"
        >
          <FaTimes />
        </ButtonElement>
      </div>
      {renderBody()}
    </section>
  );
};

export default PassportSummaryPanel;
