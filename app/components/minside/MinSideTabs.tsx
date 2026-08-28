"use client";

import { useState } from "react";

import { AddItemDialog, type Category } from "./AddItemDialog";
import { ItemList, type Item } from "./ItemList";

export type Tab = "ejendele" | "profil";

export function MinSideTabs({
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
      <div className="mt-10 border-b border-line">
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
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-display text-[22px] font-normal text-navy">
              Mine ejendele
            </h2>
            <AddItemDialog
              userId={userId}
              categories={categories}
              itemCount={items.length}
              includedItems={includedItems}
              extraItemPrice={extraItemPrice}
              canAddItems={canAddItems}
            />
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
