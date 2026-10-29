"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Bottom sheet on phones, centred dialog on larger screens. Radix handles
 * focus trapping, Escape, and aria for us.
 */
export function Sheet({ open, onOpenChange, title, description, children }: {
  open: boolean; onOpenChange: (v: boolean) => void; title: string; description?: string; children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-navy/60 backdrop-blur-[2px]" />
        <Dialog.Content
          className={cn(
            "fixed z-50 max-h-[90vh] overflow-y-auto bg-white p-5 shadow-luxe outline-none",
            "inset-x-0 bottom-0 rounded-t-2xl pb-[max(1.25rem,env(safe-area-inset-bottom))]",
            "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl",
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="font-serif text-xl font-bold text-navy">{title}</Dialog.Title>
              {description ? <Dialog.Description className="mt-1 text-sm text-navy/70">{description}</Dialog.Description> : <Dialog.Description className="sr-only">{title}</Dialog.Description>}
            </div>
            <Dialog.Close aria-label="Close" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-navy/60 hover:bg-navy/5"><X className="h-5 w-5" aria-hidden /></Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
