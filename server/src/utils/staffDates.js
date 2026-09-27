// The Staff date columns that go with an accountStatus change — shared by
// every path that changes it (admin/staff.service.js's updateStaffStatus,
// staff/shelterStaff.service.js's updateStatus, staff/staff.service.js's
// closeMyAccount) so they can't drift:
// - Active: staffDOJ (Date of Joining) is stamped the first time only — a
//   reactivation keeps the original — and staffDOS is cleared.
// - Deactivated: staffDOS (Date of Separation) is stamped, but only for
//   someone who actually joined; declining a Pending registration leaves
//   both dates empty.
// `current` is the row's existing { staffDOJ }.
const staffStatusDates = (accountStatus, current, now = new Date()) => {
  if (accountStatus === "Active") {
    return current.staffDOJ
      ? { staffDOS: null }
      : { staffDOJ: now, staffDOS: null };
  }
  if (accountStatus === "Deactivated" && current.staffDOJ) {
    return { staffDOS: now };
  }
  return {};
};

module.exports = { staffStatusDates };
