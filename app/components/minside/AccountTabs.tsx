"use client";

import { useState } from "react";

import { AddItemDialog, type Category } from "./AddItemDialog";
import { ItemList, type Item } from "./ItemList";
import { ItemWizard } from "./ItemWizard";

export type Tab = "ejendele" | "profil";

/** Fanerne på Min side: Ejendele og Profil. */
export function AccountTabs({
  items,
  userId,
  categories,
  includedItems,
  extraItemPrice,
  canAddItems,
  initialTab = "ejendele",
  profile,
  plan,
}: {
  items: Item[];
  userId: string;
  categories: Category[];
  includedItems: number;
  extraItemPrice: number;
  canAddItems: boolean;
  /** Hvilken fane der er åben ved første render. Sættes fra ?tab= i URL'en,
   *  så man kan linke direkte til profilen udefra. */
  initialTab?: Tab;
  profile: React.ReactNode;
  plan: React.ReactNode;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);

  const tabs: { id: Tab; label: string }[] = [
    { id: "ejendele", label: "Ejendele" },
    { id: "profil", label: "Profil" },
  ];

  return (
    <>
      <div className="mt-8 border-b border-line sm:mt-10">
        <nav className="flex gap-8 text-[15px]">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? "page" : undefined}
              className={
                tab === t.id
                  ? "-mb-px border-b-2 border-orange pb-3 font-semibold text-orange"
                  : "-mb-px border-b-2 border-transparent pb-3 text-muted transition-colors hover:text-navy"
              }
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === "ejendele" ? (
        <section className="mt-8">
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <h2 className="font-display text-[22px] font-normal text-navy">
              Mine ejendele
            </h2>
            {/*
              Under 900px bruges den trinvise guide i stedet for dialogen.
              Den lange formular kræver at man overskuer alle felter på én
              gang, og det er der ikke plads til på en telefon — ét
              spørgsmål ad gangen er nemmere at komme igennem.

              Begge er i DOM'en, og CSS afgør hvilken der vises. Med en
              JavaScript-måling ville serveren og browseren være uenige om
              skærmbredden ved første render, og så ville knappen hoppe.
            */}
            <div className="compact:hidden">
              <ItemWizard
                userId={userId}
                categories={categories}
                itemCount={items.length}
                includedItems={includedItems}
                extraItemPrice={extraItemPrice}
                canAddItems={canAddItems}
                showTrigger
              />
            </div>

            <div className="hidden compact:block">
              <AddItemDialog
                userId={userId}
                categories={categories}
                itemCount={items.length}
                includedItems={includedItems}
                extraItemPrice={extraItemPrice}
                canAddItems={canAddItems}
              />
            </div>
          </div>

          <div className="mt-6">
            <ItemList items={items} userId={userId} categories={categories} />
          </div>
        </section>
      ) : (
        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          {profile}
          {plan}
        </section>
      )}
    </>
  );
}
