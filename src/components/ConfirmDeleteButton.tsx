"use client";

import { useTransition, type ReactNode } from "react";

export function ConfirmDeleteButton({
  action,
  confirmMessage,
  className,
  children = "Delete",
}: {
  action: () => Promise<void>;
  confirmMessage: string;
  className?: string;
  children?: ReactNode;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (window.confirm(confirmMessage)) startTransition(action);
      }}
      className={className}
    >
      {children}
    </button>
  );
}
