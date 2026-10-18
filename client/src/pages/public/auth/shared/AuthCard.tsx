// AuthCard.tsx
// The full-screen background + centred card that the emailed-link pages
// (VerifyEmail, ForgotPassword, ResetPassword, Reactivate) share with the
// login forms, plus the field/button classes they all use. `portal`
// "staff" swaps in the worker portal's background, like WorkerLogin.
import type { ReactNode } from "react";
import Card from "../../../../components/ui/Card";
import backgroundImg from "../../../../static/assets/images/background.png";
import backgroundAdminImg from "../../../../static/assets/images/background-admin.png";

export const authLabelClass = "font-body text-sm font-bold text-neutral-black";
export const authInputClass =
  "border border-neutral-gray rounded-lg px-4 py-2.5 font-body text-sm text-neutral-dark placeholder:text-neutral-gray focus:outline-none focus:border-teal-dark";
export const authPrimaryButtonClass =
  "w-full rounded-xl bg-rose-dark py-3 font-body text-sm font-semibold hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60";
export const authBodyClass = "font-body text-sm text-neutral-charcoal";

interface AuthCardProps {
  title: string;
  portal?: "public" | "staff";
  children: ReactNode;
}

const AuthCard = ({ title, portal = "public", children }: AuthCardProps) => (
  <div
    className="flex min-h-screen items-center justify-center bg-cover bg-fixed bg-center px-4 py-2"
    style={{
      backgroundImage: `url(${portal === "staff" ? backgroundAdminImg : backgroundImg})`,
    }}
  >
    <Card className="w-full max-w-md p-12">
      <h1 className="mb-6 text-center font-display text-3xl text-neutral-dark">
        {title}
      </h1>
      <div className="flex flex-col gap-5">{children}</div>
    </Card>
  </div>
);

export default AuthCard;
