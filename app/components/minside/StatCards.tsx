export function StatCards({
  itemCount,
  includedItems,
  planName,
  monthlyPrice,
  nextPayment,
  createdAt,
}: {
  itemCount: number;
  includedItems: number;
  planName: string;
  monthlyPrice: number | null;
  nextPayment: string | null;
  createdAt: string | null;
}) {
  const stats = [
    { label: "Ejendele registreret", value: `${itemCount} / ${includedItems}` },
    {
      label: "Abonnement",
      value: monthlyPrice
        ? `${planName} · ${monthlyPrice.toLocaleString("da-DK")} kr/md.`
        : "Ingen",
    },
    { label: "Næste betaling", value: nextPayment ?? "—" },
    { label: "Oprettet", value: createdAt ?? "—" },
  ];

  return (
    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-sm border border-line bg-white px-5 py-4"
        >
          <dt className="text-[13px] text-muted">{stat.label}</dt>
          <dd className="mt-1.5 text-[19px] font-bold text-navy">
            {stat.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
