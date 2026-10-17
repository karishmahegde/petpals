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

module.exports = { clientLink, renderEmail, verifyEmail, passwordReset, passwordChanged };
