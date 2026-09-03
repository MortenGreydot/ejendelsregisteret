/**
 * Afsendelse af mails via Resend.
 *
 * HTTP frem for SMTP: edge functions kan godt tale TCP, men Simplys relay
 * afviser forbindelser der ikke kommer fra deres egne webservere. Resend
 * tager imod et almindeligt fetch-kald, og så slipper vi for STARTTLS,
 * base64-login og fortolkning af svarkoder.
 *
 * Identifikatorer er på engelsk, teksterne til modtageren på dansk.
 */

const FROM = "Ejendelsregisteret <info@ejendelsregisteret.dk>";

/** Adressen i List-Unsubscribe. Skal være en postkasse der bliver læst. */
const UNSUBSCRIBE = "kontakt@ejendelsregisteret.dk";

const NAVY = "#1c2d4f";
const ORANGE = "#d2802e";
const BODY = "#4f5763";
const MUTED = "#8b93a1";
const LINE = "#e3e6ea";
const MIST = "#eff1f4";

/** Abhaya Libre findes kun i få mailklienter — Georgia bærer resten. */
const FF =
  "font-family:'Abhaya Libre',Georgia,'Times New Roman',serif;";

/** Knap. `label` er knapteksten. */
export type Button = { label: string; url: string };

/** Indholdet i én mail. Feltnavnene på dansk står i kommentarerne. */
export type EmailContent = {
  /** overskrift — vises som h1 øverst i mailen */
  heading: string;
  /** præambel — forhåndsvisningen i indbakken, skjult i selve mailen */
  preheader: string;
  /** afsnit — brødteksten, ét <p> pr. element */
  paragraphs: string[];
  /** knap — den orange handlingsknap */
  button?: Button;
  /** fodnote — den lille grå tekst under stregen */
  footnote?: string;
};

/**
 * Bygger en komplet mail-HTML. (skabelon)
 *
 * Tabeller og inline styles, fordi Outlook på Windows renderer med Words
 * motor og hverken kan flexbox eller stylesheets i <head>.
 */
function template({
  heading,
  preheader,
  paragraphs,
  button,
  footnote,
}: EmailContent) {
  const buttonHtml = button
    ? `<tr><td style="padding:28px 32px 0 32px;">
         <table role="presentation" cellpadding="0" cellspacing="0" border="0">
           <tr><td bgcolor="${ORANGE}" style="border-radius:4px; mso-padding-alt:14px 28px;">
             <a href="${button.url}" target="_blank" style="display:inline-block; padding:14px 28px; ${FF} font-size:15px; font-weight:700; color:#ffffff; text-decoration:none;">${button.label}</a>
           </td></tr>
         </table>
       </td></tr>`
    : "";

  const paragraphsHtml = paragraphs
    .map(
      (text) =>
        `<tr><td style="padding:16px 32px 0 32px;"><p style="margin:0; ${FF} font-size:16px; line-height:1.65; color:${BODY};">${text}</p></td></tr>`,
    )
    .join("");

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
  <!-- Preheader: vises i indbakkens forhåndsvisning, men ikke i mailen. -->
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

        ${
          footnote
            ? `<tr><td class="px" style="padding:28px 32px 0 32px;">
                 <div style="height:1px; background:${LINE}; font-size:1px; line-height:1px;">&nbsp;</div>
               </td></tr>
               <tr><td class="px" style="padding:16px 32px 0 32px;">
                 <p style="margin:0; ${FF} font-size:13px; line-height:1.6; color:${MUTED};">${footnote}</p>
               </td></tr>`
            : ""
        }

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

/**
 * Bygger tekstudgaven af mailen. (ren tekst)
 *
 * En mail der kun findes som HTML er et spamsignal i sig selv — både
 * SpamAssassin og Gmail vægter det, fordi ægte afsendere sender begge dele
 * og masseudsendere sjældent gider. Derfor følger en tekstudgave med hver
 * eneste mail, bygget af det samme indhold så de to aldrig kan sige noget
 * forskelligt.
 *
 * Knappen bliver til sin egen adresse skrevet ud. En tekstmail kan ikke
 * have en knap, og en mail hvor handlingen kun findes i HTML-udgaven er
 * ubrugelig for den der læser den anden.
 */
function plainText({
  heading,
  paragraphs,
  button,
  footnote,
}: EmailContent): string {
  const dele = [
    stripHtml(heading),
    ...paragraphs.map(stripHtml),
    ...(button ? [`${stripHtml(button.label)}: ${button.url}`] : []),
    ...(footnote ? [stripHtml(footnote)] : []),
    "—\nEjendelsregisteret · ejendelsregisteret.dk\nDu modtager denne mail fordi du har en konto hos os.",
  ];

  return dele.filter(Boolean).join("\n\n");
}

/** HTML → læsbar tekst. Kun de entiteter vores egne skabeloner bruger. */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&aelig;/g, "æ")
    .replace(/&oslash;/g, "ø")
    .replace(/&aring;/g, "å")
    .replace(/&Aelig;/g, "Æ")
    .replace(/&Oslash;/g, "Ø")
    .replace(/&Aring;/g, "Å")
    .replace(/&eacute;/g, "é")
    .replace(/&middot;/g, "·")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // &amp; til sidst, ellers ville den kunne genskabe en anden entitet.
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/**
 * Sender en mail. Kaster aldrig.
 *
 * Kaldes fra Stripe-webhooken, og dér må en mailfejl ikke vælte behandlingen:
 * svarer vi 500, prøver Stripe eventet igen, og så ville betalinger blive
 * bogført to gange for at få en mail afsted. Mailen er det mindst kritiske
 * i kæden og skal fejle stille.
 *
 * `to` er modtageren, `subject` er emnet.
 */
export async function sendEmail(
  options: EmailContent & {
    to: string;
    subject: string;
    /** Svaradresse. Bruges til kontaktformularen, så Svar går til afsenderen. */
    replyTo?: string;
    /**
     * Sæt på de mails vi selv finder på at sende — påmindelser og puf.
     *
     * Tilføjer List-Unsubscribe, som postkasserne kigger efter på alt der
     * ikke er udløst af brugerens egen handling. Uden den ryger et puf let
     * i spam; med den viser Gmail i stedet sin egen afmeldingsknap.
     *
     * Kvitteringer, velkomst og betalingsbeskeder skal IKKE have den: de er
     * transaktionelle, og en afmeldingsknap på en kvittering er forkert.
     */
    unsubscribe?: boolean;
  },
): Promise<{ ok: boolean; error?: string }> {
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
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [options.to],
        subject: options.subject,
        ...(options.replyTo ? { reply_to: [options.replyTo] } : {}),
        ...(options.unsubscribe
          ? {
              headers: {
                "List-Unsubscribe": `<mailto:${UNSUBSCRIBE}?subject=Afmeld>`,
              },
            }
          : {}),
        html: template(options),
        text: plainText(options),
      }),
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

/**
 * Escaper tekst der skal ind i mail-HTML.
 *
 * Alt fra kontaktformularen er skrevet af en fremmed. Uden det her kunne en
 * besked indeholde <a href> eller <img src> og gøre vores egen mail til
 * bæreren af et link vi ikke har skrevet.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
