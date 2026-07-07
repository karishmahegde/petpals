// Register.tsx
// Page: Public registration form for adopters, volunteers, and donors
// Responsibilities:
//   - Renders name, email, password, role, and consent fields with client-side validation
//   - Calls authApi.register() on submit and handles loading/error states
//   - On success: redirects to /login and shows a success toast
//   - On failure: displays server error message inline
// Route: /register
import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import Card from "../../../components/ui/Card";
import { register as registerApi } from "../../../logic/api/authApi";
import useAuthStore from "../../../logic/store/useAuthStore";
import backgroundImg from "../../../static/assets/images/background.png";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const nameRegex = /^[A-Za-z][A-Za-z'-]*(?: [A-Za-z'-]+)*$/;

interface PasswordRequirement {
  label: string;
  test: (password: string) => boolean;
}

// Checked off live as the user types - matches the backend's expected password strength
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

// Only the three self-service roles - admin, staff, and vet accounts are provisioned internally
const ROLE_OPTIONS: RoleOption[] = [
  {
    value: "adopter",
    label: "Adopter",
    emoji: "🐾",
    description: "I want to adopt or foster a pet",
    bg: "bg-gold-light",
    border: "border-gold-md",
  },
  {
    value: "volunteer",
    label: "Volunteer",
    emoji: "❤️",
    description: "I want to volunteer at a shelter",
    bg: "bg-teal-light",
    border: "border-teal-md",
  },
  {
    value: "donor",
    label: "Donor",
    emoji: "💰",
    description: "I want to donate to a shelter",
    bg: "bg-rose-light",
    border: "border-rose-md",
  },
];

const Register = () => {
  const { token, role: sessionRole } = useAuthStore();
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [confirmAge, setConfirmAge] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (token && sessionRole) {
    return <Navigate to={`/${sessionRole.toLowerCase()}`} replace />;
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

    if (!role) return "Please select how you'd like to get involved";
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
      });
      toast.success("Registered successfully");
      navigate("/login", { replace: true });
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
      className="min-h-screen bg-cover bg-center flex items-center justify-center px-4 py-10"
      style={{ backgroundImage: `url(${backgroundImg})` }}
    >
      <Card className="w-full max-w-lg p-10">
        {/* Heading */}
        <h1 className="font-display text-3xl text-center text-neutral-dark mb-6">
          Sign up 🐱
        </h1>

        {/* Sign in / Sign up tabs */}
        <div className="flex rounded-xl overflow-hidden mb-8">
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="flex-1 py-2.5 font-body text-sm text-neutral-dark bg-rose-md hover:brightness-95 transition-colors"
          >
            Sign in
          </button>
          <button
            type="button"
            className="flex-1 py-2.5 font-body text-sm text-white bg-rose-dark transition-colors"
          >
            Sign up
          </button>
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
              placeholder="jane.doe@email.com"
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
              How would you like to get involved?
            </label>
            <div className="flex flex-col gap-2.5 mt-1">
              {ROLE_OPTIONS.map((option) => {
                const selected = role === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setRole(option.value)}
                    className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors ${
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
                  </button>
                );
              })}
            </div>
          </div>

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
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-teal-dark text-white font-body text-sm font-light py-3 rounded-xl hover:brightness-90 transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-1"
          >
            {loading ? "Signing up..." : "sign up"}
          </button>
        </form>
      </Card>
    </div>
  );
};

export default Register;
