// components/ui/PhoneDisplay.tsx
// Read-only counterpart to PhoneInputField — renders a stored E.164 phone
// number with its country flag, formatted for humans. Reusable wherever a
// phone number is shown outside an edit form (staff directory, shelter
// contact info, etc.).
import flags from "react-phone-number-input/flags";
import { formatPhoneDisplay, getPhoneCountry } from "../../logic/utils/phone";

interface PhoneDisplayProps {
  value: string;
}

const PhoneDisplay = ({ value }: PhoneDisplayProps) => {
  const country = getPhoneCountry(value);
  const Flag = country ? flags[country] : undefined;

  return (
    <span className="inline-flex items-center gap-2">
      {Flag && (
        <span className="inline-block h-3.5 w-5 shrink-0 overflow-hidden rounded-sm">
          <Flag title={country ?? ""} />
        </span>
      )}
      {formatPhoneDisplay(value)}
    </span>
  );
};

export default PhoneDisplay;
