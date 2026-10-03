// DateBlock.tsx
// Month over day-of-month, the leading column of the volunteer dashboard's
// event and appointment rows (same look as the Staff Overview's Upcoming
// Events) — the Overview widgets and the Events tab.
const DateBlock = ({ iso }: { iso: string }) => {
  const date = new Date(iso);
  return (
    <div className="w-14 shrink-0 text-center">
      <p className="font-body text-sm font-bold text-neutral-charcoal">
        {date.toLocaleDateString("en-US", { month: "short" })}
      </p>
      <p className="font-display text-3xl font-light text-neutral-charcoal">
        {date.getDate()}
      </p>
    </div>
  );
};

export default DateBlock;
