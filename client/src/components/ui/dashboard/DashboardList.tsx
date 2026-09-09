// components/ui/dashboard/DashboardList.tsx
// The generic dashboard-list kit, shared across every role's dashboard sections
// (applications, visits, appointments, …):
//
//   DashboardListRow    — how one row looks: leading visual | title + sub-lines
//                         | badge + action buttons. Pure layout, no data.
//   DashboardActionList — how a list of rows behaves when they share one
//                         "confirm, then mutate" action (withdraw, cancel, …):
//                         owns the <ul>, the pending-item state, the mutation +
//                         toasts + query invalidation, and the confirm modal.
//   RowMedallion / RowActionButton — the recurring pieces of a row.
//
// A feature supplies a `renderRow` that builds a DashboardListRow from its own
// data, plus a `confirmAction` config — see ApplicationsList / VisitsList.
import { useState, type Key, type ReactNode } from "react";
import {
  useMutation,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import toast from "react-hot-toast";
import ButtonElement from "../ButtonElement";
import ConfirmActionModal from "../ConfirmActionModal";

// ————————————————————————————— DashboardListRow —————————————————————————————

export interface RowBadge {
  label: ReactNode;
  /** Tailwind bg + text classes, e.g. "bg-green text-white". */
  className: string;
}

export interface RowLine {
  text: ReactNode;
  /** Bold + charcoal instead of the default gray. */
  strong?: boolean;
}

interface DashboardListRowProps {
  /** Left-hand visual — an avatar/photo, an icon medallion, a date block… */
  leading?: ReactNode;
  title: ReactNode;
  lines?: RowLine[];
  badge?: RowBadge;
  /** Right-aligned buttons, shown under the badge. */
  actions?: ReactNode;
  /** Row background (and any other overrides). Defaults to bg-gold-lightest. */
  className?: string;
}

export const DashboardListRow = ({
  leading,
  title,
  lines = [],
  badge,
  actions,
  className = "bg-gold-lightest",
}: DashboardListRowProps) => (
  <div
    className={`flex flex-col gap-4 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between ${className}`}
  >
    <div className="flex items-center gap-4">
      {leading}
      <div className="min-w-0">
        <p className="font-body text-sm font-medium text-neutral-charcoal">
          {title}
        </p>
        {lines.map((line, i) => (
          <p
            key={i}
            className={`font-body text-xs ${
              line.strong
                ? "font-light text-neutral-charcoal"
                : "text-neutral-gray"
            }`}
          >
            {line.text}
          </p>
        ))}
      </div>
    </div>

    {(badge || actions) && (
      <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
        {badge && (
          <span
            className={`rounded-full px-4 py-1.5 font-body text-xs font-light ${badge.className}`}
          >
            {badge.label}
          </span>
        )}
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    )}
  </div>
);

// ————————————————————————————— Row companions —————————————————————————————

interface RowMedallionProps {
  /** Photo URL; when absent, `fallback` is shown on a `tone` circle. */
  src?: string | null;
  alt?: string;
  fallback: ReactNode;
  /** Ring around the circle. */
  ring?: string;
  /** Background tint behind the fallback icon. */
  tone?: string;
}

export const RowMedallion = ({
  src,
  alt = "",
  fallback,
  ring = "ring-2 ring-teal-dark",
  tone = "bg-rose-light",
}: RowMedallionProps) =>
  src ? (
    <img
      src={src}
      alt={alt}
      className={`h-16 w-16 shrink-0 rounded-full object-cover ${ring}`}
    />
  ) : (
    <div
      className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full ${tone} ${ring}`}
    >
      {fallback}
    </div>
  );

type RowActionVariant = "primary" | "danger";

const ACTION_VARIANT: Record<RowActionVariant, string> = {
  primary: "bg-teal-dark",
  danger: "bg-rose-md",
};

interface RowActionButtonProps {
  children: ReactNode;
  onClick: () => void;
  variant?: RowActionVariant;
  disabled?: boolean;
}

// The generic ButtonElement in its compact size, with a row-action colour.
export const RowActionButton = ({
  children,
  onClick,
  variant = "primary",
  disabled = false,
}: RowActionButtonProps) => (
  <ButtonElement
    onClick={onClick}
    disabled={disabled}
    size="sm"
    className={`hover:brightness-90 ${ACTION_VARIANT[variant]}`}
  >
    {children}
  </ButtonElement>
);

// ———————————————————————————— DashboardActionList ————————————————————————————

export interface ConfirmActionConfig<T> {
  mutationFn: (item: T) => Promise<unknown>;
  /** Query keys invalidated on success. */
  invalidateKeys: QueryKey[];
  successToast: string;
  errorToast: string;
  modalTitle: string;
  confirmLabel: string;
  /** Modal body copy for the item awaiting confirmation. */
  renderBody: (item: T) => ReactNode;
}

interface DashboardActionListProps<T> {
  items: T[];
  getKey: (item: T) => Key;
  /**
   * Builds one row. `confirm` opens the confirmation modal for that item —
   * wire it to the row's destructive button.
   */
  renderRow: (item: T, confirm: (item: T) => void) => ReactNode;
  /** Omit for a list whose rows have no confirm-then-mutate action. */
  confirmAction?: ConfirmActionConfig<T>;
}

export function DashboardActionList<T>({
  items,
  getKey,
  renderRow,
  confirmAction,
}: DashboardActionListProps<T>) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<T | null>(null);

  const mutation = useMutation({
    mutationFn: (item: T) => confirmAction!.mutationFn(item),
    onSuccess: () => {
      confirmAction!.invalidateKeys.forEach((queryKey) =>
        queryClient.invalidateQueries({ queryKey }),
      );
      toast.success(confirmAction!.successToast);
      setPending(null);
    },
    onError: () => toast.error(confirmAction!.errorToast),
  });

  return (
    <>
      <ul className="flex flex-col gap-4">
        {items.map((item) => (
          <li key={getKey(item)}>{renderRow(item, (it) => setPending(it))}</li>
        ))}
      </ul>

      {confirmAction && (
        <ConfirmActionModal
          isOpen={pending !== null}
          title={confirmAction.modalTitle}
          confirmLabel={confirmAction.confirmLabel}
          isPending={mutation.isPending}
          onCancel={() => setPending(null)}
          onConfirm={() => {
            if (pending) mutation.mutate(pending);
          }}
        >
          {pending && confirmAction.renderBody(pending)}
        </ConfirmActionModal>
      )}
    </>
  );
}
