import { useQuery } from "@tanstack/react-query";
import { getMyStaffProfile } from "../../../../logic/api/staffApi";
import IdVerificationQueue, {
  type UserTypeOption,
} from "../../shared/idVerification/IdVerificationQueue";

// Staff dashboard's ID Verification tab (Management → ID Verification). Any
// staff member reviews Adopter and Volunteer IDs at their shelter; its
// manager also reviews Staff and Vet IDs — the filter options mirror what
// the server returns to each.
const IdVerification = () => {
  const { data: profile } = useQuery({
    queryKey: ["staff", "me"],
    queryFn: getMyStaffProfile,
  });
  const isManager = profile?.staffDesignation === "Manager";

  const userTypeOptions: UserTypeOption[] = [
    { value: "all", label: "All" },
    { value: "Adopter", label: "Adopters" },
    { value: "Volunteer", label: "Volunteers" },
    ...(isManager
      ? ([
          { value: "Staff", label: "Staff" },
          { value: "Veterinarian", label: "Vets" },
        ] satisfies UserTypeOption[])
      : []),
  ];

  return (
    <IdVerificationQueue
      scope="staff"
      message={
        isManager
          ? "Review government ID submissions from people at your shelter"
          : "Review government ID submissions from adopters and volunteers at your shelter"
      }
      userTypeOptions={userTypeOptions}
    />
  );
};

export default IdVerification;
