// In-app notification content. One function per NotificationType, each
// returning { type, title, body, link } — the row notify() stores. Callers
// reach these through services/notifications/index.js (and the seed, so its
// rows read exactly like real ones).
// `link` is a client path to the page where the person acts on it (with a
// query parameter where that page can open the item itself).
// No dates or times in the text: the server would have to pick a timezone,
// and the linked page already shows them in the viewer's own.

// DB role → its dashboard root, the same map as the client's
// dashboardPathFor (client/src/logic/route/resolveDestination.ts).
const DASHBOARD = {
  Admin: "/admin",
  Adopter: "/adopter",
  Staff: "/staff",
  Veterinarian: "/vet",
  Volunteer: "/volunteer",
  Donor: "/donor",
};

// TaskName enum value → how the sentence names it.
const TASK_PHRASE = {
  Animal_Care: "an animal care task",
  Vet_Assistance: "a vet assistance task",
  Cleaning: "a cleaning task",
  Feeding: "a feeding task",
  Events: "an event support task",
  Admin: "an admin task",
  Other: "a new task",
};

const usd = (amount) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

const message = (type, title, body, link) => ({ type, title, body, link });

// ——————————————— Adopter ———————————————
const applicationSubmitted = ({ petName, shelterName }) =>
  message(
    "ApplicationSubmitted",
    "Application submitted",
    `Your application for ${petName} at ${shelterName} is in. We'll let you know when the shelter decides.`,
    "/adopter/applications",
  );

const applicationApproved = ({ petName, shelterName }) =>
  message(
    "ApplicationApproved",
    "Application approved",
    `${shelterName} approved your application for ${petName}.`,
    "/adopter/applications",
  );

const applicationDeclined = ({ petName, shelterName }) =>
  message(
    "ApplicationDeclined",
    "Application update",
    `${shelterName} has declined your application for ${petName}.`,
    "/adopter/applications",
  );

// ?visitID= opens that visit's details on the Visits page.
const visitConfirmed = ({ shelterName, petName, visitID }) =>
  message(
    "VisitConfirmed",
    "Visit confirmed",
    petName
      ? `${shelterName} confirmed your visit to meet ${petName}.`
      : `${shelterName} confirmed your visit.`,
    `/adopter/visits?visitID=${visitID}`,
  );

const visitCancelled = ({ shelterName, petName, visitID }) =>
  message(
    "VisitCancelled",
    "Visit cancelled",
    petName
      ? `${shelterName} cancelled your visit to meet ${petName}.`
      : `${shelterName} cancelled your visit.`,
    `/adopter/visits?visitID=${visitID}`,
  );

const appointmentScheduled = ({ petName }) =>
  message(
    "AppointmentScheduled",
    "Vet appointment scheduled",
    `A vet appointment has been scheduled for ${petName}.`,
    "/adopter/appointments",
  );

// To the adopter or the vet — `role` picks whose appointments page.
const appointmentChanged = ({ petName, role }) =>
  message(
    "AppointmentChanged",
    "Appointment changed",
    `The vet appointment for ${petName} has been changed.`,
    `${DASHBOARD[role]}/appointments`,
  );

const appointmentCancelled = ({ petName, role }) =>
  message(
    "AppointmentCancelled",
    "Appointment cancelled",
    `The vet appointment for ${petName} has been cancelled.`,
    `${DASHBOARD[role]}/appointments`,
  );

// Any role with a government ID — the Profile is where it's shown and
// re-uploaded.
const governmentIdVerified = ({ role }) =>
  message(
    "GovernmentIdVerified",
    "Government ID verified",
    "Your government ID has been verified.",
    `${DASHBOARD[role]}/profile`,
  );

const governmentIdRejected = ({ role }) =>
  message(
    "GovernmentIdRejected",
    "Government ID needs another look",
    "Your government ID couldn't be verified. Please upload a new one from your Profile.",
    `${DASHBOARD[role]}/profile`,
  );

// ——————————————— Shelter staff ———————————————
const newApplication = ({ adopterName, petName }) =>
  message(
    "NewApplication",
    "New adoption application",
    `${adopterName} applied for ${petName}.`,
    "/staff/applications",
  );

const newVisitRequest = ({ adopterName, petName }) =>
  message(
    "NewVisitRequest",
    "New visit request",
    petName
      ? `${adopterName} asked to visit and meet ${petName}.`
      : `${adopterName} asked to visit.`,
    "/staff/visits",
  );

const applicationWithdrawn = ({ adopterName, petName }) =>
  message(
    "ApplicationWithdrawn",
    "Application withdrawn",
    `${adopterName} withdrew their application for ${petName}.`,
    "/staff/applications",
  );

const visitCancelledByAdopter = ({ adopterName, petName }) =>
  message(
    "VisitCancelledByAdopter",
    "Visit cancelled",
    petName
      ? `${adopterName} cancelled their visit to meet ${petName}.`
      : `${adopterName} cancelled their visit.`,
    "/staff/visits",
  );

// Who signed up decides who approves them, and so the page:
// Volunteer → shelter staff, Staff/Veterinarian → the shelter's manager,
// Manager → admins.
const SIGNUP_KIND = {
  Volunteer: { label: "volunteer", link: "/staff/volunteers" },
  Staff: { label: "staff member", link: "/staff/team" },
  Veterinarian: { label: "veterinarian", link: "/staff/vets" },
  Manager: { label: "shelter manager", link: "/admin/staff" },
};

const signupReadyForApproval = ({ name, kind }) =>
  message(
    "SignupReadyForApproval",
    "Sign-up ready for approval",
    `${name} finished signing up as a ${SIGNUP_KIND[kind].label} and is waiting for approval.`,
    SIGNUP_KIND[kind].link,
  );

const transferIncoming = ({ petName, fromShelterName }) =>
  message(
    "TransferIncoming",
    "Incoming transfer",
    `${fromShelterName} wants to transfer ${petName} to your shelter.`,
    "/staff/transfers",
  );

const transferCompleted = ({ petName, toShelterName }) =>
  message(
    "TransferCompleted",
    "Transfer completed",
    `${toShelterName} accepted the transfer of ${petName}.`,
    "/staff/transfers",
  );

const transferRejected = ({ petName, toShelterName }) =>
  message(
    "TransferRejected",
    "Transfer declined",
    `${toShelterName} declined the transfer of ${petName}.`,
    "/staff/transfers",
  );

const transferCancelled = ({ petName, fromShelterName }) =>
  message(
    "TransferCancelled",
    "Transfer cancelled",
    `${fromShelterName} cancelled the transfer of ${petName}.`,
    "/staff/transfers",
  );

const capacityAlert = ({ shelterName }) =>
  message(
    "CapacityAlert",
    "Capacity alert",
    `An admin flagged ${shelterName} as close to capacity. Consider transferring some pets to another shelter.`,
    "/staff/transfers",
  );

// ——————————————— Veterinarian ———————————————
const appointmentAssigned = ({ petName }) =>
  message(
    "AppointmentAssigned",
    "New appointment",
    `You've been assigned an appointment for ${petName}.`,
    "/vet/appointments",
  );

// ——————————————— Volunteer ———————————————
const taskAssigned = ({ taskName }) =>
  message(
    "TaskAssigned",
    "New task",
    `You've been assigned ${TASK_PHRASE[taskName] ?? "a new task"}.`,
    "/volunteer/tasks",
  );

const eventAssigned = ({ eventName }) =>
  message(
    "EventAssigned",
    "You're on an event",
    `You've been assigned to ${eventName}.`,
    "/volunteer/events",
  );

const eventCancelled = ({ eventName }) =>
  message(
    "EventCancelled",
    "Event cancelled",
    `${eventName} has been cancelled.`,
    "/volunteer/events",
  );

const appointmentAssistAssigned = ({ petName }) =>
  message(
    "AppointmentAssistAssigned",
    "Assisting an appointment",
    `You've been asked to assist at the vet appointment for ${petName}.`,
    "/volunteer/appointments",
  );

const appointmentAssistCancelled = ({ petName }) =>
  message(
    "AppointmentAssistCancelled",
    "Appointment assist cancelled",
    `You're no longer needed at the vet appointment for ${petName}.`,
    "/volunteer/appointments",
  );

// ——————————————— Donor ———————————————
const donationReceived = ({ amount, shelterName }) =>
  message(
    "DonationReceived",
    "Thank you for your donation",
    `Your ${usd(amount)} donation to ${shelterName} has been received.`,
    "/donor/history",
  );

// ——————————————— Admin ———————————————
const adminSignupPending = ({ name }) =>
  message(
    "AdminSignupPending",
    "New admin sign-up",
    `${name} registered as an admin and is waiting for approval.`,
    "/admin/admins",
  );

module.exports = {
  applicationSubmitted,
  applicationApproved,
  applicationDeclined,
  visitConfirmed,
  visitCancelled,
  appointmentScheduled,
  appointmentChanged,
  appointmentCancelled,
  governmentIdVerified,
  governmentIdRejected,
  newApplication,
  newVisitRequest,
  applicationWithdrawn,
  visitCancelledByAdopter,
  signupReadyForApproval,
  transferIncoming,
  transferCompleted,
  transferRejected,
  transferCancelled,
  capacityAlert,
  appointmentAssigned,
  taskAssigned,
  eventAssigned,
  eventCancelled,
  appointmentAssistAssigned,
  appointmentAssistCancelled,
  donationReceived,
  adminSignupPending,
};
