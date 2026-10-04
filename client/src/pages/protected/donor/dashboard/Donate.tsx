import DashboardHeading from "../../../../components/ui/dashboard/DashboardHeading";
import Card from "../../../../components/ui/Card";
import DashboardWidgetHeader from "../../../../components/ui/dashboard/DashboardWidgetHeader";
import DonateForm from "./shared/DonateForm";

// Donate tab (/donor/donate) — the donate form on its own (the Overview
// shows the same one). Also where Stripe returns a donor who cancels
// checkout.
const Donate = () => (
  <div className="mx-auto max-w-3xl">
    <DashboardHeading
      title="Donate"
      emoji="💰"
      message="Every dollar goes to the shelter you choose"
    />
    <Card className="p-6">
      <DashboardWidgetHeader icon="🐾" title="Make a Donation" className="mb-4" />
      <DonateForm idPrefix="donate" />
    </Card>
  </div>
);

export default Donate;
