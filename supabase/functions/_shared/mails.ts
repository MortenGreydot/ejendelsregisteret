import { escapeHtml, sendEmail } from "./email.ts";
import { siteUrl } from "./config.ts";

/**
 * De konkrete mails systemet sender.
 *
 * Teksterne ligger samlet her frem for spredt ud i webhooken, så de kan
 * læses og rettes uden at rode med betalingslogikken.
 *
 * Funktionsnavnene er engelske, men hver har det danske navn i kommentaren
 * ovenover, så de kan findes ud fra det man kalder mailen i daglig tale.
 */

/** Velkomst. Medlemskabet er aktiveret — sendes når første betaling er gået igennem. */
export function membershipActive(to: string, name: string | null) {
  const greeting = name ? `Velkommen, ${name.split(" ")[0]}` : "Velkommen";

  return sendEmail({
    to,
    subject: "Dit medlemskab er aktivt",
    heading: `${greeting}.`,
    preheader:
      "Dit medlemskab er aktivt. Registrér din første ejendel. Det tager to minutter.",
    paragraphs: [
      "Din betaling er gennemført, og dit medlemskab er aktivt.",
      "Find noget med et serienummer: din cykel, dit v&aelig;rkt&oslash;j, din laptop. Tag et billede af genstanden og af m&aelig;rkaten med serienummeret, s&aring; er den dokumenteret.",
      "Det tager to minutter pr. ting, og s&aring; har du beviset klar den dag du f&aring;r brug for det.",
    ],
    button: {
      label: "Registrér din første ejendel",
      url: `${siteUrl()}/min-side`,
    },
    footnote:
      "Du kan til enhver tid se og opsige dit medlemskab under Min side.",
  });
}

/** Kvittering. Sendes når en faktura er betalt. */
export function receipt(
  to: string,
  amount: number,
  invoiceNumber: string | null,
  isFirstPayment: boolean,
) {
  const kr = amount.toLocaleString("da-DK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return sendEmail({
    to,
    subject: `Kvittering fra Ejendelsregisteret, ${kr} kr.`,
    heading: "Tak for din betaling",
    preheader: `Vi har modtaget ${kr} kr.`,
    paragraphs: [
      `Vi har modtaget <strong style="color:#1c2d4f;">${kr} kr.</strong>${
        isFirstPayment
          ? " for oprettelse og f&oslash;rste m&aring;ned."
          : " for din m&aring;nedlige betaling."
      }`,
      "Bel&oslash;bet er trukket p&aring; det kort du betalte med. Den fulde faktura finder du hos Stripe via linket nedenfor.",
    ],
    button: {
      label: "Se dit medlemskab",
      url: `${siteUrl()}/min-side?tab=profil`,
    },
    footnote: invoiceNumber ? `Fakturanummer: ${invoiceNumber}` : undefined,
  });
}

/** Betaling fejlede. Kortet skal fornys. */
export function paymentFailed(to: string) {
  return sendEmail({
    to,
    subject: "Vi kunne ikke trække din betaling",
    heading: "Betalingen gik ikke igennem",
    preheader:
      "Vi kunne ikke trække beløbet. Opdatér dit kort, så dit medlemskab fortsætter.",
    paragraphs: [
      "Vi fors&oslash;gte at tr&aelig;kke din m&aring;nedlige betaling, men den blev afvist. Det skyldes oftest et udl&oslash;bet kort eller manglende d&aelig;kning.",
      "Dine registrerede ejendele er bevaret, men du kan ikke oprette nye f&oslash;r betalingen er p&aring; plads.",
    ],
    button: { label: "Opdatér betaling", url: `${siteUrl()}/min-side` },
    footnote:
      "Vi forsøger automatisk igen de kommende dage. Du behøver ikke gøre noget, hvis du allerede har opdateret dit kort.",
  });
}

/** Konto oprettet. Sendes ved registrering, før betaling. */
export function accountCreated(to: string, name: string | null) {
  const greeting = name ? `Velkommen, ${name.split(" ")[0]}` : "Velkommen";

  return sendEmail({
    to,
    subject: "Din konto er oprettet",
    heading: `${greeting}.`,
    preheader: "Din konto hos Ejendelsregisteret er oprettet.",
    paragraphs: [
      "Din konto er oprettet. Sidste skridt er at aktivere dit medlemskab. Derefter kan du begynde at registrere dine ejendele.",
      "Med et medlemskab samler du serienummer, kvittering og billeder ét sted, s&aring; du har dokumentationen klar den dag noget bliver v&aelig;k, stj&aring;let eller br&aelig;ndt.",
    ],
    button: { label: "Aktivér dit medlemskab", url: `${siteUrl()}/priser` },
  });
}

/** Første ejendel. Den første registrering er gennemført. */
export function firstItem(to: string, itemName: string) {
  return sendEmail({
    to,
    subject: "Din første ejendel er registreret",
    heading: "Godt begyndt.",
    preheader: `${itemName} er nu registreret i Ejendelsregisteret.`,
    paragraphs: [
      `<strong style="color:#1c2d4f;">${itemName}</strong> er registreret. Den er dokumenteret med det du har lagt ind, og kan sl&aring;s op p&aring; sit serienummer hvis den bliver v&aelig;k.`,
      "Fors&aelig;t med resten. De fleste undervurderer hvor meget de ejer med et serienummer: telefon, cykel, v&aelig;rkt&oslash;j, kamera, ur.",
    ],
    button: { label: "Registrér flere", url: `${siteUrl()}/min-side` },
    footnote:
      "Mangler du serienummeret? Det står som regel på en mærkat i bunden, bag batteriet eller på rammen.",
  });
}

/** Grænse nået. Kvoten er fyldt op — flere ejendele koster ekstra. */
export function itemLimitReached(
  to: string,
  count: number,
  unitPrice: number,
) {
  return sendEmail({
    to,
    subject: `Du har registreret ${count} ejendele`,
    heading: `Du har brugt dine ${count} inkluderede ejendele.`,
    preheader: `Flere ejendele koster ${unitPrice} kr./md. pr. stk.`,
    paragraphs: [
      `Du har nu registreret <strong style="color:#1c2d4f;">${count} ejendele</strong>, alt hvad dit medlemskab inkluderer.`,
      `Du kan sagtens registrere flere. Hver ejendel derudover koster <strong style="color:#1c2d4f;">${unitPrice} kr./md.</strong> og l&aelig;gges p&aring; din n&aelig;ste faktura.`,
      "Bel&oslash;bet f&oslash;lger antallet: sletter du en ejendel igen, falder det tilsvarende.",
    ],
    button: { label: "Registrér flere", url: `${siteUrl()}/min-side` },
  });
}

/** Ingen ejendel endnu. Aktiv bruger uden registreringer efter et døgn. */
export function noItemsYet(to: string, name: string | null) {
  return sendEmail({
    to,
    subject: "Du har ikke registreret noget endnu",
    heading: name
      ? `${name.split(" ")[0]}, du mangler at komme i gang.`
      : "Du mangler at komme i gang.",
    preheader:
      "Dit medlemskab er aktivt, men der er ingen ejendele registreret endnu.",
    paragraphs: [
      "Dit medlemskab er aktivt, men der ligger ingen ejendele i dit register endnu. Det betyder ogs&aring; at der ikke er noget at dokumentere med, hvis uheldet sker.",
      "Start med &eacute;n ting. Tag telefonen, cyklen eller v&aelig;rkt&oslash;jet. Et billede af genstanden og et af m&aelig;rkaten med serienummeret er nok.",
    ],
    button: {
      label: "Registrér din første ejendel",
      url: `${siteUrl()}/min-side`,
    },
    footnote: "Det tager to minutter, og du kan altid tilføje flere senere.",
  });
}

/** Abonnement opsagt. Medlemskabet løber perioden ud. */
export function subscriptionCancelled(to: string, expiresOn: string | null) {
  return sendEmail({
    to,
    subject: "Dit medlemskab er opsagt",
    heading: "Dit medlemskab er opsagt.",
    preheader: expiresOn
      ? `Du har adgang frem til ${expiresOn}.`
      : "Du har adgang perioden ud.",
    paragraphs: [
      expiresOn
        ? `Vi har registreret din opsigelse. Du har fuld adgang frem til <strong style="color:#1c2d4f;">${expiresOn}</strong>, som du allerede har betalt for.`
        : "Vi har registreret din opsigelse. Du har fuld adgang resten af den betalte periode.",
      "Derefter kan du stadig se og hente dine registrerede ejendele, men ikke oprette nye.",
      "Har du dokumentation du kan f&aring; brug for til en forsikringssag, s&aring; hent den ned inden da.",
    ],
    button: {
      label: "Fortryd opsigelsen",
      url: `${siteUrl()}/min-side?tab=profil`,
    },
  });
}

/** Konto slettet. Alt indhold er fjernet permanent. */
export function accountDeleted(to: string) {
  return sendEmail({
    to,
    subject: "Din konto er slettet",
    heading: "Din konto er slettet.",
    preheader: "Dit abonnement er opsagt, og dine data er fjernet.",
    paragraphs: [
      "Din konto hos Ejendelsregisteret er slettet. Dit abonnement er opsagt, og dine ejendele, billeder og kvitteringer er fjernet permanent.",
      "Af hensyn til bogf&oslash;ringsloven gemmer vi dine betalingsoplysninger i fem &aring;r. De er ikke l&aelig;ngere knyttet til dig som person.",
      "Tak fordi du var med.",
    ],
  });
}

/** Kontaktbesked. Sendes til os selv, ikke til en bruger. */
export function contactMessage(input: {
  name: string;
  company: string | null;
  email: string;
  subject: string;
  message: string;
}) {
  const to = Deno.env.get("CONTACT_EMAIL") ?? "kontakt@ejendelsregisteret.dk";

  // Linjeskift skal bevares. Mailen er HTML, så \n betyder ingenting —
  // uden det her ville en besked med afsnit komme frem som én lang blok.
  const body = escapeHtml(input.message).replace(/\n/g, "<br>");

  const rows = [
    ["Navn", input.name],
    ...(input.company ? [["Virksomhed", input.company]] : []),
    ["E-mail", input.email],
    ["Emne", input.subject],
  ]
    .map(
      ([label, value]) =>
        `<strong style="color:#1c2d4f;">${label}:</strong> ${escapeHtml(value)}`,
    )
    .join("<br>");

  return sendEmail({
    to,
    // Svar-knappen skal ramme den der skrev, ikke vores egen infoadresse.
    replyTo: input.email,
    subject: `Kontakt: ${input.subject}`,
    heading: "Ny besked fra kontaktformularen",
    preheader: `${input.name}: ${input.subject}`,
    paragraphs: [rows, body],
    footnote: "Svar på denne mail for at skrive direkte til afsenderen.",
  });
}

/** Sammendrag af en henvendelse fra en finder. */
export type ContactRequest = {
  finderName: string;
  finderEmail: string;
  finderPhone: string | null;
  message: string;
  itemName: string;
  itemStatus: "registered" | "lost" | "stolen";
};

/**
 * Kontakt til ejer. Nogen har skrevet om en af deres ejendele.
 *
 * Kontakten er med vilje ensrettet. Det eneste vi lover er at vi ikke
 * udleverer ejerens oplysninger til finderen — en fremmed skal ikke kunne
 * åbne en kanal ind til en anden borger uden at vedkommende siger ja.
 *
 * Den anden vej er der intet løfte. Ejeren får finderens oplysninger og
 * kan svare direkte, og gør de det, kender finderen derefter også deres
 * adresse. Det er ejerens eget valg at føre kontakten videre, og netop
 * derfor står det i fodnoten at et svar afslører adressen.
 */
export function ownerContacted(
  to: string,
  ownerName: string | null,
  request: ContactRequest,
) {
  const hilsen = ownerName ? `${escapeHtml(ownerName.split(" ")[0])}, n` : "N";
  const body = escapeHtml(request.message).replace(/\n/g, "<br>");
  const item = escapeHtml(request.itemName);

  const indledning =
    request.itemStatus === "registered"
      ? `${hilsen}ogen har slået serienummeret på <strong style="color:#1c2d4f;">${item}</strong> op og skrevet til dig gennem Ejendelsregisteret.`
      : `${hilsen}ogen har slået serienummeret på <strong style="color:#1c2d4f;">${item}</strong> op, den du har meldt ${request.itemStatus === "stolen" ? "stj&aring;let" : "savnet"}, og skrevet til dig gennem Ejendelsregisteret.`;

  const kontakt = [
    `<strong style="color:#1c2d4f;">E-mail:</strong> <a href="mailto:${escapeHtml(request.finderEmail)}" style="color:#d2802e;">${escapeHtml(request.finderEmail)}</a>`,
    ...(request.finderPhone
      ? [`<strong style="color:#1c2d4f;">Telefon:</strong> ${escapeHtml(request.finderPhone)}`]
      : []),
  ].join("<br>");

  return sendEmail({
    to,
    // Svar går direkte til finderen. Modsat retning findes ikke: finderen
    // har aldrig set ejerens adresse og kan kun skrive gennem formularen.
    replyTo: request.finderEmail,
    subject: `Nogen har skrevet om din ${request.itemName}`,
    heading: "Der er en henvendelse til dig",
    preheader: `${request.finderName} har skrevet om din ${request.itemName}.`,
    paragraphs: [
      indledning,
      `<strong style="color:#1c2d4f;">${escapeHtml(request.finderName)} skriver:</strong>`,
      `<span style="display:block; border-left:3px solid #d2802e; padding-left:14px;">${body}</span>`,
      `Du kan svare direkte. Tryk Svar p&aring; denne mail, s&aring; g&aring;r den til ${escapeHtml(request.finderName)}. Deres oplysninger:`,
      kontakt,
    ],
    footnote:
      "Vær opmærksom: vi kan ikke bekræfte hvem afsenderen er. Svarer du direkte, kan de se din mailadresse. Aftal altid en overdragelse et offentligt sted, og send aldrig penge på forskud.",
  });
}

/**
 * Vores egen kopi af henvendelsen.
 *
 * Her står finderens oplysninger, så vi kan svare dem direkte når ejeren
 * skriver tilbage. Uden den kopi ville vi være mellemled uden at kende den
 * ene part.
 */
export function ownerContactCopy(request: ContactRequest & { itemId: string }) {
  const to = Deno.env.get("CONTACT_EMAIL") ?? "kontakt@ejendelsregisteret.dk";

  const rows = [
    ["Ejendel", request.itemName],
    ["Status", request.itemStatus],
    ["Ejendels-id", request.itemId],
    ["Fra", request.finderName],
    ["E-mail", request.finderEmail],
    ...(request.finderPhone ? [["Telefon", request.finderPhone]] : []),
  ]
    .map(
      ([label, value]) =>
        `<strong style="color:#1c2d4f;">${label}:</strong> ${escapeHtml(value)}`,
    )
    .join("<br>");

  return sendEmail({
    to,
    // Svar rammer finderen. Ejeren svarer på sin egen mail, som også
    // lander her — så begge retninger går gennem den samme indbakke.
    replyTo: request.finderEmail,
    subject: `Finder → ejer: ${request.itemName}`,
    heading: "Kopi: henvendelse sendt til ejeren",
    preheader: `${request.finderName} om ${request.itemName}`,
    paragraphs: [
      "Ejeren har f&aring;et beskeden nedenfor med finderens kontaktoplysninger, s&aring; de kan svare direkte. Denne kopi er til jer, s&aring; I kan f&oslash;lge op.",
      rows,
      `<span style="display:block; border-left:3px solid #d2802e; padding-left:14px;">${escapeHtml(request.message).replace(/\n/g, "<br>")}</span>`,
    ],
    footnote:
      "Ejeren kan svare finderen direkte. Denne kopi er jeres spor på henvendelsen. Svar på den for selv at skrive til finderen.",
  });
}
