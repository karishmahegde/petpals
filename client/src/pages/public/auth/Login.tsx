// Login.tsx
// Page: Public login form for all user roles
// Responsibilities:
//   - Renders email and password fields with client-side validation
//   - Calls authApi.login() on submit and handles loading/error states
//   - On success: stores session in Zustand and redirects to role-based dashboard
//   - On failure: displays server error message inline
// Route: /login
import { useState } from "react";
import { unstable_batchedUpdates } from "react-dom";
import { useNavigate, Navigate, useSearchParams } from "react-router-dom";
import Card from "../../../components/ui/Card";
import ButtonElement from "../../../components/ui/ButtonElement";
import axios from "axios";
import { login as loginApi } from "../../../logic/api/authApi";
import { clearOnboardingSkipped } from "../../../logic/onboardingSkip";
import { resolveDestination } from "../../../logic/route/resolveDestination";
import useAuthStore from "../../../logic/store/useAuthStore";
import backgroundImg from "../../../static/assets/images/background.png";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const Login = () => {
  const [searchParams] = useSearchParams();
  // Query param, not location.state — survives a page refresh mid-login,
  // which state would not.
  const redirect = searchParams.get("redirect");

  const navigate = useNavigate(); // for programmatic navigation — redirecting the user to a different route from inside the code rather than from a link click
  const storeLogin = useAuthStore((state) => state.login); // zustand global state management with token

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Captured once, on mount — true only if a session already existed when
  // this page was first reached (e.g. visiting /login directly while
  // already logged in). Deliberately NOT reactive to later token/role
  // changes: handleSubmit navigates explicitly on a fresh login, and
  // staying reactive here would re-run this same redirect during that same
  // store update, racing with the explicit navigate() and producing a
  // stray render where this component returns nothing — a visible flash
  // of blank space inside PublicLayout's Navbar/Footer before the real
  // destination appears.
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
    // field validation
    if (!email.trim()) return "Please enter your email";
    if (!emailRegex.test(email)) return "Please enter a valid email address";
    if (!password) return "Please enter your password";
    return "";
  };

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    // Form submit handler — validates, calls login API, updates auth store, redirects
    e.preventDefault(); // prevent default refresh
    const validationError = validate(); // validate entries
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setLoading(true);
    try {
      // sending the credentials to the login API
      const { token, user } = await loginApi({ email, password });
      // A real credential login — not the silent session-restore bootstrap
      // in App.tsx — is the one point that should undo a prior "Skip for
      // now" (see onboardingSkip.ts): next login shows the onboarding form
      // again if it's still incomplete.
      clearOnboardingSkipped();
      // storeLogin (Zustand) and navigate (React Router) are two unrelated
      // subscriptions — without forcing them into one batch, Navbar (which
      // reads the store directly) can commit and paint the "logged in" chip
      // a frame before the route actually changes away from /login, which
      // reads as the navbar updating while the login form is still on
      // screen. batchedUpdates forces both into a single commit.
      unstable_batchedUpdates(() => {
        storeLogin(user, token, user.role);
        navigate(resolveDestination(user.role, redirect), { replace: true });
      });
    } catch (err: unknown) {
      // error runs when no server
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
        <h1 className="font-display text-3xl text-center text-neutral-dark mb-6">
          Sign in 🐶
        </h1>

        {/* Sign in / Sign up tabs */}
        <div className="flex rounded-xl overflow-hidden mb-8">
          <ButtonElement
            size="bare"
            className="flex-1 py-2.5 text-sm bg-rose-dark"
          >
            Sign in
          </ButtonElement>
          <ButtonElement
            onClick={() => navigate("/register")}
            size="bare"
            variant="outline"
            className="flex-1 py-2.5 text-sm text-neutral-dark bg-rose-md hover:brightness-95"
          >
            Sign up
          </ButtonElement>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          noValidate // to override browser's validation from running, and use validate()
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
              placeholder="jane.doe@email.com"
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
            className="w-full bg-teal-dark text-sm font-light py-3 rounded-xl hover:bg-gold-dark transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-1"
          >
            {loading ? "Signing in..." : "sign in"}
          </ButtonElement>
        </form>
      </Card>
    </div>
  );
};

export default Login;
