// Email content. Every email is built by renderEmail() so they all share one
// plain layout and each comes as both HTML and plain text (some inboxes show
// only the text part). One function per email gets added here as each flow is
// built; callers reach them through services/email/index.js.

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// A link into the frontend, e.g. clientLink("/verify-email", { token }).
const clientLink = (path, params = {}) => {
  const url = new URL(path, CLIENT_URL);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
};

// Builds { subject, text, html } from plain pieces. Every value is escaped, so
// names and staff remarks can go in as-is.
//   heading    — first line of the body
//   paragraphs — array of plain-text paragraphs
//   action     — optional { label, url }: a button (and the bare URL in text)
//   footnote   — optional small print under everything
const renderEmail = ({ subject, heading, paragraphs = [], action, footnote }) => {
  const textParts = [heading, ...paragraphs];
  if (action) textParts.push(`${action.label}: ${action.url}`);
  if (footnote) textParts.push(footnote);
  textParts.push("— The PetPals team");

  const htmlParagraphs = paragraphs
    .map((p) => `<p style="margin:0 0 16px">${escapeHtml(p)}</p>`)
    .join("");
  const htmlAction = action
    ? `<p style="margin:24px 0">
        <a href="${escapeHtml(action.url)}" style="background:#CA7D7D;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block">${escapeHtml(action.label)}</a>
      </p>
      <p style="margin:0 0 16px;font-size:13px;color:#8A8A8A">Or paste this link into your browser:<br>${escapeHtml(action.url)}</p>`
    : "";
  const htmlFootnote = footnote
    ? `<p style="margin:24px 0 0;font-size:13px;color:#8A8A8A">${escapeHtml(footnote)}</p>`
    : "";

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#FAFAFA;font-family:Montserrat,Arial,sans-serif;color:#1A1A1A">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;padding:32px">
      <h1 style="margin:0 0 20px;font-size:20px">${escapeHtml(heading)}</h1>
      ${htmlParagraphs}
      ${htmlAction}
      ${htmlFootnote}
      <p style="margin:24px 0 0">— The PetPals team</p>
    </div>
  </body>
</html>`;

  return { subject, text: textParts.join("\n\n"), html };
};

// "Hi Sam," — or just "Hi," when there's no name on the account yet.
const greeting = (name) => (name ? `Hi ${name},` : "Hi,");

// ——————————————— Account emails ———————————————

const verifyEmail = ({ name, url }) =>
  renderEmail({
    subject: "Verify your PetPals email address",
    heading: greeting(name),
    paragraphs: [
      "Please confirm this is your email address. You'll need a verified email to apply to adopt or to donate.",
      "This link works once and expires in 24 hours.",
    ],
    action: { label: "Verify email", url },
    footnote: "Didn't create a PetPals account? You can ignore this email.",
  });

const passwordReset = ({ name, url }) =>
  renderEmail({
    subject: "Reset your PetPals password",
    heading: greeting(name),
    paragraphs: [
      "We got a request to reset the password on your PetPals account. Use the button below to choose a new one.",
      "This link works once and expires in 1 hour.",
    ],
    action: { label: "Reset password", url },
    footnote: "Didn't ask for this? You can ignore this email — your password won't change.",
  });

const passwordChanged = ({ name }) =>
  renderEmail({
    subject: "Your PetPals password was changed",
    heading: greeting(name),
    paragraphs: [
      "The password on your PetPals account was just changed, and any other signed-in sessions were signed out.",
      "If this was you, there's nothing else to do.",
    ],
    action: {
      label: "Wasn't you? Reset your password",
      url: clientLink("/forgot-password"),
    },
  });

const reactivateAccount = ({ name, url }) =>
  renderEmail({
    subject: "Reactivate your PetPals account",
    heading: greeting(name),
    paragraphs: [
      "You asked to reopen the PetPals account you closed. Use the button below to reactivate it.",
      "This link works once and expires in 24 hours.",
    ],
    action: { label: "Reactivate account", url },
    footnote: "Didn't ask for this? You can ignore this email — your account stays closed.",
  });

// To the NEW address — proves the person can receive mail there.
const confirmEmailChange = ({ name, newEmail, url }) =>
  renderEmail({
    subject: "Confirm your new PetPals email address",
    heading: greeting(name),
    paragraphs: [
      `Confirm that ${newEmail} should become the email address for your PetPals account. You'll use it to log in from then on.`,
      "This link works once and expires in 24 hours.",
    ],
    action: { label: "Confirm new email", url },
    footnote: "Didn't ask for this? You can ignore this email — nothing will change.",
  });

// To the OLD address, when the change is requested and again once it's done,
// so a hijacked session can't quietly move the account.
const emailChangeRequested = ({ name, newEmail }) =>
  renderEmail({
    subject: "A request to change your PetPals email address",
    heading: greeting(name),
    paragraphs: [
      `Someone signed in to your PetPals account asked to change its email address to ${newEmail}. Nothing changes until the link sent to that address is opened.`,
      "If this wasn't you, reset your password now.",
    ],
    action: { label: "Reset password", url: clientLink("/forgot-password") },
  });

const emailChanged = ({ name, newEmail }) =>
  renderEmail({
    subject: "Your PetPals email address was changed",
    heading: greeting(name),
    paragraphs: [
      `The email address for your PetPals account is now ${newEmail}. This address won't receive PetPals emails any more.`,
      "If this wasn't you, contact the PetPals team straight away.",
    ],
  });

// ——————————————— Account notices ———————————————
// `loginUrl` is the role's own login page (workers use the staff portal).

const accountClosed = ({ name, loginUrl }) =>
  renderEmail({
    subject: "Your PetPals account is closed",
    heading: greeting(name),
    paragraphs: [
      "You closed your PetPals account, and you've been signed out everywhere. Your details are kept in case you come back.",
      "Changed your mind? Log in with your usual email and password and choose to email yourself a reactivation link.",
    ],
    action: { label: "Go to login", url: loginUrl },
    footnote: "Didn't close your account? Reset your password from the login page straight away.",
  });

const accountDeleted = ({ name }) =>
  renderEmail({
    subject: "Your PetPals account was deleted",
    heading: greeting(name),
    paragraphs: [
      "You deleted your PetPals account. Your profile and personal details have been removed, and this email address can be used to sign up again.",
      "Thank you for being part of PetPals.",
    ],
  });

const accountApproved = ({ name, loginUrl }) =>
  renderEmail({
    subject: "Your PetPals account is approved",
    heading: greeting(name),
    paragraphs: ["Good news — your PetPals account has been approved. You can now log in and use your dashboard."],
    action: { label: "Log in", url: loginUrl },
  });

const accountDeclined = ({ name }) =>
  renderEmail({
    subject: "Your PetPals sign-up",
    heading: greeting(name),
    paragraphs: [
      "Thank you for your interest in PetPals. Your sign-up wasn't approved, so this account can't be used to log in.",
      "If you think this is a mistake, please get in touch with the shelter you signed up with.",
    ],
  });

const accountDeactivated = ({ name }) =>
  renderEmail({
    subject: "Your PetPals account was deactivated",
    heading: greeting(name),
    paragraphs: [
      "Your PetPals account has been deactivated by the PetPals team, so you can no longer log in.",
      "If you believe this is a mistake, please contact support.",
    ],
  });

const accountBanned = ({ name }) =>
  renderEmail({
    subject: "Your PetPals account was suspended",
    heading: greeting(name),
    paragraphs: [
      "Your PetPals account has been suspended by the PetPals team, so you can no longer log in.",
      "If you believe this is a mistake, please contact support.",
    ],
  });

const accountRestored = ({ name, loginUrl }) =>
  renderEmail({
    subject: "Your PetPals account is active again",
    heading: greeting(name),
    paragraphs: ["Your PetPals account has been reactivated by the PetPals team. You can log in again."],
    action: { label: "Log in", url: loginUrl },
  });

module.exports = {
  clientLink,
  renderEmail,
  verifyEmail,
  passwordReset,
  passwordChanged,
  reactivateAccount,
  confirmEmailChange,
  emailChangeRequested,
  emailChanged,
  accountClosed,
  accountDeleted,
  accountApproved,
  accountDeclined,
  accountDeactivated,
  accountBanned,
  accountRestored,
};
