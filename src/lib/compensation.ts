export const COMPENSATION_STATUSES = ["OPEN", "APPROVED", "DENIED", "PAID"] as const;
export type CompensationStatus = (typeof COMPENSATION_STATUSES)[number];
export type CompensationStatusTone = "neutral" | "success" | "warning" | "danger" | "info";

export type CompensationItem = {
  name: string;
  quantity: number;
};

const ALLOWED_TRANSITIONS: Record<CompensationStatus, CompensationStatus[]> = {
  OPEN: ["APPROVED", "DENIED"],
  APPROVED: ["PAID", "DENIED"],
  DENIED: ["OPEN"],
  PAID: [],
};

export function isCompensationStatus(value: string): value is CompensationStatus {
  return (COMPENSATION_STATUSES as readonly string[]).includes(value);
}

export function allowedCompensationTransitions(from: string): CompensationStatus[] {
  return isCompensationStatus(from) ? ALLOWED_TRANSITIONS[from] : [];
}

export function canTransitionCompensation(from: string, to: string): boolean {
  return allowedCompensationTransitions(from).includes(to as CompensationStatus);
}

export function compensationStatusTone(status: string): CompensationStatusTone {
  switch (status) {
    case "APPROVED":
      return "info";
    case "DENIED":
      return "danger";
    case "PAID":
      return "success";
    case "OPEN":
    default:
      return "warning";
  }
}

export function compensationStatusLabel(status: string): string {
  switch (status) {
    case "OPEN":
      return "Open";
    case "APPROVED":
      return "Approved";
    case "DENIED":
      return "Denied";
    case "PAID":
      return "Paid";
    default:
      return status;
  }
}

export function parseMoneyAmount(raw: string | null | undefined): number | null {
  const trimmed = (raw || "").trim();
  if (!trimmed) return null;
  const cleaned = trimmed.replace(/[$,]/g, "");
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Money amounts must be a number greater than or equal to 0.");
  }
  return value;
}

export function parseCompensationItems(raw: string | null | undefined): CompensationItem[] {
  const lines = (raw || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.map((line) => {
    const qtyFirst = line.match(/^(\d+(?:\.\d+)?)\s*[x×]\s+(.+)$/i);
    if (qtyFirst) {
      return { name: qtyFirst[2].trim(), quantity: Number(qtyFirst[1]) };
    }

    const qtyLast = line.match(/^(.+?)\s*[x×]\s*(\d+(?:\.\d+)?)$/i);
    if (qtyLast) {
      return { name: qtyLast[1].trim(), quantity: Number(qtyLast[2]) };
    }

    const colonQty = line.match(/^(.+?)\s*:\s*(\d+(?:\.\d+)?)$/);
    if (colonQty) {
      return { name: colonQty[1].trim(), quantity: Number(colonQty[2]) };
    }

    return { name: line, quantity: 1 };
  });
}

export function compensationItemsFromJson(value: unknown): CompensationItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const record = entry as Record<string, unknown>;
      const name = typeof record.name === "string" ? record.name.trim() : "";
      if (!name) return null;
      const quantity =
        typeof record.quantity === "number" && Number.isFinite(record.quantity) && record.quantity > 0
          ? record.quantity
          : 1;
      return { name, quantity };
    })
    .filter((item): item is CompensationItem => item !== null);
}

export function formatMoneyAmount(value: number | null | undefined): string {
  if (value == null) return "—";
  return `$${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)}`;
}
