// components/ui/dashboard/PaginationControls.tsx
// Previous / "Page X of Y" / Next row under a paginated dashboard list.
// Renders nothing when there's only one page. The caller owns `page`.
import ButtonElement from "../ButtonElement";

interface PaginationControlsProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

const buttonClass =
  "rounded-lg border border-neutral-gray px-4 py-2 text-sm font-medium text-neutral-dark hover:bg-neutral-lightgray disabled:opacity-40";

const PaginationControls = ({ page, totalPages, onChange }: PaginationControlsProps) =>
  totalPages > 1 ? (
    <div className="mt-6 flex items-center justify-center gap-4">
      <ButtonElement
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page === 1}
        size="bare"
        variant="outline"
        className={buttonClass}
      >
        Previous
      </ButtonElement>
      <span className="font-body text-sm text-neutral-gray">
        Page {page} of {totalPages}
      </span>
      <ButtonElement
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        size="bare"
        variant="outline"
        className={buttonClass}
      >
        Next
      </ButtonElement>
    </div>
  ) : null;

export default PaginationControls;
