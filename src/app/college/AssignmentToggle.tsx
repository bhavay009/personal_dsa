"use client";

import { useTransition } from "react";
import { toggleAssignment } from "@/app/actions";

export function AssignmentToggle({ id, done }: { id: number; done: boolean }) {
  const [, startTransition] = useTransition();
  return (
    <input
      type="checkbox"
      defaultChecked={done}
      onChange={(e) => startTransition(() => toggleAssignment(id, e.target.checked))}
    />
  );
}
