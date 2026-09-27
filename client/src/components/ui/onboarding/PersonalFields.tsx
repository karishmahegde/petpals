// components/ui/onboarding/PersonalFields.tsx
// The "about you" basics every onboarding wizard's Personal step collects:
// a randomizable avatar, date of birth, sex and phone. Controlled — the step
// owns the values and saves them with its own role's profile endpoint.
import { PiArrowsClockwiseBold } from "react-icons/pi";
import Avatar from "../Avatar";
import ButtonElement from "../ButtonElement";
import PhoneInputField from "../PhoneInputField";

export interface PersonalValues {
  avatarSeed: string;
  dob: string; // YYYY-MM-DD, "" when unset
  sex: string; // "M" | "F" | "O", "" when unset
  phone: string | undefined; // E.164 from PhoneInputField
}

const inputClass =
  "w-full rounded-lg border border-rose-light bg-white px-3 py-1.5 font-body text-sm text-neutral-dark focus:border-teal-dark focus:outline-none disabled:bg-neutral-lightgray disabled:text-neutral-gray";

const SEX_OPTIONS = [
  { value: "M", label: "Male" },
  { value: "F", label: "Female" },
  { value: "O", label: "Other" },
];

interface PersonalFieldsProps {
  value: PersonalValues;
  onChange: (patch: Partial<PersonalValues>) => void;
}

const PersonalFields = ({ value, onChange }: PersonalFieldsProps) => (
  <>
    <div className="mb-6 flex items-center gap-4">
      <div className="relative shrink-0">
        <Avatar
          seed={value.avatarSeed}
          size={72}
          className="h-16 w-16 shrink-0 rounded-full border border-rose-light bg-white"
        />
        <ButtonElement
          onClick={() => onChange({ avatarSeed: crypto.randomUUID() })}
          aria-label="Randomize avatar"
          title="Randomize avatar"
          size="bare"
          className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-rose-dark shadow-sm hover:brightness-95"
        >
          <PiArrowsClockwiseBold className="h-3.5 w-3.5" aria-hidden />
        </ButtonElement>
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
          value={value.dob}
          onChange={(e) => onChange({ dob: e.target.value })}
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="font-body text-xs text-neutral-gray">Sex</label>
        <select
          value={value.sex}
          onChange={(e) => onChange({ sex: e.target.value })}
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
        <PhoneInputField
          value={value.phone}
          onChange={(phone) => onChange({ phone })}
        />
      </div>
    </div>
  </>
);

export default PersonalFields;
