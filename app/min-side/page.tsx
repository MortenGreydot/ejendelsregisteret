import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { PLANS } from "@/lib/plans";
import { Navbar } from "../components/Navbar";
import { ItemWizard } from "../components/minside/ItemWizard";
import { AccountTabs } from "../components/minside/AccountTabs";
import {
  PaymentNotice,
  type SubscriptionStatus,
} from "../components/minside/PaymentNotice";
import { PlanPanel } from "../components/minside/PlanPanel";
import { ProfileForm } from "../components/minside/ProfileForm";
import { StatCards } from "../components/minside/StatCards";
import type { Item, ItemStatus } from "../components/minside/ItemList";

export const metadata: Metadata = {
  title: "Min side - Ejendelsregisteret",
};

const dkDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("da-DK", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

const dkMonth = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("da-DK", {
        year: "numeric",
        month: "short",
      })
    : null;

/** Min side */
export default async function MyAccountPage({
  searchParams,
}: PageProps<"/min-side">) {
  const params = await searchParams;
  // Sat af Stripes success_url. Findes kun i den ene viderestilling efter
  // en gennemført betaling, så guiden vises én gang og ikke ved hvert besøg.
  const justPaid = params.checkout === "ok";
  const initialTab = params.tab === "profil" ? "profil" : "ejendele";

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    redirect("/");
  }

  // getClaims() giver JWT'ets rå payload — bruger-id'et hedder `sub`.
  // (Edge functions' ctx.userClaims er et andet, normaliseret objekt hvor
  // feltet hedder `id`. De to må ikke forveksles.)
  const userId = data.claims.sub;
  const email = data.claims.email ?? "";

  if (!userId) {
    redirect("/");
  }

  // Alt hentes gennem den RLS-scopede klient, så policies er det der
  // afgør hvad der kommer med — ikke where-klausulerne alene.
  const [
    { data: profile },
    { data: subscription },
    { data: rawItems },
    { data: categories },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, phone, account_type, created_at")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("subscriptions")
      .select("status, monthly_price, included_items, current_period_end")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("items")
      .select(
        "id, name, brand, status, status_changed_at, created_at, categories(name), item_serials(serial), item_images(file_path, created_at)",
      )
      .order("created_at", { ascending: false }),
    supabase.from("categories").select("id, name").order("name"),
  ]);

  const items: Item[] = (rawItems ?? []).map((row) => {
    const r = row as unknown as {
      id: string;
      name: string;
      brand: string | null;
      status: ItemStatus;
      status_changed_at: string | null;
      created_at: string;
      categories: { name: string } | null;
      item_serials: { serial: string }[] | null;
      item_images: { file_path: string; created_at: string }[] | null;
    };

    // Ældst først: det først uploadede bliver miniature. Deterministisk
    // frem for tilfældigt — et kort der skifter billede ved hver indlæsning
    // er svært at genkende i en liste.
    const sortedImages = [...(r.item_images ?? [])].sort((a, b) =>
      a.created_at.localeCompare(b.created_at),
    );

    const thumbnail = sortedImages[0];
    return {
      id: r.id,
      name: r.name,
      brand: r.brand,
      status: r.status,
      status_changed_at: r.status_changed_at,
      created_at: r.created_at,
      category: r.categories?.name ?? null,
      serials: (r.item_serials ?? []).map((s) => s.serial),
      // Bucket'en er public, så URL'en kan bygges uden signering.
      imageUrl: thumbnail
        ? supabase.storage.from("item-images").getPublicUrl(thumbnail.file_path)
            .data.publicUrl
        : null,
    };
  });

  const isBusiness = profile?.account_type === "business";
  const plan = isBusiness ? PLANS.erhverv : PLANS.privat;
  const planName = isBusiness ? "Erhverv" : "Personlig";
  const includedItems = subscription?.included_items ?? plan.includedItems;
  const status = (subscription?.status ?? null) as SubscriptionStatus;
  const hasSubscription = status === "active";

  return (
    <>
      <Navbar />
      <header className="border-b border-line bg-white">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
          <div>
            <h1 className="font-display text-[26px] font-normal text-navy sm:text-[32px]">
              Inventarlisten
            </h1>
          </div>
        </div>
      </header>
      <main className="flex-1 bg-mist">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
          {justPaid && items.length === 0 && (
            <ItemWizard
              userId={userId}
              categories={categories ?? []}
              itemCount={items.length}
              includedItems={includedItems}
              extraItemPrice={plan.extraItemPrice}
              autoOpen
              showIntro
            />
          )}

          <PaymentNotice
            status={status}
            planId={isBusiness ? "erhverv" : "privat"}
          />

          <StatCards
            itemCount={items.length}
            includedItems={includedItems}
            planName={planName}
            monthlyPrice={
              subscription?.monthly_price != null
                ? Number(subscription.monthly_price)
                : null
            }
            nextPayment={dkDate(subscription?.current_period_end ?? null)}
            createdAt={dkMonth(profile?.created_at ?? null)}
          />

          <AccountTabs
            items={items}
            userId={userId}
            categories={categories ?? []}
            includedItems={includedItems}
            extraItemPrice={plan.extraItemPrice}
            canAddItems={hasSubscription}
            initialTab={initialTab}
            profile={
              <ProfileForm
                userId={userId}
                email={email}
                fullName={profile?.full_name ?? null}
                phone={profile?.phone ?? null}
              />
            }
            plan={
              <PlanPanel
                planName={planName}
                includedItems={includedItems}
                monthlyPrice={
                  subscription?.monthly_price != null
                    ? Number(subscription.monthly_price)
                    : null
                }
                nextPayment={dkDate(subscription?.current_period_end ?? null)}
                hasSubscription={hasSubscription}
                itemCount={items.length}
              />
            }
          />
        </div>
      </main>
    </>
  );
}
