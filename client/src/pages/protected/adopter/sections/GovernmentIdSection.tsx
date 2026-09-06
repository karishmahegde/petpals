import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import toast from "react-hot-toast";
import { PiClock, PiSealCheck, PiXCircle } from "react-icons/pi";
import {
  getGovernmentId,
  uploadGovernmentId,
  type GovernmentIdRecord,
} from "../../../../logic/api/adoptersApi";

const ID_TYPE_OPTIONS = [
  "Passport",
  "Driver's License",
  "National ID Card",
  "State ID",
  "Other",
];

// Mirrors server/src/middleware/upload.js - checked client-side too, so a
// bad file is caught before the network round trip, not just after it.
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
]);
const MAX_ID_FIELD_LEN = 45;

const inputClass =
  "w-full rounded-lg border border-rose-light bg-white px-3 py-1.5 font-body text-sm text-neutral-dark focus:border-teal-dark focus:outline-none";

const extractError = (err: unknown): string =>
  axios.isAxiosError(err) && err.response?.data?.message
    ? String(err.response.data.message)
    : "Something went wrong. Please try again.";

const STATUS_STYLE: Record<
  GovernmentIdRecord["verificationStatus"],
  { icon: typeof PiClock; className: string }
> = {
  Pending: { icon: PiClock, className: "text-gold-dark" },
  Verified: { icon: PiSealCheck, className: "text-green" },
  Rejected: { icon: PiXCircle, className: "text-rose-dark" },
};

const StatusBadge = ({
  status,
}: {
  status: GovernmentIdRecord["verificationStatus"];
}) => {
  const { icon: Icon, className } = STATUS_STYLE[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-body text-sm font-medium ${className}`}
    >
      <Icon className="h-4 w-4" aria-hidden />
      {status}
    </span>
  );
};

interface GovernmentIdSectionProps {
  isEditing: boolean;
}

const GovernmentIdSection = ({ isEditing }: GovernmentIdSectionProps) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["adopter", "government-id"],
    queryFn: getGovernmentId,
    retry: (failureCount, err) =>
      // 404 means "not submitted yet" - a normal state, not worth retrying.
      axios.isAxiosError(err) && err.response?.status === 404
        ? false
        : failureCount < 2,
  });

  const notSubmitted =
    query.isError &&
    axios.isAxiosError(query.error) &&
    query.error.response?.status === 404;

  // A rejected submission can be resubmitted — it reuses the same form,
  // and the backend resets verificationStatus back to Pending on success.
  const isRejected =
    query.isSuccess && query.data.verificationStatus === "Rejected";
  const showForm = (notSubmitted || isRejected) && isEditing;
  const showHint = (notSubmitted || isRejected) && !isEditing;

  const [idType, setIdType] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: uploadGovernmentId,
    onSuccess: (record) => {
      queryClient.setQueryData(["adopter", "government-id"], record);
      toast.success("Government ID submitted successfully");
      setIdType("");
      setIdNumber("");
      setFile(null);
      setFormError(null);
    },
    onError: (err) => setFormError(extractError(err)),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!idType) {
      setFormError("Please select an ID type.");
      return;
    }
    const trimmedNumber = idNumber.trim();
    if (!trimmedNumber || trimmedNumber.length > MAX_ID_FIELD_LEN) {
      setFormError(
        `ID number is required and must be at most ${MAX_ID_FIELD_LEN} characters.`,
      );
      return;
    }
    if (!file) {
      setFormError("Please choose a file to upload.");
      return;
    }
    if (!ALLOWED_MIME.has(file.type)) {
      setFormError(
        "Unsupported file type. Allowed: JPEG, PNG, WebP, HEIC, PDF.",
      );
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setFormError("File exceeds the 5 MB limit.");
      return;
    }

    setFormError(null);
    mutation.mutate({ idType, idNumber: trimmedNumber, file });
  };

  return (
    <div className="mt-5 border-t border-rose-light pt-5">
      <div className="font-body text-xs text-neutral-gray">Government ID</div>

      {query.isLoading && (
        <p className="font-body text-sm text-neutral-gray">Loading…</p>
      )}

      {query.isError && !notSubmitted && (
        <p className="font-body text-sm text-rose-dark">
          Couldn't load your government ID: {extractError(query.error)}
        </p>
      )}

      {query.isSuccess && !(isRejected && isEditing) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-body text-sm text-neutral-dark">
              {query.data.idType} ending in{" "}
              {query.data.idNumber.replace(/^\*+/, "")}
            </p>
          </div>
          <StatusBadge status={query.data.verificationStatus} />
        </div>
      )}

      {showHint && (
        <p className="font-body text-sm italic text-rose-dark">
          {isRejected
            ? "Rejected. Edit your profile to resubmit."
            : "Not submitted. Edit your profile to add one."}
        </p>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <p className="font-body text-sm text-neutral-charcoal">
            Submit a government ID for identity verification. This is kept
            private and only used to verify your identity.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="idType"
                className="font-body text-xs text-neutral-gray"
              >
                ID type
              </label>
              <select
                id="idType"
                value={idType}
                onChange={(e) => setIdType(e.target.value)}
                className={inputClass}
              >
                <option value="">- Select -</option>
                {ID_TYPE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="idType"
                className="font-body text-xs text-neutral-gray"
              >
                ID number
              </label>
              <input
                id="idNumber"
                type="text"
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                maxLength={MAX_ID_FIELD_LEN}
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="idType"
              className="font-body text-xs text-neutral-gray"
            >
              Document (JPEG, PNG, WebP, HEIC, or PDF - max 5 MB)
            </label>
            <input
              id="idDocument"
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.heic,.pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="font-body text-xs text-neutral-charcoal file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-light file:px-3 file:py-1.5 file:font-body file:text-sm file:font-medium file:text-neutral-dark hover:file:bg-rose-light"
            />
          </div>

          {formError && (
            <p className="rounded-lg bg-rose-lightest px-4 py-2 font-body text-sm text-rose-dark">
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={mutation.isPending}
            className="self-start rounded-xl bg-rose-dark px-5 py-2 font-body text-sm font-medium text-white transition-colors hover:brightness-90 disabled:opacity-50"
          >
            {mutation.isPending ? "Submitting…" : "Submit"}
          </button>
        </form>
      )}
    </div>
  );
};

export default GovernmentIdSection;
