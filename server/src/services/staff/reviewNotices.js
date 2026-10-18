const { queueEmail, templates } = require("../email");
const { getUserContact } = require("../auth/userContact");
const { loginUrlFor } = require("../auth/accountNotices");

// Emails about a review someone else made: a government ID verified or
// rejected, an adoption application approved or declined. Same contract as
// auth/accountNotices.js — called after the write has committed, never
// throws (a failed lookup or send is logged and the request still succeeds).

const logFailure = (what, id, err) => {
  console.error(`[email] couldn't send the ${what} notice for ${id}: ${err.message}`);
};

// After PATCH /government-ids/:id/status, to the ID's owner.
const governmentIdReviewed = async (userID, verificationStatus) => {
  const template =
    verificationStatus === "Verified"
      ? "governmentIdVerified"
      : verificationStatus === "Rejected"
        ? "governmentIdRejected"
        : null;
  if (!template) return;
  try {
    const contact = await getUserContact(userID);
    if (!contact) return;
    queueEmail({
      to: contact.email,
      ...templates[template]({
        name: contact.name,
        awaitingApproval: contact.accountStatus === "Pending",
        loginUrl: loginUrlFor(contact.role),
      }),
    });
  } catch (err) {
    logFailure("government ID", `user ${userID}`, err);
  }
};

// After staff/admin accept or reject an application. `applications` is a
// list of { email, name, status, staffRemark } — the decided one plus, on an
// accept, the pet's other applications that were declined automatically.
// The caller already has the contacts (from the same transaction), so no
// lookup here.
const applicationsDecided = ({ petName, shelterName, applications }) => {
  applications.forEach(({ email, name, status, staffRemark }) => {
    const template =
      status === "Accepted"
        ? "applicationApproved"
        : status === "Rejected"
          ? "applicationDeclined"
          : null;
    if (!template || !email) return;
    try {
      queueEmail({
        to: email,
        ...templates[template]({ name, petName, shelterName, staffRemark }),
      });
    } catch (err) {
      logFailure("application decision", email, err);
    }
  });
};

module.exports = { governmentIdReviewed, applicationsDecided };
