// WorkerLogin.tsx
// Page: Login form for the worker portal (Admin, Staff, Veterinarian) —
// structurally identical to the public Login.tsx (same email/password
// fields, same validation, same session-restore/redirect logic via the
// shared resolveDestination) since POST /auth/login is already role-agnostic.
// Only the copy and the Sign up tab's target route differ; a separate page
// exists so worker accounts have their own discoverable entry point instead
// of being buried in the public /login flow.
// Route: /staff-portal/login
import { useState } from "react";
import { unstable_batchedUpdates } from "react-dom";
import { useNavigate, Navigate, useSearchParams } from "react-router-dom";
import Card from "../../../components/ui/Card";
import ButtonElement from "../../../components/ui/ButtonElement";
import axios from "axios";
import { login as loginApi } from "../../../logic/api/authApi";
import { clearOnboardingSkipped } from "../../../logic/onboardingSkip";
import useAuthStore from "../../../logic/store/useAuthStore";
import backgroundImg from "../../../static/assets/images/background-admin.png";
import { resolveDestination } from "../../../logic/route/resolveDestination";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const WorkerLogin = () => {
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get("redirect");

  const navigate = useNavigate();
  const storeLogin = useAuthStore((state) => state.login);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Same "captured once, on mount" rationale as Login.tsx — see there.
  const [alreadyAuthenticated] = useState(() => {
    const { token, role } = useAuthStore.getState();
    return token && role ? { role } : null;
  });

  if (alreadyAuthenticated) {
    return (
      <Navigate
        to={resolveDestination(alreadyAuthenticated.role, redirect)}
        replace
      />
    );
  }

  const validate = (): string => {
    if (!email.trim()) return "Please enter your email";
    if (!emailRegex.test(email)) return "Please enter a valid email address";
    if (!password) return "Please enter your password";
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
      const { token, user } = await loginApi({ email, password });
      clearOnboardingSkipped();
      unstable_batchedUpdates(() => {
        storeLogin(user, token, user.role);
        navigate(resolveDestination(user.role, redirect), { replace: true });
      });
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
      className="min-h-screen bg-cover bg-center bg-fixed flex items-center justify-center px-4 py-2"
      style={{ backgroundImage: `url(${backgroundImg})` }}
    >
      <Card className="w-full max-w-md p-12">
        {/* Heading */}
        <h1 className="font-display text-3xl text-center text-neutral-dark mb-2">
          Staff Portal 🧑‍💼
        </h1>
        <p className="text-center font-body text-sm text-neutral-gray mb-6">
          For Admin, Staff, and Veterinarian accounts
        </p>

        {/* Sign in / Sign up tabs */}
        <div className="flex rounded-xl overflow-hidden mb-8">
          <ButtonElement size="bare" className="flex-1 py-2.5 text-sm bg-teal-dark">
            Sign in
          </ButtonElement>
          <ButtonElement
            onClick={() => navigate("/staff-portal/register")}
            size="bare"
            variant="outline"
            className="flex-1 py-2.5 text-sm text-neutral-dark bg-teal-md hover:brightness-95"
          >
            Sign up
          </ButtonElement>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex flex-col gap-5"
        >
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
            className="w-full bg-gold-md text-sm font-light py-3 rounded-xl hover:brightness-90 transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-1"
          >
            {loading ? "Signing in..." : "sign in"}
          </ButtonElement>
        </form>

        <p className="mt-6 text-center font-body text-xs text-neutral-gray">
          Looking to adopt, volunteer, or donate?{" "}
          <ButtonElement
            onClick={() => navigate("/login")}
            size="bare"
            variant="outline"
            className="font-semibold text-teal-dark underline"
          >
            Sign in here
          </ButtonElement>
        </p>
      </Card>
    </div>
  );
};

export default WorkerLogin;
