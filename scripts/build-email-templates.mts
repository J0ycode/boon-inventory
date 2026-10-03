/**
 * Generates Supabase Auth email templates from src/config/brand.ts and keeps the subjects in
 * supabase/config.toml in sync. Run with `pnpm brand:emails` after changing the brand.
 *
 * Links use {{ .RedirectTo }} (the tenant's own /auth/confirm URL, passed by the app) so the session
 * cookie is set on the tenant's subdomain.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { brand } from "../src/config/brand.ts";

const root = join(import.meta.dirname, "..");
const templatesDir = join(root, "supabase", "templates");
mkdirSync(templatesDir, { recursive: true });

type Template = {
  file: string;
  key: string;
  subject: string;
  heading: string;
  body: string;
  cta: string;
  type: string;
};

const templates: Template[] = [
  {
    file: "invite.html",
    key: "invite",
    subject: `You're invited to ${brand.name}`,
    heading: "You've been invited",
    body: `You have been added to your shop's ${brand.name} account. Choose a password to get started.`,
    cta: "Accept invite",
    type: "invite",
  },
  {
    file: "recovery.html",
    key: "recovery",
    subject: `Reset your ${brand.name} password`,
    heading: "Reset your password",
    body: "We received a request to reset your password. If this wasn't you, you can ignore this email.",
    cta: "Choose a new password",
    type: "recovery",
  },
];

const html = (t: Template) => `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>${t.subject}</title></head>
  <body style="margin:0;padding:24px;background:#f5f7f7;font-family:Arial,Helvetica,sans-serif;color:#1f2a2a">
    <table role="presentation" width="100%" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px">
      <tr><td>
        <div style="display:inline-block;background:${brand.colors.primary};color:${brand.colors.primaryForeground};font-weight:700;border-radius:8px;padding:6px 10px">${brand.logo.mark}</div>
        <span style="font-weight:700;margin-left:8px">${brand.name}</span>
        <h1 style="font-size:20px;margin:24px 0 8px">${t.heading}</h1>
        <p style="font-size:15px;line-height:1.5;margin:0 0 24px">${t.body}</p>
        <a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=${t.type}"
           style="display:inline-block;background:${brand.colors.primary};color:${brand.colors.primaryForeground};text-decoration:none;font-weight:700;border-radius:8px;padding:12px 20px">${t.cta}</a>
        <p style="font-size:12px;color:#5b6b6b;margin:24px 0 0">This link can be used once and expires in one hour. Sent to {{ .Email }}.</p>
      </td></tr>
    </table>
  </body>
</html>
`;

for (const t of templates) {
  writeFileSync(join(templatesDir, t.file), html(t));
}

// Keep subjects in config.toml in sync with the brand.
const configPath = join(root, "supabase", "config.toml");
let config = readFileSync(configPath, "utf8");
for (const t of templates) {
  const section = new RegExp(`(\\[auth\\.email\\.template\\.${t.key}\\]\\r?\\nsubject = )"[^"]*"`);
  if (!section.test(config)) throw new Error(`config.toml is missing [auth.email.template.${t.key}]`);
  config = config.replace(section, `$1"${t.subject}"`);
}
writeFileSync(configPath, config);

console.log(`Wrote ${templates.length} email templates for "${brand.name}".`);
