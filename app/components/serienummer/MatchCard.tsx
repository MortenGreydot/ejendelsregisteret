import { CircleCheck, ShieldAlert, TriangleAlert } from "lucide-react";
import Image from "next/image";

import { ContactOwner } from "./ContactOwner";

export type Match = {
  item_id: string;
  name: string;
  description: string | null;
  status: "registered" | "lost" | "stolen";
  brand: string | null;
  category: string | null;
  status_changed_at: string | null;
  image_paths: string[];
};

const dk = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("da-DK", { dateStyle: "long" }) : "";

/**
 * Én træffer på et serienummeropslag.
 *
 * Ligger i sin egen komponent, fordi et serienummer kan ramme flere
 * ejendele. Serienumre er ikke globalt unikke — "123456" står på både en
 * cykel og en telefon — så siden viser dem alle og lader finderen
 * sammenligne mærke, kategori og billeder.
 */
export function MatchCard({
  match,
  imageUrls,
  query,
}: {
  match: Match;
  imageUrls: string[];
  query: string;
}) {
  return (
    <div className="overflow-hidden rounded-sm border border-line bg-white">
      {match.status === "registered" && (
        <div className="flex gap-4 p-6">
          <CircleCheck
            className="mt-0.5 size-6 shrink-0 text-emerald-600"
            strokeWidth={2}
          />
          <div>
            <p className="font-display text-[21px] text-navy">
              Ejendelen er registreret
            </p>
            <p className="mt-1.5 text-[14.5px] leading-relaxed text-body">
              Serienummeret findes i Ejendelsregisteret og er ikke meldt savnet
              eller stjålet.
            </p>
          </div>
        </div>
      )}

      {match.status !== "registered" && (
        <div
          className={`flex gap-4 p-6 ${
            match.status === "stolen" ? "bg-red-50/60" : "bg-amber-50/60"
          }`}
        >
          {match.status === "stolen" ? (
            <ShieldAlert
              className="mt-0.5 size-6 shrink-0 text-red-600"
              strokeWidth={2}
            />
          ) : (
            <TriangleAlert
              className="mt-0.5 size-6 shrink-0 text-amber-600"
              strokeWidth={2}
            />
          )}
          <div>
            <p className="font-display text-[21px] text-navy">
              {match.status === "stolen" ? "Meldt stjålet" : "Meldt savnet"}
            </p>
            <p className="mt-1.5 text-[14.5px] leading-relaxed text-body">
              Ejeren har markeret denne ejendel som{" "}
              {match.status === "stolen" ? "stjålet" : "savnet"}
              {match.status_changed_at && ` den ${dk(match.status_changed_at)}`}
              . Har du fundet den, kan du hjælpe ejeren med at få den tilbage.
            </p>
          </div>
        </div>
      )}

      {imageUrls.length > 0 && (
        <ul className="flex flex-wrap gap-3 border-t border-line px-6 py-5">
          {imageUrls.map((url, i) => (
            <li
              key={url}
              className="relative size-28 overflow-hidden rounded-sm bg-mist"
            >
              <Image
                src={url}
                alt={`${match.name} billede ${i + 1}`}
                fill
                sizes="112px"
                className="object-cover"
              />
            </li>
          ))}
        </ul>
      )}

      <dl className="border-t border-line px-6 py-4 text-[14px]">
        <div className="flex gap-4 py-1">
          <dt className="w-28 shrink-0 text-muted">Ejendel</dt>
          <dd className="font-semibold text-navy">{match.name}</dd>
        </div>
        <div className="flex gap-4 py-1">
          <dt className="w-28 shrink-0 text-muted">Serienummer</dt>
          <dd className="font-mono text-navy">{query}</dd>
        </div>
        {match.brand && (
          <div className="flex gap-4 py-1">
            <dt className="w-28 shrink-0 text-muted">Mærke</dt>
            <dd className="text-navy">{match.brand}</dd>
          </div>
        )}
        {match.category && (
          <div className="flex gap-4 py-1">
            <dt className="w-28 shrink-0 text-muted">Kategori</dt>
            <dd className="text-navy">{match.category}</dd>
          </div>
        )}
        {match.description && (
          <div className="flex gap-4 py-1">
            <dt className="w-28 shrink-0 text-muted">Beskrivelse</dt>
            <dd className="text-navy">{match.description}</dd>
          </div>
        )}
      </dl>

      <ContactOwner
        itemId={match.item_id}
        itemName={match.name}
        status={match.status}
      />

      <p className="border-t border-line bg-mist px-6 py-4 text-[13px] leading-relaxed text-muted">
        Sammenlign oplysningerne med den genstand du har. Stemmer de ikke, er
        det ikke den samme ejendel.
        <br />
        Vi viser hverken ejerens navn, kontaktoplysninger eller kvitteringer. Du
        kan kun skrive til dem gennem Ejendelsregisteret. Omvendt kan de svare
        dig direkte, hvis de vil.
      </p>
    </div>
  );
}
