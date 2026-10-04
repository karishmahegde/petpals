// ShelterDetailsWidget.tsx
// "Shelter Details" on the vet and volunteer Overviews — the shelter's name,
// address, phone and email (from GET /vets/me's or /volunteers/me's
// shelter). The page passes the profile it already has.
import { OverviewWidgetCard } from "../../../components/ui/dashboard/DashboardWidgetHeader";
import PhoneDisplay from "../../../components/ui/PhoneDisplay";

interface ShelterContact {
  shelterName: string;
  shelterAddress: string;
  shelterPhone: string;
  shelterEmail: string;
}

interface ShelterDetailsWidgetProps {
  shelter: ShelterContact | null | undefined;
  isLoading: boolean;
}

const DetailLine = ({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) => (
  <p className="flex items-start gap-2 font-body text-sm text-neutral-charcoal">
    <span role="img" aria-label={label} className="shrink-0">
      {icon}
    </span>
    <span className="min-w-0 break-words">{children}</span>
  </p>
);

const ShelterDetailsWidget = ({ shelter, isLoading }: ShelterDetailsWidgetProps) => (
  <OverviewWidgetCard
    icon="🏢"
    title="Shelter Details"
    isLoading={isLoading}
    isEmpty={!shelter}
    emptyMessage="You're not assigned to a shelter"
  >
    {shelter && (
      <div className="flex flex-col gap-3">
        <DetailLine icon="📍" label="Shelter">
          <span className="font-semibold">{shelter.shelterName}</span>
          <span className="block text-neutral-gray">{shelter.shelterAddress}</span>
        </DetailLine>
        <DetailLine icon="📞" label="Phone">
          <PhoneDisplay value={shelter.shelterPhone} />
        </DetailLine>
        <DetailLine icon="✉️" label="Email">
          <a href={`mailto:${shelter.shelterEmail}`} className="hover:underline">
            {shelter.shelterEmail}
          </a>
        </DetailLine>
      </div>
    )}
  </OverviewWidgetCard>
);

export default ShelterDetailsWidget;
