// PersonalStep.tsx - onboarding Step 2
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { Country, State, City } from "country-state-city";
import { PiUserBold, PiArrowsClockwiseBold } from "react-icons/pi";
import Avatar from "../../../../../components/ui/Avatar";
import PhoneInputField from "../../../../../components/ui/PhoneInputField";
import OnboardingStepHeader from "../OnboardingStepHeader";
import {
  updateAdopterProfile,
  type AdopterProfile as AdopterProfileData,
} from "../../../../../logic/api/adoptersApi";

interface PersonalStepProps {
  profile: AdopterProfileData;
  onContinue: () => void;
}

const inputClass =
  "w-full rounded-lg border border-rose-light bg-white px-3 py-1.5 font-body text-sm text-neutral-dark focus:border-teal-dark focus:outline-none disabled:bg-neutral-lightgray disabled:text-neutral-gray";

const SEX_OPTIONS = [
  { value: "M", label: "Male" },
  { value: "F", label: "Female" },
  { value: "O", label: "Other" },
];

// country-state-city has no postal-code data at all - these are just format
// checks for the countries an adopter is most likely to be in. Any country
// not listed here only gets the plain non-empty check below.
const ZIP_PATTERNS: Record<string, RegExp> = {
  US: /^\d{5}(-\d{4})?$/,
  IN: /^\d{6}$/,
  GB: /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s?\d[A-Za-z]{2}$/,
  CA: /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/,
  AU: /^\d{4}$/,
  DE: /^\d{5}$/,
  FR: /^\d{5}$/,
  JP: /^\d{3}-?\d{4}$/,
  CN: /^\d{6}$/,
  BR: /^\d{5}-?\d{3}$/,
  MX: /^\d{5}$/,
  IT: /^\d{5}$/,
  ES: /^\d{5}$/,
  NL: /^\d{4}\s?[A-Za-z]{2}$/,
  SG: /^\d{6}$/,
  ZA: /^\d{4}$/,
};

const isValidZip = (zip: string, countryCode: string) => {
  const trimmed = zip.trim();
  if (!trimmed) return false;
  const pattern = ZIP_PATTERNS[countryCode];
  return pattern ? pattern.test(trimmed) : true;
};

const extractError = (err: unknown): string =>
  axios.isAxiosError(err) && err.response?.data?.message
    ? String(err.response.data.message)
    : "Something went wrong. Please try again.";

const countries = Country.getAllCountries();

// The DB stores plain name strings (city/state/country), not ISO codes -
// everything else that renders them (ReviewStep, AdopterProfile) does so as
// plain text with no lookup. ISO codes only exist here, in local state, to
// drive the cascading selects.
const findCountryCode = (name: string) =>
  countries.find((c) => c.name === name)?.isoCode ?? "";

const findStateCode = (countryCode: string, name: string) =>
  countryCode
    ? (State.getStatesOfCountry(countryCode).find((s) => s.name === name)
        ?.isoCode ?? "")
    : "";

const PersonalStep = ({ profile, onContinue }: PersonalStepProps) => {
  const [avatarSeed, setAvatarSeed] = useState(profile.avatarSeed);
  const [dob, setDob] = useState(
    profile.adopterDOB ? profile.adopterDOB.slice(0, 10) : "",
  );
  const [sex, setSex] = useState(profile.adopterSex ?? "");
  const [phone, setPhone] = useState<string | undefined>(
    profile.adopterPhone ?? undefined,
  );
  const [addressLine1, setAddressLine1] = useState(profile.addressLine1 ?? "");
  const [addressLine2, setAddressLine2] = useState(profile.addressLine2 ?? "");

  const [countryCode, setCountryCode] = useState(() =>
    findCountryCode(profile.country ?? ""),
  );
  const [country, setCountry] = useState(profile.country ?? "");
  const [stateCode, setStateCode] = useState(() =>
    findStateCode(findCountryCode(profile.country ?? ""), profile.state ?? ""),
  );
  const [addressState, setAddressState] = useState(profile.state ?? "");
  const [city, setCity] = useState(profile.city ?? "");
  const [zip, setZip] = useState(profile.zip ?? "");

  const [error, setError] = useState<string | null>(null);

  const states = countryCode ? State.getStatesOfCountry(countryCode) : [];
  // Some countries (Singapore, Monaco, Vatican, …) have no state-level data
  // at all - fall back to cities keyed directly off the country instead of
  // forcing a state pick that can't happen.
  const cities =
    countryCode && stateCode
      ? City.getCitiesOfState(countryCode, stateCode)
      : countryCode && states.length === 0
        ? (City.getCitiesOfCountry(countryCode) ?? [])
        : [];

  const handleCountryChange = (isoCode: string) => {
    setCountryCode(isoCode);
    setCountry(countries.find((c) => c.isoCode === isoCode)?.name ?? "");
    setStateCode("");
    setAddressState("");
    setCity("");
  };

  const handleStateChange = (isoCode: string) => {
    setStateCode(isoCode);
    setAddressState(states.find((s) => s.isoCode === isoCode)?.name ?? "");
    setCity("");
  };

  const mutation = useMutation({
    mutationFn: updateAdopterProfile,
    onSuccess: () => onContinue(),
    onError: (err) => setError(extractError(err)),
  });

  const handleContinue = () => {
    if (
      !dob ||
      !sex ||
      !phone ||
      !addressLine1.trim() ||
      !city.trim() ||
      !addressState.trim() ||
      !country.trim() ||
      !zip.trim()
    ) {
      setError("Please fill in all required fields.");
      return;
    }
    if (!isValidZip(zip, countryCode)) {
      setError(
        "Please enter a valid ZIP/postal code for the selected country.",
      );
      return;
    }
    setError(null);
    mutation.mutate({
      avatarSeed,
      adopterDOB: dob,
      adopterSex: sex,
      adopterPhone: phone,
      addressLine1: addressLine1.trim(),
      addressLine2: addressLine2.trim() || null,
      city: city.trim(),
      state: addressState.trim(),
      zip: zip.trim(),
      country: country.trim(),
    });
  };

  return (
    <div>
      <OnboardingStepHeader
        icon={<PiUserBold />}
        title="About You"
        description="A few basics so shelters know who they're talking to."
      />

      <div className="mb-6 flex items-center gap-4">
        <div className="relative shrink-0">
          <Avatar
            seed={avatarSeed}
            size={72}
            className="h-16 w-16 shrink-0 rounded-full border border-rose-light bg-white"
          />
          <button
            type="button"
            onClick={() => setAvatarSeed(crypto.randomUUID())}
            aria-label="Randomize avatar"
            title="Randomize avatar"
            className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-rose-dark text-white shadow-sm transition-colors hover:brightness-90"
          >
            <PiArrowsClockwiseBold className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
        <p className="font-body text-sm text-rose-dark">
          Your avatar, randomize until you find one you like!
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="font-body text-xs text-neutral-gray">
            Date of birth
          </label>
          <input
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="font-body text-xs text-neutral-gray">Sex</label>
          <select
            value={sex}
            onChange={(e) => setSex(e.target.value)}
            className={inputClass}
          >
            <option value="">- Select -</option>
            {SEX_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className="font-body text-xs text-neutral-gray">Phone</label>
          <PhoneInputField value={phone} onChange={setPhone} />
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="font-body text-xs text-neutral-gray">
            Address line 1
          </label>
          <input
            type="text"
            value={addressLine1}
            onChange={(e) => setAddressLine1(e.target.value)}
            maxLength={100}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="font-body text-xs text-neutral-gray">
            Address line 2 <span className="font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={addressLine2}
            onChange={(e) => setAddressLine2(e.target.value)}
            maxLength={100}
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="font-body text-xs text-neutral-gray">
              Country
            </label>
            <select
              value={countryCode}
              onChange={(e) => handleCountryChange(e.target.value)}
              className={inputClass}
            >
              <option value="">- Select -</option>
              {countries.map((c) => (
                <option key={c.isoCode} value={c.isoCode}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-body text-xs text-neutral-gray">State</label>
            {countryCode && states.length > 0 ? (
              <select
                value={stateCode}
                onChange={(e) => handleStateChange(e.target.value)}
                className={inputClass}
              >
                <option value="">- Select -</option>
                {states.map((s) => (
                  <option key={s.isoCode} value={s.isoCode}>
                    {s.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={addressState}
                onChange={(e) => setAddressState(e.target.value)}
                placeholder={
                  countryCode ? "Enter State" : "Select a country first"
                }
                disabled={!countryCode}
                maxLength={45}
                className={inputClass}
              />
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-body text-xs text-neutral-gray">City</label>
            {countryCode && cities.length > 0 ? (
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className={inputClass}
              >
                <option value="">- Select -</option>
                {cities.map((c) => (
                  <option
                    key={`${c.name}-${c.latitude}-${c.longitude}`}
                    value={c.name}
                  >
                    {c.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder={
                  countryCode ? "Enter City" : "Select a country first"
                }
                disabled={!countryCode}
                maxLength={45}
                className={inputClass}
              />
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-body text-xs text-neutral-gray">ZIP</label>
            <input
              type="text"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              maxLength={10}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-rose-lightest px-4 py-2 font-body text-sm text-rose-dark">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleContinue}
        disabled={mutation.isPending}
        className="mt-6 w-full rounded-xl bg-teal-dark py-3 font-body text-sm font-medium text-white transition-colors hover:brightness-90 disabled:opacity-50"
      >
        {mutation.isPending ? "Saving…" : "Continue"}
      </button>
    </div>
  );
};

export default PersonalStep;
