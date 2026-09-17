// StaffApprovalsWidget.tsx
// Placeholder for the admin Overview page — there's no pending-approval
// concept for staff yet (StaffAccountStatus is only Active/Deactivated, no
// approve/reject endpoint, no Staff tab built). Same treatment as the
// adopter dashboard's not-yet-built Notifications/Appointments stats: an
// honest empty state, no fake data, no "View All" link since there's nowhere
// real to send it yet.
import { OverviewWidgetCard } from "../../../../../../components/ui/dashboard/DashboardWidgetHeader";

const StaffApprovalsWidget = () => (
  <OverviewWidgetCard
    icon="🧑‍💼"
    title="Staff Approvals"
    isEmpty
    emptyMessage="Staff approval workflows aren't set up yet."
  />
);

export default StaffApprovalsWidget;
