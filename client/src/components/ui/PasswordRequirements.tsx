// components/ui/PasswordRequirements.tsx
// The live checklist under a new-password field — each rule ticks off as
// it's met. Rules come from logic/utils/password.ts.
import { PASSWORD_REQUIREMENTS } from "../../logic/utils/password";

const PasswordRequirements = ({ password }: { password: string }) => (
  <ul className="mt-1 flex flex-col gap-1">
    {PASSWORD_REQUIREMENTS.map((req) => {
      const met = req.test(password);
      return (
        <li
          key={req.label}
          className={`font-body text-xs flex items-center gap-1.5 transition-colors ${
            met ? "text-teal-dark" : "text-neutral-gray"
          }`}
        >
          <span>{met ? "✓" : "○"}</span>
          {req.label}
        </li>
      );
    })}
  </ul>
);

export default PasswordRequirements;
