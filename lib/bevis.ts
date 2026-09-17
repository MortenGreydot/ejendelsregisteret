import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

import { COMPANY } from "./legal";

/**
 * Dokumentationen som PDF. (bevis)
 *
 * Hele produktet handler om at kunne bevise ejerskab den dag noget er væk.
 * Det bevis skal kunne forlade sitet: et forsikringsselskab og en politi-
 * anmeldelse tager imod en fil, ikke et login.
 *
 * PDF'en bygges i browseren frem for på serveren. Billederne ligger i en
 * public bucket, og brugeren har dem allerede i sin egen fane — at sende
 * dem op til en server for at få dem ned igen ville koste båndbredde og
 * ventetid uden at give noget.
 *
 * Skrifttypen er Helvetica, en af PDF-standardens egne. Den kræver ingen
 * indlejring og dækker æ, ø og å gennem WinAnsi. En pænere skrift ville
 * betyde en fontfil på flere hundrede kilobyte i hver eneste fil.
 */

/** A4 i punkter. */
const SIDE = { bredde: 595.28, hoejde: 841.89 };
const MARGEN = 56;
const INDHOLD = SIDE.bredde - MARGEN * 2;

const NAVY = rgb(0.11, 0.176, 0.31);
const ORANGE = rgb(0.824, 0.502, 0.18);
const BODY = rgb(0.31, 0.341, 0.388);
const MUTED = rgb(0.545, 0.576, 0.631);
const LINJE = rgb(0.89, 0.902, 0.918);

export type BevisDokument = { name: string; url: string; type: string };

export type BevisEjendel = {
  id: string;
  name: string;
  category: string | null;
  brand: string | null;
  model: string | null;
  serials: string[];
  purchaseDate: string | null;
  purchasePrice: number | null;
  currentValue: number | null;
  retailer: string | null;
  description: string | null;
  status: "registered" | "lost" | "stolen";
  statusChangedAt: string | null;
  createdAt: string;
  imageUrls: string[];
  documents: BevisDokument[];
};

const dkDato = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("da-DK", { dateStyle: "long" }) : "—";

const kroner = (beloeb: number | null) =>
  beloeb === null
    ? "—"
    : `${beloeb.toLocaleString("da-DK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr.`;

const STATUS: Record<BevisEjendel["status"], string> = {
  registered: "Registreret",
  lost: "Meldt savnet",
  stolen: "Meldt stjålet",
};

/**
 * Fjerner tegn Helvetica ikke kan sætte.
 *
 * WinAnsi dækker dansk, men ikke fx emoji eller kinesisk. Uden det her
 * kaster pdf-lib midt i genereringen, og brugeren får ingen fil og ingen
 * forklaring — for et enkelt tegn i en beskrivelse de selv har skrevet.
 */
function sikker(tekst: string): string {
  // deno-lint-ignore no-control-regex
  return tekst.replace(/[^\x20-\x7E\xA0-\xFF‐-―‘-”…]/g, "");
}

/** Et tekstskriver-håndtag der holder styr på hvor langt nede vi er. */
class Ark {
  pdf: PDFDocument;
  side: PDFPage;
  y: number;
  normal: PDFFont;
  fed: PDFFont;

  constructor(pdf: PDFDocument, normal: PDFFont, fed: PDFFont) {
    this.pdf = pdf;
    this.normal = normal;
    this.fed = fed;
    this.side = pdf.addPage([SIDE.bredde, SIDE.hoejde]);
    this.y = SIDE.hoejde - MARGEN;
  }

  /** Ny side når der er mindre end `behov` tilbage. */
  plads(behov: number) {
    if (this.y - behov < MARGEN + 40) {
      this.side = this.pdf.addPage([SIDE.bredde, SIDE.hoejde]);
      this.y = SIDE.hoejde - MARGEN;
    }
  }

  tekst(
    indhold: string,
    opts: {
      size?: number;
      fed?: boolean;
      farve?: ReturnType<typeof rgb>;
      x?: number;
    } = {},
  ) {
    const size = opts.size ?? 10;
    this.side.drawText(sikker(indhold), {
      x: opts.x ?? MARGEN,
      y: this.y,
      size,
      font: opts.fed ? this.fed : this.normal,
      color: opts.farve ?? BODY,
    });
  }

  /** Ombryder en længere tekst og returnerer hvor mange linjer der blev sat. */
  afsnit(indhold: string, bredde: number, x: number, size = 10): number {
    const ord = sikker(indhold).split(/\s+/);
    let linje = "";
    let linjer = 0;

    for (const o of ord) {
      const forsoeg = linje ? `${linje} ${o}` : o;
      if (this.normal.widthOfTextAtSize(forsoeg, size) > bredde && linje) {
        this.side.drawText(linje, {
          x,
          y: this.y,
          size,
          font: this.normal,
          color: BODY,
        });
        this.y -= size + 4;
        linjer++;
        linje = o;
      } else {
        linje = forsoeg;
      }
    }

    if (linje) {
      this.side.drawText(linje, {
        x,
        y: this.y,
        size,
        font: this.normal,
        color: BODY,
      });
      this.y -= size + 4;
      linjer++;
    }

    return linjer;
  }

  streg(farve = LINJE) {
    this.side.drawRectangle({
      x: MARGEN,
      y: this.y,
      width: INDHOLD,
      height: 0.8,
      color: farve,
    });
  }
}

/** Brevhovedet. Står øverst på hver rapport, ikke på hver side. */
function brevhoved(ark: Ark, titel: string, undertitel: string) {
  ark.tekst(COMPANY.service, { size: 15, fed: true, farve: NAVY });
  ark.y -= 13;
  ark.tekst("DÆKKER ALT - OVER ALT", { size: 7.5, fed: true, farve: ORANGE });
  ark.y -= 26;

  ark.tekst(titel, { size: 20, fed: true, farve: NAVY });
  ark.y -= 16;
  ark.tekst(undertitel, { size: 9.5, farve: MUTED });
  ark.y -= 14;
  ark.streg(NAVY);
  ark.y -= 18;
}

/** En række i oplysningstabellen. Tom værdi vises som tankestreg, ikke skjules. */
function raekke(ark: Ark, etiket: string, vaerdi: string) {
  ark.plads(30);
  const etiketBredde = 150;

  ark.tekst(etiket, { size: 9.5, farve: MUTED });
  const linjer = (() => {
    const gemt = ark.y;
    const n = ark.afsnit(
      vaerdi || "—",
      INDHOLD - etiketBredde,
      MARGEN + etiketBredde,
      10,
    );
    ark.y = gemt;
    return n;
  })();

  ark.afsnit(vaerdi || "—", INDHOLD - etiketBredde, MARGEN + etiketBredde, 10);
  ark.y -= Math.max(0, 6 - (linjer - 1) * 2);
  ark.streg();
  ark.y -= 12;
}

/**
 * Henter et billede og gør det til JPEG.
 *
 * Vejen om et canvas er ikke omsvøb: pdf-lib kan kun indlejre JPEG og PNG,
 * mens brugerne lægger alt muligt op — webp fra en Android-telefon er helt
 * almindeligt. Browseren kan afkode det den kan vise, og så kommer det ud
 * som JPEG i den anden ende. Samtidig skaleres det ned, så et bevis med
 * fem fotos ikke bliver på tyve megabyte.
 */
async function somJpeg(
  url: string,
  maxKant = 1400,
): Promise<Uint8Array | null> {
  try {
    const svar = await fetch(url);
    if (!svar.ok) return null;
    const blob = await svar.blob();
    const bitmap = await createImageBitmap(blob);

    const skala = Math.min(1, maxKant / Math.max(bitmap.width, bitmap.height));
    const lærred = document.createElement("canvas");
    lærred.width = Math.round(bitmap.width * skala);
    lærred.height = Math.round(bitmap.height * skala);

    const ctx = lærred.getContext("2d");
    if (!ctx) return null;
    // Hvid bund: en PNG med gennemsigtighed bliver ellers sort i JPEG.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, lærred.width, lærred.height);
    ctx.drawImage(bitmap, 0, 0, lærred.width, lærred.height);

    const jpeg: Blob | null = await new Promise((klar) =>
      lærred.toBlob(klar, "image/jpeg", 0.82),
    );
    if (!jpeg) return null;
    return new Uint8Array(await jpeg.arrayBuffer());
  } catch {
    // Et billede der ikke kan hentes må ikke koste hele beviset.
    return null;
  }
}

/** Lægger billederne ind, to pr. række. */
async function billeder(ark: Ark, urls: string[]) {
  if (urls.length === 0) return;

  ark.plads(60);
  ark.tekst("Billeder", { size: 11, fed: true, farve: NAVY });
  ark.y -= 16;

  const bredde = (INDHOLD - 14) / 2;
  let iRaekke = 0;
  let raekkeHoejde = 0;

  for (const url of urls) {
    const data = await somJpeg(url);
    if (!data) continue;

    const billede = await ark.pdf.embedJpg(data);
    const h = (billede.height / billede.width) * bredde;

    if (iRaekke === 0) {
      ark.plads(h + 20);
      raekkeHoejde = h;
    }

    ark.side.drawImage(billede, {
      x: MARGEN + iRaekke * (bredde + 14),
      y: ark.y - h,
      width: bredde,
      height: h,
    });

    raekkeHoejde = Math.max(raekkeHoejde, h);
    iRaekke++;

    if (iRaekke === 2) {
      ark.y -= raekkeHoejde + 14;
      iRaekke = 0;
      raekkeHoejde = 0;
    }
  }

  if (iRaekke === 1) ark.y -= raekkeHoejde + 14;
}

/** Fodnoten på hver side. Sættes til sidst, når sideantallet er kendt. */
function sidefod(pdf: PDFDocument, font: PDFFont, stemplet: string) {
  const sider = pdf.getPages();
  sider.forEach((side, i) => {
    side.drawText(
      sikker(`${COMPANY.service} · ${COMPANY.legalName} · CVR ${COMPANY.cvr}`),
      { x: MARGEN, y: MARGEN - 22, size: 7.5, font, color: MUTED },
    );
    side.drawText(sikker(`${stemplet} · side ${i + 1} af ${sider.length}`), {
      x:
        SIDE.bredde -
        MARGEN -
        font.widthOfTextAtSize(
          `${stemplet} · side ${i + 1} af ${sider.length}`,
          7.5,
        ),
      y: MARGEN - 22,
      size: 7.5,
      font,
      color: MUTED,
    });
  });
}

/** Alle oplysninger om én ejendel, som rækker i tabellen. */
function oplysninger(ark: Ark, e: BevisEjendel) {
  raekke(ark, "Navn på genstand", e.name);
  raekke(ark, "Kategori", e.category ?? "");
  raekke(ark, "Mærke / producent", e.brand ?? "");
  raekke(ark, "Model", e.model ?? "");
  raekke(ark, "Serienummer", e.serials.length ? e.serials.join(", ") : "");
  raekke(ark, "Købsdato", e.purchaseDate ? dkDato(e.purchaseDate) : "");
  raekke(
    ark,
    "Købspris",
    e.purchasePrice !== null ? kroner(e.purchasePrice) : "",
  );
  raekke(
    ark,
    "Anslået værdi i dag",
    e.currentValue !== null ? kroner(e.currentValue) : "",
  );
  raekke(ark, "Forhandler", e.retailer ?? "");
  raekke(ark, "Beskrivelse", e.description ?? "");
  raekke(
    ark,
    "Status",
    e.statusChangedAt && e.status !== "registered"
      ? `${STATUS[e.status]} den ${dkDato(e.statusChangedAt)}`
      : STATUS[e.status],
  );
  raekke(ark, "Registreret i registeret", dkDato(e.createdAt));
  raekke(
    ark,
    "Vedhæftede dokumenter",
    e.documents.length ? e.documents.map((d) => d.name).join(", ") : "Ingen",
  );
}

/**
 * Vedhæfter kvitteringer og garantibeviser som ekstra sider.
 *
 * En kvittering nævnt ved navn er ikke dokumentation — den skal med i
 * filen, ellers skal modtageren bede om den separat. PDF'er kopieres side
 * for side, billeder lægges ind som et helt ark.
 */
async function bilag(
  pdf: PDFDocument,
  dokumenter: BevisDokument[],
  font: PDFFont,
) {
  for (const dok of dokumenter) {
    try {
      const svar = await fetch(dok.url);
      if (!svar.ok) continue;
      const data = new Uint8Array(await svar.arrayBuffer());

      // Signaturen frem for filnavnet: en fil kan hedde .pdf uden at være det.
      const erPdf =
        data[0] === 0x25 &&
        data[1] === 0x50 &&
        data[2] === 0x44 &&
        data[3] === 0x46;

      if (erPdf) {
        const kilde = await PDFDocument.load(data, { ignoreEncryption: true });
        const sider = await pdf.copyPages(kilde, kilde.getPageIndices());
        sider.forEach((s) => pdf.addPage(s));
        continue;
      }

      const jpeg = await somJpeg(dok.url, 1600);
      if (!jpeg) continue;

      const billede = await pdf.embedJpg(jpeg);
      const side = pdf.addPage([SIDE.bredde, SIDE.hoejde]);
      const maxB = INDHOLD;
      const maxH = SIDE.hoejde - MARGEN * 2 - 30;
      const skala = Math.min(maxB / billede.width, maxH / billede.height);

      side.drawText(sikker(`Bilag: ${dok.name}`), {
        x: MARGEN,
        y: SIDE.hoejde - MARGEN,
        size: 9.5,
        font,
        color: MUTED,
      });
      side.drawImage(billede, {
        x: MARGEN,
        y: SIDE.hoejde - MARGEN - 20 - billede.height * skala,
        width: billede.width * skala,
        height: billede.height * skala,
      });
    } catch {
      // Et bilag der ikke kan læses springes over. Resten af beviset står.
    }
  }
}

/** Bevis for én ejendel. Returnerer filens indhold. */
export async function bygEjendelsbevis(
  ejendel: BevisEjendel,
  ejer: { navn: string | null; email: string },
  stemplet = new Date(),
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const fed = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ark = new Ark(pdf, normal, fed);

  const dato = stemplet.toLocaleDateString("da-DK", { dateStyle: "long" });

  pdf.setTitle(`Dokumentation – ${ejendel.name}`);
  pdf.setAuthor(COMPANY.service);
  pdf.setSubject("Dokumentation for ejerskab");

  brevhoved(ark, "Dokumentation for ejerskab", `Udskrevet ${dato}`);

  ark.tekst("Ejer", { size: 11, fed: true, farve: NAVY });
  ark.y -= 16;
  raekke(ark, "Navn", ejer.navn ?? "");
  raekke(ark, "E-mail", ejer.email);
  ark.y -= 8;

  ark.plads(40);
  ark.tekst("Genstand", { size: 11, fed: true, farve: NAVY });
  ark.y -= 16;
  oplysninger(ark, ejendel);
  ark.y -= 8;

  await billeder(ark, ejendel.imageUrls);

  ark.plads(50);
  ark.y -= 6;
  ark.afsnit(
    "Oplysningerne er indtastet af ejeren og registreret i Ejendelsregisteret på de datoer der fremgår ovenfor. Vedhæftede kvitteringer og billeder er uændrede kopier af de filer ejeren har lagt op.",
    INDHOLD,
    MARGEN,
    8.5,
  );

  await bilag(pdf, ejendel.documents, normal);
  sidefod(pdf, normal, `Udskrevet ${dato}`);

  return pdf.save();
}

/** Samlet rapport over hele inventarlisten. */
export async function bygInventarrapport(
  ejendele: BevisEjendel[],
  ejer: { navn: string | null; email: string },
  stemplet = new Date(),
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const fed = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ark = new Ark(pdf, normal, fed);

  const dato = stemplet.toLocaleDateString("da-DK", { dateStyle: "long" });

  pdf.setTitle(`Inventarliste – ${ejer.navn ?? ejer.email}`);
  pdf.setAuthor(COMPANY.service);
  pdf.setSubject("Samlet dokumentation for ejerskab");

  brevhoved(
    ark,
    "Inventarliste",
    `${ejendele.length} ${ejendele.length === 1 ? "registreret ejendel" : "registrerede ejendele"} · udskrevet ${dato}`,
  );

  raekke(ark, "Ejer", ejer.navn ?? "");
  raekke(ark, "E-mail", ejer.email);

  const sum = (vaelg: (e: BevisEjendel) => number | null) =>
    ejendele.reduce((total, e) => total + (vaelg(e) ?? 0), 0);

  raekke(ark, "Samlet købspris", kroner(sum((e) => e.purchasePrice)));
  raekke(ark, "Samlet anslået værdi", kroner(sum((e) => e.currentValue)));
  ark.y -= 10;

  // Én ejendel pr. opslag. En sammenklemt tabel over tyve ting er
  // ulæselig netop når den skal bruges, og et forsikringsselskab beder om
  // oplysningerne genstand for genstand.
  for (const [i, ejendel] of ejendele.entries()) {
    ark.plads(200);
    ark.tekst(`${i + 1}. ${ejendel.name}`, {
      size: 13,
      fed: true,
      farve: NAVY,
    });
    ark.y -= 18;
    oplysninger(ark, ejendel);
    ark.y -= 6;
    await billeder(ark, ejendel.imageUrls.slice(0, 2));
    ark.y -= 14;
  }

  sidefod(pdf, normal, `Udskrevet ${dato}`);
  return pdf.save();
}

/** Sender filen til brugerens downloads. */
export function hentFil(data: Uint8Array, filnavn: string) {
  const blob = new Blob([data as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filnavn;
  a.click();
  URL.revokeObjectURL(url);
}

/** Filnavn uden tegn der driller et filsystem. */
export function filnavn(basis: string): string {
  return (
    basis
      .replace(/[æÆ]/g, "ae")
      .replace(/[øØ]/g, "oe")
      .replace(/[åÅ]/g, "aa")
      .replace(/[^a-zA-Z0-9-_ ]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase() || "bevis"
  );
}
