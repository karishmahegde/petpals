// Login.tsx
// Page: Public login form for all user roles
// Responsibilities:
//   - Renders email and password fields with client-side validation
//   - Calls authApi.login() on submit and handles loading/error states
//   - On success: stores session in Zustand and redirects to role-based dashboard
//   - On failure: displays server error message inline
// Route: /login
import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import Card from "../../../components/ui/Card";
import axios from "axios";
import { login as loginApi } from "../../../logic/api/authApi";
import useAuthStore from "../../../logic/store/useAuthStore";
import backgroundImg from "../../../static/assets/images/background.png";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const Login = () => {
  const { token, role } = useAuthStore();

  const navigate = useNavigate(); // for programmatic navigation — redirecting the user to a different route from inside the code rather than from a link click
  const storeLogin = useAuthStore((state) => state.login); // zustand global state management with token

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (token && role) {
    return <Navigate to={`/${role.toLowerCase()}`} replace />;
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
      storeLogin(user, token, user.role);
      navigate(`/${user.role.toLowerCase()}`, { replace: true });
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
          <button
            type="button"
            className="flex-1 py-2.5 font-body text-sm text-white bg-rose-dark transition-colors"
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => navigate("/register")}
            className="flex-1 py-2.5 font-body text-sm text-neutral-dark bg-rose-md hover:brightness-95 transition-colors"
          >
            Sign up
          </button>
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
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-teal-dark text-white font-body text-sm font-light py-3 rounded-xl hover:brightness-90 transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-1"
          >
            {loading ? "Signing in..." : "sign in"}
          </button>
        </form>
      </Card>
    </div>
  );
};

export default Login;
