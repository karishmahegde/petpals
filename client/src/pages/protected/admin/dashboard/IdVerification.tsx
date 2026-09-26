import IdVerificationQueue, {
  type UserTypeOption,
} from "../../shared/idVerification/IdVerificationQueue";

// Admin dashboard's ID Verification tab. Admin reviews shelter Managers'
// IDs and other Admins' (never their own) — everyone else at a shelter is
// reviewed by its manager or staff. The server scopes the queue; the
// "Staff" type here only ever returns Managers.
const USER_TYPE_OPTIONS: UserTypeOption[] = [
  { value: "all", label: "All" },
  { value: "Staff", label: "Managers" },
  { value: "Admin", label: "Admins" },
];

const IdVerification = () => (
  <IdVerificationQueue
    scope="admin"
    message="Review government ID submissions from shelter managers and admins"
    userTypeOptions={USER_TYPE_OPTIONS}
  />
);

export default IdVerification;
