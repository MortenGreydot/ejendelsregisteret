"use client";

import { useAudience, type Audience } from "./AudienceProvider";

const options: { value: Audience; label: string }[] = [
  { value: "privat", label: "Privat" },
  { value: "erhverv", label: "Erhverv" },
];

export function AudienceSwitch() {
  const { audience, setAudience } = useAudience();

  return (
    <nav className="flex items-center gap-6 text-[15px]">
      {options.map((option) => {
        const active = option.value === audience;

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => setAudience(option.value)}
            className={
              active
                ? "border-b-2 border-orange pb-0.5 text-orange"
                : "pb-0.5 text-white/75 transition-colors hover:text-white"
            }
          >
            {option.label}
          </button>
        );
      })}
    </nav>
  );
}
