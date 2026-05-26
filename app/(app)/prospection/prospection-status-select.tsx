"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateProspectionEntryStatusAction } from "@/actions/prospection";
import type { ProspectionStatus } from "@/db/schema";
import {
  PROSPECTION_OFFER_STATUSES,
  PROSPECTION_STATUS_LABELS,
} from "@/lib/prospection";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type OfferStatus = (typeof PROSPECTION_OFFER_STATUSES)[number];

function offerStatus(status: ProspectionStatus): OfferStatus {
  return PROSPECTION_OFFER_STATUSES.includes(status as OfferStatus)
    ? (status as OfferStatus)
    : "TO_APPLY";
}

export function ProspectionStatusSelect({
  entryId,
  status,
}: {
  entryId: string;
  status: ProspectionStatus;
}) {
  const router = useRouter();
  const currentValue = offerStatus(status);
  const [optimisticValue, setOptimisticValue] = useState<OfferStatus | null>(
    null,
  );
  const [pending, start] = useTransition();
  const value = pending && optimisticValue ? optimisticValue : currentValue;

  function onValueChange(nextStatus: OfferStatus | null) {
    if (!nextStatus) return;
    const nextValue = offerStatus(nextStatus as ProspectionStatus);
    if (nextValue === value) return;

    setOptimisticValue(nextValue);
    start(async () => {
      const result = await updateProspectionEntryStatusAction(
        entryId,
        nextValue,
      );
      if ("error" in result && result.error) {
        setOptimisticValue(null);
        toast.error(result.error);
        return;
      }
      toast.success("Statut mis à jour");
      router.refresh();
    });
  }

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        aria-label="Statut de l'offre"
        className="h-7 w-[8.5rem] rounded-md"
        disabled={pending}
        size="sm"
      >
        <SelectValue>{PROSPECTION_STATUS_LABELS[value]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {PROSPECTION_OFFER_STATUSES.map((statusValue) => (
          <SelectItem key={statusValue} value={statusValue}>
            {PROSPECTION_STATUS_LABELS[statusValue]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
