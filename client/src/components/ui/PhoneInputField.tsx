// components/ui/PhoneInputField.tsx
// Reusable E.164 phone input — country selector + national-number input,
// wrapping react-phone-number-input (built on libphonenumber-js). Starts
// genuinely empty (no defaultCountry) — the adopter must explicitly pick a
// country before entering a number, everywhere this component is used.
// `value`/`onChange` are already E.164 (e.g. "+12125550105") or undefined.
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";

interface PhoneInputFieldProps {
  value: string | null | undefined;
  onChange: (value: string | undefined) => void;
  id?: string;
  className?: string;
}

const PhoneInputField = ({
  value,
  onChange,
  id,
  className = "",
}: PhoneInputFieldProps) => (
  <PhoneInput
    id={id}
    international
    value={value ?? undefined}
    onChange={onChange}
    className={`phone-input-field ${className}`}
  />
);

export default PhoneInputField;
