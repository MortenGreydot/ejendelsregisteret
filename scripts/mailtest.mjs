// deno-shim.js
import { readFileSync } from "node:fs";
var fraFil = {};
try {
  for (const linje of readFileSync(
    new URL("../.env.local", import.meta.url),
    "utf8"
  ).split("\n")) {
    const m = linje.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) fraFil[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
}
globalThis.Deno = globalThis.Deno ?? {
  env: {
    get(key) {
      if (key === "SITE_URL")
        return process.env.SITE_URL ?? fraFil.SITE_URL ?? "https://ejendelsregisteret.dk";
      return process.env[key] ?? fraFil[key];
    }
  }
};

// ../../../../../../Users/mortenpedersen/Desktop/ejendelsregisteret/supabase/functions/_shared/email.ts
var FROM = "Ejendelsregisteret <info@ejendelsregisteret.dk>";
var UNSUBSCRIBE = "kontakt@ejendelsregisteret.dk";
var NAVY = "#1c2d4f";
var ORANGE = "#d2802e";
var BODY = "#4f5763";
var MUTED = "#8b93a1";
var LINE = "#e3e6ea";
var MIST = "#eff1f4";
var FF = "font-family:'Abhaya Libre',Georgia,'Times New Roman',serif;";
function template({
  heading,
  preheader,
  paragraphs,
  button,
  footnote
}) {
  const buttonHtml = button ? `<tr><td style="padding:28px 32px 0 32px;">
         <table role="presentation" cellpadding="0" cellspacing="0" border="0">
           <tr><td bgcolor="${ORANGE}" style="border-radius:4px; mso-padding-alt:14px 28px;">
             <a href="${button.url}" target="_blank" style="display:inline-block; padding:14px 28px; ${FF} font-size:15px; font-weight:700; color:#ffffff; text-decoration:none;">${button.label}</a>
           </td></tr>
         </table>
       </td></tr>` : "";
  const paragraphsHtml = paragraphs.map(
    (text) => `<tr><td style="padding:16px 32px 0 32px;"><p style="margin:0; ${FF} font-size:16px; line-height:1.65; color:${BODY};">${text}</p></td></tr>`
  ).join("");
  return `<!DOCTYPE html>
<html lang="da"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${heading}</title>
<style>
  @media only screen and (max-width:600px) {
    .wrap { width:100% !important; }
    .px { padding-left:20px !important; padding-right:20px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:${MIST};">
  <!-- Preheader: vises i indbakkens forh\xE5ndsvisning, men ikke i mailen. -->
  <div style="display:none; max-height:0; overflow:hidden; opacity:0;">${preheader}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${MIST};">
    <tr><td align="center" style="padding:32px 12px;">
      <table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px; background-color:#ffffff; border:1px solid ${LINE}; border-radius:6px;">

        <tr><td class="px" style="padding:28px 32px 0 32px;">
          <div style="${FF} font-size:17px; font-weight:700; color:${NAVY};">Ejendelsregisteret</div>
          <div style="${FF} font-size:10px; font-weight:700; letter-spacing:1.6px; text-transform:uppercase; color:${ORANGE}; padding-top:3px;">D&aelig;kker alt, over alt</div>
        </td></tr>

        <tr><td class="px" style="padding:24px 32px 0 32px;">
          <h1 style="margin:0; ${FF} font-size:24px; line-height:1.25; font-weight:700; color:${NAVY};">${heading}</h1>
        </td></tr>

        ${paragraphsHtml}
        ${buttonHtml}

        ${footnote ? `<tr><td class="px" style="padding:28px 32px 0 32px;">
                 <div style="height:1px; background:${LINE}; font-size:1px; line-height:1px;">&nbsp;</div>
               </td></tr>
               <tr><td class="px" style="padding:16px 32px 0 32px;">
                 <p style="margin:0; ${FF} font-size:13px; line-height:1.6; color:${MUTED};">${footnote}</p>
               </td></tr>` : ""}

        <tr><td class="px" style="padding:28px 32px 28px 32px;">
          <p style="margin:0; ${FF} font-size:12px; line-height:1.6; color:${MUTED};">
            Ejendelsregisteret &middot; ejendelsregisteret.dk<br>
            Du modtager denne mail fordi du har en konto hos os.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`;
}
function plainText({
  heading,
  paragraphs,
  button,
  footnote
}) {
  const dele = [
    stripHtml(heading),
    ...paragraphs.map(stripHtml),
    ...button ? [`${stripHtml(button.label)}: ${button.url}`] : [],
    ...footnote ? [stripHtml(footnote)] : [],
    "\u2014\nEjendelsregisteret \xB7 ejendelsregisteret.dk\nDu modtager denne mail fordi du har en konto hos os."
  ];
  return dele.filter(Boolean).join("\n\n");
}
function stripHtml(html) {
  return html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&aelig;/g, "\xE6").replace(/&oslash;/g, "\xF8").replace(/&aring;/g, "\xE5").replace(/&Aelig;/g, "\xC6").replace(/&Oslash;/g, "\xD8").replace(/&Aring;/g, "\xC5").replace(/&eacute;/g, "\xE9").replace(/&middot;/g, "\xB7").replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/[ \t]+/g, " ").trim();
}
async function sendEmail(options) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) {
    console.error("sendEmail: RESEND_API_KEY mangler");
    return { ok: false, error: "RESEND_API_KEY mangler" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: FROM,
        to: [options.to],
        subject: options.subject,
        ...options.replyTo ? { reply_to: [options.replyTo] } : {},
        ...options.unsubscribe ? {
          headers: {
            "List-Unsubscribe": `<mailto:${UNSUBSCRIBE}?subject=Afmeld>`
          }
        } : {},
        html: template(options),
        text: plainText(options)
      })
    });
    if (!res.ok) {
      const detail = await res.text();
      console.error(`sendEmail: ${res.status} ${detail}`);
      return { ok: false, error: detail };
    }
    return { ok: true };
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
    console.error("sendEmail:", message);
    return { ok: false, error: message };
  }
}

// ../../../../../../Users/mortenpedersen/Desktop/ejendelsregisteret/supabase/functions/_shared/config.ts
function siteUrl() {
  return requireEnv("SITE_URL").replace(/\/$/, "");
}
function requireEnv(name) {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Manglende milj\xF8variabel: ${name}`);
  }
  return value;
}

// ../../../../../../Users/mortenpedersen/Desktop/ejendelsregisteret/supabase/functions/_shared/mails.ts
function checkoutAbandoned(to, name) {
  const greeting = name ? `${name.split(" ")[0]}, du` : "Du";
  return sendEmail({
    to,
    subject: "Du blev ikke f\xE6rdig med din betaling",
    heading: `${greeting} mangler \xE9t skridt.`,
    preheader: "Betalingen blev ikke gennemf\xF8rt. Der er ikke trukket penge \u2014 du kan g\xF8re det f\xE6rdigt n\xE5r du vil.",
    paragraphs: [
      'Du gik i gang med at oprette dit medlemskab, men betalingen blev ikke gennemf&oslash;rt. <strong style="color:#1c2d4f;">Der er ikke trukket nogen penge.</strong>',
      "Vil du g&oslash;re det f&aelig;rdigt, tager det under et minut. Bagefter kan du registrere dine f&oslash;rste ejendele og have dokumentationen klar den dag noget bliver v&aelig;k."
    ],
    button: {
      label: "F\xE6rdigg\xF8r din betaling",
      url: `${siteUrl()}/min-side`
    },
    footnote: "Har du fortrudt, kan du roligt se bort fra denne mail. Vi sender kun denne ene p\xE5mindelse.",
    unsubscribe: true
  });
}
function accountCreated(to, name) {
  const greeting = name ? `Velkommen, ${name.split(" ")[0]}` : "Velkommen";
  return sendEmail({
    to,
    subject: "Din konto er oprettet",
    heading: `${greeting}.`,
    preheader: "Din konto hos Ejendelsregisteret er oprettet.",
    paragraphs: [
      "Din konto er oprettet. Sidste skridt er at aktivere dit medlemskab. Derefter kan du begynde at registrere dine ejendele.",
      "Med et medlemskab samler du serienummer, kvittering og billeder \xE9t sted, s&aring; du har dokumentationen klar den dag noget bliver v&aelig;k, stj&aring;let eller br&aelig;ndt."
    ],
    button: { label: "Aktiv\xE9r dit medlemskab", url: `${siteUrl()}/priser` }
  });
}

// mailtest.ts
var MODTAGERE = [
  "swixza@gmail.com",
  "Morten-kris@live.dk",
  "morten@greydot.dk"
];
for (const til of MODTAGERE) {
  const a = await accountCreated(til, "Morten");
  console.log(
    `${a.ok ? "OK " : "FEJL"}  transaktionel (konto oprettet)  ->  ${til}  ${a.ok ? "" : a.error}`
  );
  const b = await checkoutAbandoned(til, "Morten");
  console.log(
    `${b.ok ? "OK " : "FEJL"}  puf (afbrudt betaling)          ->  ${til}  ${b.ok ? "" : b.error}`
  );
}
