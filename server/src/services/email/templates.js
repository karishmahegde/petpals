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

module.exports = { clientLink, renderEmail };
