"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { fetchSmartPlan } from "@/app/actions";
import type { PlanItem } from "@/lib/insights";

const GOALS = ["Mixed", "DSA", "Development", "Internship"];

export function PlannerForm() {
  const [pending, startTransition] = useTransition();
  const [plan, setPlan] = useState<PlanItem[] | null>(null);

  function handleSubmit(formData: FormData) {
    const hours = Number(formData.get("hours") || 1);
    const goal = String(formData.get("goal") || "Mixed");
    startTransition(async () => {
      setPlan(await fetchSmartPlan(hours, goal));
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 dark:border-white/15">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-black/50 dark:text-white/50">Hours available today</label>
          <input
            name="hours"
            type="number"
            min={0.5}
            step={0.5}
            defaultValue={1}
            className="w-20 rounded border border-black/15 bg-transparent px-2 py-1.5 text-sm dark:border-white/20"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-black/50 dark:text-white/50">Goal</label>
          <select name="goal" defaultValue="Mixed" className="rounded border border-black/15 bg-transparent px-2 py-1.5 text-sm dark:border-white/20">
            {GOALS.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-black px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {pending ? "Planning…" : "Build my plan"}
        </button>
      </div>
      {plan &&
        (plan.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">Not enough time budgeted for anything meaningful — try more hours.</p>
        ) : (
          <div className="flex flex-col divide-y divide-black/10 dark:divide-white/10">
            {plan.map((item, i) => (
              <Link key={i} href={item.href} className="flex items-center justify-between py-2 text-sm hover:underline">
                <span>
                  {item.label} <span className="text-xs text-black/40 dark:text-white/40">— {item.reason}</span>
                </span>
                <span className="shrink-0 text-xs text-black/50 dark:text-white/50">{item.minutes}m</span>
              </Link>
            ))}
          </div>
        ))}
    </form>
  );
}
