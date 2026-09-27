// components/ui/onboarding/AddressFields.tsx
// The structured-address inputs every onboarding wizard collects (line 1/2,
// then cascading Country → State → City selects, and ZIP). Controlled: the
// step owns the Address value and gets partial updates back. Validation and
// the save payload live in logic/utils/address.ts.
import { useState } from "react";
import { Country, State, City } from "country-state-city";
import {
  findCountryCode,
  type Address,
} from "../../../logic/utils/address";

const inputClass =
  "w-full rounded-lg border border-rose-light bg-white px-3 py-1.5 font-body text-sm text-neutral-dark focus:border-teal-dark focus:outline-none disabled:bg-neutral-lightgray disabled:text-neutral-gray";

const countries = Country.getAllCountries();

// The DB stores plain name strings (city/state/country), not ISO codes -
// everything else that renders them does so as plain text with no lookup.
// ISO codes only exist here, in local state, to drive the cascading selects.
const findStateCode = (countryCode: string, name: string) =>
  countryCode
    ? (State.getStatesOfCountry(countryCode).find((s) => s.name === name)
        ?.isoCode ?? "")
    : "";

interface AddressFieldsProps {
  value: Address;
  onChange: (patch: Partial<Address>) => void;
}

const AddressFields = ({ value, onChange }: AddressFieldsProps) => {
  const [countryCode, setCountryCode] = useState(() =>
    findCountryCode(value.country),
  );
  const [stateCode, setStateCode] = useState(() =>
    findStateCode(findCountryCode(value.country), value.state),
  );

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
    setStateCode("");
    onChange({
      country: countries.find((c) => c.isoCode === isoCode)?.name ?? "",
      state: "",
      city: "",
    });
  };

  const handleStateChange = (isoCode: string) => {
    setStateCode(isoCode);
    onChange({
      state: states.find((s) => s.isoCode === isoCode)?.name ?? "",
      city: "",
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="font-body text-xs text-neutral-gray">
          Address line 1
        </label>
        <input
          type="text"
          value={value.addressLine1}
          onChange={(e) => onChange({ addressLine1: e.target.value })}
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
          value={value.addressLine2 ?? ""}
          onChange={(e) => onChange({ addressLine2: e.target.value })}
          maxLength={100}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="font-body text-xs text-neutral-gray">Country</label>
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
              value={value.state}
              onChange={(e) => onChange({ state: e.target.value })}
              placeholder={countryCode ? "Enter State" : "Select a country first"}
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
              value={value.city}
              onChange={(e) => onChange({ city: e.target.value })}
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
              value={value.city}
              onChange={(e) => onChange({ city: e.target.value })}
              placeholder={countryCode ? "Enter City" : "Select a country first"}
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
            value={value.zip}
            onChange={(e) => onChange({ zip: e.target.value })}
            maxLength={10}
            className={inputClass}
          />
        </div>
      </div>
    </div>
  );
};

export default AddressFields;
