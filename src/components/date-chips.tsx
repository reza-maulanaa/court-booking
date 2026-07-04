"use client";

import { MAX_DAYS_AHEAD, todayWIB } from "@/lib/constants";

// hari ini s/d +MAX_DAYS_AHEAD, sinkron dengan validator backend
function dateOptions() {
  return Array.from({ length: MAX_DAYS_AHEAD + 1 }, (_, i) => {
    const d = new Date(`${todayWIB()}T00:00:00`);
    d.setDate(d.getDate() + i);
    return {
      iso: d.toLocaleDateString("en-CA"),
      hari: i === 0 ? "Hari ini" : d.toLocaleDateString("id-ID", { weekday: "short" }),
      tgl: d.getDate(),
      bulan: d.toLocaleDateString("id-ID", { month: "short" }),
      minggu: d.getDay() === 0,
    };
  });
}

function chipClass(selected: boolean) {
  return `flex min-w-20 shrink-0 flex-col items-center justify-center rounded-xl border px-3 py-2 text-sm transition-colors ${
    selected
      ? "border-primary bg-primary text-primary-foreground"
      : "bg-background hover:bg-accent"
  }`;
}

export function DateChips({
  value,
  onChange,
  withAll = false,
}: {
  value: string; // "" = semua tanggal (hanya saat withAll)
  onChange: (iso: string) => void;
  withAll?: boolean;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {withAll && (
        <button
          type="button"
          aria-pressed={value === ""}
          onClick={() => onChange("")}
          className={chipClass(value === "")}
        >
          <span className="text-base font-semibold">Semua</span>
        </button>
      )}
      {dateOptions().map((d) => {
        const selected = value === d.iso;
        return (
          <button
            key={d.iso}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(d.iso)}
            className={chipClass(selected)}
          >
            <span
              className={
                selected ? "" : d.minggu ? "text-red-600" : "text-muted-foreground"
              }
            >
              {d.hari}
            </span>
            <span className="text-2xl font-bold">{d.tgl}</span>
            <span className={selected ? "" : "text-muted-foreground"}>
              {d.bulan}
            </span>
          </button>
        );
      })}
    </div>
  );
}
