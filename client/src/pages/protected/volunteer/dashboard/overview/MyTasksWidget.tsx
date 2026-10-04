// MyTasksWidget.tsx
// "My Tasks" on the volunteer Overview — the volunteer's open tasks (GET
// /volunteers/me/tasks?taskStatus=In_progress), soonest due first, so
// overdue ones lead and carry a badge. "View All" goes to the My Tasks tab,
// where they're marked done.
import { useQuery } from "@tanstack/react-query";
import { OverviewWidgetCard } from "../../../../../components/ui/dashboard/DashboardWidgetHeader";
import {
  DashboardListRow,
  type RowLine,
} from "../../../../../components/ui/dashboard/DashboardList";
import { TASK_NAME_LABEL } from "../../../../../logic/staff/tasks";
import { formatShortDate, formatTime } from "../../../../../logic/utils/datetime";
import { activeTasksQuery } from "./overviewQueries";

const MyTasksWidget = () => {
  const { data, isLoading } = useQuery(activeTasksQuery);
  const tasks = data?.data ?? [];

  return (
    <OverviewWidgetCard
      icon="📋"
      title="My Tasks"
      action={{ label: "View All", to: "/volunteer/tasks" }}
      className="min-h-[420px]"
      isLoading={isLoading}
      isEmpty={tasks.length === 0}
      emptyMessage="No open tasks — you're all caught up"
    >
      <ul className="flex flex-col gap-4">
        {tasks.map((task) => {
          const lines: RowLine[] = [{ text: task.taskDesc }];
          if (task.taskDue) {
            const due = new Date(task.taskDue);
            lines.push({
              text: `Due: ${formatShortDate(due)}, ${formatTime(due)}`,
              strong: true,
            });
          }

          return (
            <li key={task.taskID}>
              <DashboardListRow
                className="bg-teal-light"
                title={TASK_NAME_LABEL[task.taskName]}
                lines={lines}
                badge={
                  task.status === "Overdue"
                    ? { label: "Overdue", tone: "red" }
                    : undefined
                }
              />
            </li>
          );
        })}
      </ul>
    </OverviewWidgetCard>
  );
};

export default MyTasksWidget;
