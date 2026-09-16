// StaffApprovalsWidget.tsx
// Placeholder for the admin Overview page — there's no pending-approval
// concept for staff yet (StaffAccountStatus is only Active/Deactivated, no
// approve/reject endpoint, no Staff tab built). Same treatment as the
// adopter dashboard's not-yet-built Notifications/Appointments stats: an
// honest empty state, no fake data, no "View All" link since there's nowhere
// real to send it yet.
import Card from "../../../../../components/ui/Card";
import DashboardWidgetHeader from "../../../../../components/ui/dashboard/DashboardWidgetHeader";

const StaffApprovalsWidget = () => (
  <Card className="p-4 sm:p-6">
    <DashboardWidgetHeader icon="🧑‍💼" title="Staff Approvals" />
    <p className="py-8 text-center font-body text-sm text-neutral-gray">
      Staff approval workflows aren't set up yet.
    </p>
  </Card>
);

export default StaffApprovalsWidget;
