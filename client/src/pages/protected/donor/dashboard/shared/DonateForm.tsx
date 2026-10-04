// DonateForm.tsx
// The donate form — shelter picker, preset or custom whole-dollar amount,
// optional message — shared by the Overview's "Let's Make a Donation" card
// and the Donate tab. Submit → POST /donations/checkout → leave the SPA for
// Stripe's hosted Checkout page. No donation exists until the Stripe
// webhook records it; Stripe returns the donor to
// /donor/donate/confirmation (DonateConfirmation polls for it), or to
// /donor/donate if they cancel.
// Shelters: GET /shelters?acceptingDonations=true — Open and Full ones
// (a Closed shelter can't take donations).
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import axios from "axios";
import { PiBuildings } from "react-icons/pi";
import ButtonElement from "../../../../../components/ui/ButtonElement";
import SelectField from "../../../../../components/ui/SelectField";
import { getSheltersAcceptingDonations } from "../../../../../logic/api/petsApi";
import {
  createDonationCheckout,
  DONATION_MAX_USD,
  DONATION_MIN_USD,
} from "../../../../../logic/api/donorsApi";
import { formatUSD } from "../../../../../logic/utils/currency";

const PRESET_AMOUNTS = [25, 50, 100, 200];
const MAX_MESSAGE_LEN = 300;

const labelClass =
  "mb-1.5 flex items-center gap-1.5 font-body text-sm font-semibold text-neutral-charcoal";
const fieldClass =
  "w-full rounded-md border border-neutral-lightgray bg-white px-3 py-2 font-body text-sm text-neutral-dark focus:border-teal-dark focus:outline-none";
const chipClass = (selected: boolean) =>
  `rounded-full border px-4 py-1.5 font-body text-xs font-semibold transition-colors ${
    selected
      ? "border-teal-dark bg-teal-dark text-white"
      : "border-neutral-gray text-neutral-charcoal hover:bg-neutral-offwhite"
  }`;

const extractError = (err: unknown): string =>
  axios.isAxiosError(err) && err.response?.data?.message
    ? String(err.response.data.message)
    : "Couldn't start your donation. Please try again.";

interface DonateFormProps {
  /** Distinguishes element ids when two forms could share a page. */
  idPrefix: string;
}

const DonateForm = ({ idPrefix }: DonateFormProps) => {
  const [shelterID, setShelterID] = useState("");
  // A preset amount, or "custom" (read from customAmount).
  const [preset, setPreset] = useState<number | "custom" | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const sheltersQuery = useQuery({
    queryKey: ["shelters", { acceptingDonations: true }],
    queryFn: getSheltersAcceptingDonations,
  });
  const shelterOptions = [
    { value: "", label: "Choose a shelter" },
    ...(sheltersQuery.data ?? []).map((s) => ({
      value: String(s.shelterID),
      label: s.shelterName,
    })),
  ];

  const amount = preset === "custom" ? Number(customAmount) : preset;

  const mutation = useMutation({
    mutationFn: createDonationCheckout,
    // Leaving the SPA entirely for Stripe's hosted page — not a navigate().
    onSuccess: ({ checkoutUrl }) => {
      window.location.href = checkoutUrl;
    },
    onError: (err) => setError(extractError(err)),
  });

  const handleDonate = () => {
    if (!shelterID) {
      setError("Please choose a shelter.");
      return;
    }
    if (
      amount === null ||
      !Number.isInteger(amount) ||
      amount < DONATION_MIN_USD ||
      amount > DONATION_MAX_USD
    ) {
      setError(
        `Please choose an amount — whole dollars from ${formatUSD(DONATION_MIN_USD)} to ${formatUSD(
          DONATION_MAX_USD,
        )}.`,
      );
      return;
    }
    setError(null);
    mutation.mutate({
      shelterID: Number(shelterID),
      amount,
      donationDesc: message.trim() || undefined,
    });
  };

  // Stays disabled after success too, while the browser leaves for Stripe.
  const busy = mutation.isPending || mutation.isSuccess;

  return (
    <div className="flex flex-col gap-5">
      <SelectField
        label="Shelter"
        icon={<PiBuildings className="text-neutral-gray" />}
        value={shelterID}
        onChange={(v) => {
          setShelterID(v);
          setError(null);
        }}
        options={shelterOptions}
        className="sm:max-w-sm"
      />

      <div>
        <p className={labelClass}>Amount</p>
        <div className="flex flex-wrap items-center gap-2">
          {PRESET_AMOUNTS.map((value) => (
            <ButtonElement
              key={value}
              onClick={() => {
                setPreset(value);
                setError(null);
              }}
              aria-pressed={preset === value}
              size="bare"
              variant="outline"
              className={chipClass(preset === value)}
            >
              ${value}
            </ButtonElement>
          ))}
          <ButtonElement
            onClick={() => {
              setPreset("custom");
              setError(null);
            }}
            aria-pressed={preset === "custom"}
            size="bare"
            variant="outline"
            className={chipClass(preset === "custom")}
          >
            Custom
          </ButtonElement>
        </div>
        {preset === "custom" && (
          <div className="mt-3 sm:max-w-xs">
            <label htmlFor={`${idPrefix}-custom-amount`} className="sr-only">
              Custom amount in US dollars
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-body text-sm text-neutral-gray">
                $
              </span>
              <input
                id={`${idPrefix}-custom-amount`}
                type="number"
                inputMode="numeric"
                min={DONATION_MIN_USD}
                max={DONATION_MAX_USD}
                step={1}
                placeholder="Whole dollars"
                value={customAmount}
                onChange={(e) => {
                  setCustomAmount(e.target.value);
                  setError(null);
                }}
                className={`${fieldClass} pl-7`}
              />
            </div>
          </div>
        )}
      </div>

      <div>
        <label htmlFor={`${idPrefix}-message`} className={labelClass}>
          Message <span className="font-normal text-neutral-gray">(optional)</span>
        </label>
        <textarea
          id={`${idPrefix}-message`}
          rows={2}
          maxLength={MAX_MESSAGE_LEN}
          placeholder="A note for the shelter"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className={fieldClass}
        />
      </div>

      {error && (
        <p className="rounded-lg bg-rose-lightest px-4 py-2 font-body text-sm text-rose-dark">
          {error}
        </p>
      )}

      <ButtonElement
        onClick={handleDonate}
        disabled={busy}
        size="panel"
        className="w-full bg-rose-dark hover:brightness-95 disabled:opacity-60"
      >
        {busy
          ? "Taking you to checkout…"
          : amount && Number.isInteger(amount) && amount >= DONATION_MIN_USD
            ? `Donate ${formatUSD(amount)}`
            : "Donate"}
      </ButtonElement>
    </div>
  );
};

export default DonateForm;
