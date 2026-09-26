// WorkerRegister.tsx
// Page: Registration form for the worker portal (Admin, Staff, Veterinarian)
// — structurally identical to the public Register.tsx (same name/email/
// password/consent fields and validation, same POST /auth/register call).
// Only the role picker and copy differ. All three roles land Pending
// (self-registered, awaiting approval) except the very first Admin ever
// created, which auto-activates (see auth.service.js's register()) —
// Staff/Admin approvals have a review UI (Staff tab / Admins tab); Vet
// approval doesn't yet (no Staff dashboard to host it). Staff also pick the
// shelter they're joining — its manager approves them (Management → Staff).
// Route: /staff-portal/register
import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import toast from "react-hot-toast";
import Card from "../../../components/ui/Card";
import ButtonElement from "../../../components/ui/ButtonElement";
import { register as registerApi } from "../../../logic/api/authApi";
import {
  getShelters,
  getSheltersWithManager,
} from "../../../logic/api/petsApi";
import { dashboardPathFor } from "../../../logic/route/resolveDestination";
import useAuthStore from "../../../logic/store/useAuthStore";
import backgroundImg from "../../../static/assets/images/background-admin.png";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const nameRegex = /^[A-Za-z][A-Za-z'-]*(?: [A-Za-z'-]+)*$/;

interface PasswordRequirement {
  label: string;
  test: (password: string) => boolean;
}

const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  { label: "At least 8 characters", test: (pw) => pw.length >= 8 },
  { label: "One uppercase letter", test: (pw) => /[A-Z]/.test(pw) },
  { label: "One lowercase letter", test: (pw) => /[a-z]/.test(pw) },
  { label: "One number", test: (pw) => /[0-9]/.test(pw) },
  {
    label: "One special character (!@#$%^&*)",
    test: (pw) => /[!@#$%^&*(),.?":{}|<>_\-+=]/.test(pw),
  },
];

interface RoleOption {
  value: string;
  label: string;
  emoji: string;
  description: string;
  bg: string;
  border: string;
}

// The three worker roles — distinct from the public Register.tsx's
// Adopter/Volunteer/Donor picker. Values match auth.service.js's ROLE_CONFIG
// keys exactly.
const ROLE_OPTIONS: RoleOption[] = [
  {
    value: "staff",
    label: "Staff",
    emoji: "🧑‍💼",
    description: "I work at a shelter — pets, applications, volunteers",
    bg: "bg-teal-light",
    border: "border-teal-md",
  },
  {
    value: "vet",
    label: "Veterinarian",
    emoji: "🩺",
    description: "I provide veterinary care for shelter animals",
    bg: "bg-rose-light",
    border: "border-rose-md",
  },
  {
    value: "admin",
    label: "Admin",
    emoji: "🛡️",
    description: "I oversee shelters and organisation-wide operations",
    bg: "bg-gold-light",
    border: "border-gold-md",
  },
];

const WorkerRegister = () => {
  const { token, role: sessionRole } = useAuthStore();
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("");
  const [shelterID, setShelterID] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [confirmAge, setConfirmAge] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Staff and vets both join one shelter, whose manager approves them —
  // so vets only see shelters that already have one.
  const isVet = role === "vet";
  const needsShelter = role === "staff" || isVet;
  const { data: shelters = [] } = useQuery({
    queryKey: ["shelters", { hasManager: isVet }],
    queryFn: isVet ? getSheltersWithManager : getShelters,
    enabled: needsShelter,
  });

  if (token && sessionRole) {
    return <Navigate to={dashboardPathFor(sessionRole)} replace />;
  }

  const validate = (): string => {
    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();

    if (!trimmedFirst) return "Please enter your first name";
    if (!nameRegex.test(trimmedFirst))
      return "First name can only contain letters, spaces, hyphens, and apostrophes";
    if (!trimmedLast) return "Please enter your last name";
    if (!nameRegex.test(trimmedLast))
      return "Last name can only contain letters, spaces, hyphens, and apostrophes";
    if (`${trimmedFirst} ${trimmedLast}`.length > 45)
      return "Full name is too long";

    if (!email.trim()) return "Please enter your email";
    if (!emailRegex.test(email)) return "Please enter a valid email address";

    if (!password) return "Please enter a password";
    if (!PASSWORD_REQUIREMENTS.every((req) => req.test(password)))
      return "Password does not meet all requirements";

    if (!role) return "Please select your role";
    if (needsShelter && !shelterID)
      return "Please select the shelter you work at";
    if (!agreeTerms)
      return "Please agree to the Terms of Service and Privacy Policy";
    if (!confirmAge) return "Please confirm you are 18 or older";

    return "";
  };

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setLoading(true);
    try {
      await registerApi({
        name: `${firstName.trim()} ${lastName.trim()}`,
        email,
        password,
        role,
        shelterID: needsShelter ? Number(shelterID) : undefined,
      });
      toast.success(
        "Registered! Your account needs approval before you can sign in.",
      );
      navigate("/staff-portal/login", { replace: true });
    } catch (err: unknown) {
      const message =
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : "Unable to connect to the server. Please try again later.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-fixed flex items-center justify-center px-4 py-10"
      style={{ backgroundImage: `url(${backgroundImg})` }}
    >
      <Card className="w-full max-w-lg p-10">
        {/* Heading */}
        <h1 className="font-display text-3xl text-center text-neutral-dark mb-2">
          Staff Portal 🧑‍💼
        </h1>
        <p className="text-center font-body text-sm text-neutral-gray mb-6">
          For Admin, Staff, and Veterinarian accounts
        </p>

        {/* Sign in / Sign up tabs */}
        <div className="flex rounded-xl overflow-hidden mb-8">
          <ButtonElement
            onClick={() => navigate("/staff-portal/login")}
            size="bare"
            variant="outline"
            className="flex-1 py-2.5 text-sm text-neutral-dark bg-teal-md hover:brightness-95"
          >
            Sign in
          </ButtonElement>
          <ButtonElement size="bare" className="flex-1 py-2.5 text-sm bg-teal-dark">
            Sign up
          </ButtonElement>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex flex-col gap-5"
        >
          {/* First Name */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="firstName"
              className="font-body text-sm font-bold text-neutral-black"
            >
              First Name
            </label>
            <input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Jane"
              maxLength={30}
              className="border border-neutral-gray rounded-lg px-4 py-2.5 font-body text-sm text-neutral-dark placeholder:text-neutral-gray focus:outline-none focus:border-teal-dark"
            />
          </div>

          {/* Last Name */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="lastName"
              className="font-body text-sm font-bold text-neutral-black"
            >
              Last Name
            </label>
            <input
              id="lastName"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Doe"
              maxLength={30}
              className="border border-neutral-gray rounded-lg px-4 py-2.5 font-body text-sm text-neutral-dark placeholder:text-neutral-gray focus:outline-none focus:border-teal-dark"
            />
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="email"
              className="font-body text-sm font-bold text-neutral-black"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane.doe@petpals.com"
              maxLength={45}
              className="border border-neutral-gray rounded-lg px-4 py-2.5 font-body text-sm text-neutral-dark placeholder:text-neutral-gray focus:outline-none focus:border-teal-dark"
            />
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="font-body text-sm font-bold text-neutral-black"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="border border-neutral-gray rounded-lg px-4 py-2.5 font-body text-sm text-neutral-dark placeholder:text-neutral-gray focus:outline-none focus:border-teal-dark"
            />
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
          </div>

          {/* Role selection */}
          <div className="flex flex-col gap-1.5">
            <label className="font-body text-sm font-bold text-neutral-black">
              What's your role?
            </label>
            <div className="flex flex-col gap-2.5 mt-1">
              {ROLE_OPTIONS.map((option) => {
                const selected = role === option.value;
                return (
                  <ButtonElement
                    key={option.value}
                    onClick={() => {
                      setRole(option.value);
                      // The two roles offer different shelter lists.
                      setShelterID("");
                    }}
                    size="bare"
                    variant="outline"
                    className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left ${
                      option.bg
                    } ${selected ? option.border : "border-transparent"}`}
                  >
                    <span
                      className={`flex-shrink-0 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center ${
                        selected ? "bg-teal-dark" : "bg-white"
                      }`}
                    />
                    <span className="font-body text-sm text-neutral-dark">
                      <span className="mr-1">{option.emoji}</span>
                      <span className="font-bold">{option.label}</span> -{" "}
                      {option.description}
                    </span>
                  </ButtonElement>
                );
              })}
            </div>
            <p className="mt-1 font-body text-xs text-neutral-gray">
              New accounts need approval before they can sign in.
            </p>
          </div>

          {/* Shelter — staff and vets */}
          {needsShelter && (
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="shelterID"
                className="font-body text-sm font-bold text-neutral-black"
              >
                Shelter
              </label>
              <select
                id="shelterID"
                value={shelterID}
                onChange={(e) => setShelterID(e.target.value)}
                className="border border-neutral-gray rounded-lg px-4 py-2.5 font-body text-sm text-neutral-dark bg-white focus:outline-none focus:border-teal-dark"
              >
                <option value="">Select a shelter</option>
                {shelters.map((shelter) => (
                  <option key={shelter.shelterID} value={shelter.shelterID}>
                    {shelter.shelterName}
                  </option>
                ))}
              </select>
              {isVet && (
                <p className="font-body text-xs text-neutral-gray">
                  Only shelters with a manager in place are onboarding vets.
                </p>
              )}
            </div>
          )}

          {/* Consent checkboxes */}
          <div className="flex flex-col gap-2">
            <label className="flex items-start gap-2 font-body text-sm text-neutral-charcoal">
              <input
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                I agree to the{" "}
                <span className="underline">Terms of Service</span> and{" "}
                <span className="underline">Privacy Policy</span>.
              </span>
            </label>
            <label className="flex items-start gap-2 font-body text-sm text-neutral-charcoal">
              <input
                type="checkbox"
                checked={confirmAge}
                onChange={(e) => setConfirmAge(e.target.checked)}
                className="mt-0.5"
              />
              <span>I confirm I&apos;m 18 or older.</span>
            </label>
          </div>

          {/* Error message */}
          <div
            className={`border rounded-lg px-4 py-2.5 ${error ? "border-rose-dark bg-rose-light" : "border-transparent bg-transparent invisible"}`}
          >
            <p className="font-body text-sm text-rose-dark">
              {error || "placeholder"}
            </p>
          </div>

          {/* Submit button */}
          <ButtonElement
            type="submit"
            disabled={loading}
            size="bare"
            className="w-full bg-gold-md text-sm font-light py-3 rounded-xl hover:brightness-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-1"
          >
            {loading ? "Signing up..." : "sign up"}
          </ButtonElement>
        </form>

        <p className="mt-6 text-center font-body text-xs text-neutral-gray">
          Looking to adopt, volunteer, or donate?{" "}
          <ButtonElement
            onClick={() => navigate("/register")}
            size="bare"
            variant="outline"
            className="font-semibold text-teal-dark underline"
          >
            Register here
          </ButtonElement>
        </p>
      </Card>
    </div>
  );
};

export default WorkerRegister;
