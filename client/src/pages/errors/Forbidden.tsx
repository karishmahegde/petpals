// Forbidden.tsx
// Page: Shown when an authenticated user's role doesn't permit access to a route
// Reached via RoleRoute redirect or a 403 from axiosInstance
// Route: /forbidden
import { useNavigate } from "react-router-dom";
import Card from "../../components/ui/Card";
import backgroundImg from "../../assets/images/background.png";

const Forbidden = () => {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen bg-cover bg-center flex items-center justify-center px-4 py-10"
      style={{ backgroundImage: `url(${backgroundImg})` }}
    >
      <Card className="w-full max-w-md p-12 text-center">
        <p className="text-6xl mb-4">🐾</p>
        <h1 className="font-display text-3xl text-neutral-dark mb-3">
          Oops, no entry!
        </h1>
        <p className="font-body text-sm text-neutral-gray mb-8">
          Looks like you sniffed out a page that isn&apos;t meant for you.
          You don&apos;t have permission to view this one.
        </p>
        <button
          type="button"
          onClick={() => navigate("/")}
          className="w-full bg-teal-dark text-white font-body text-sm font-light py-3 rounded-xl hover:brightness-90 transition-all"
        >
          go back home
        </button>
      </Card>
    </div>
  );
};

export default Forbidden;
