// Espelha backend/src/modules/contracts/scheduling.ts (mantém a mesma regra de cor).

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const PROXIMITY_URGENT_DAYS = 3;
const PROXIMITY_SOON_DAYS = 7;

export type ScheduleProximity = "none" | "soon" | "urgent";

export function daysUntil(scheduledAt: string | Date, now: Date = new Date()): number {
  const target = typeof scheduledAt === "string" ? new Date(scheduledAt) : scheduledAt;
  return Math.ceil((target.getTime() - now.getTime()) / MS_PER_DAY);
}

/**
 * Classifica a proximidade da data alvo para colorir o componente.
 * - `urgent`: faltam <= 3 dias ou já venceu -> vermelho
 * - `soon`: faltam <= 7 dias -> alerta
 * - `none`: ainda distante / sem data
 */
export function scheduleProximity(scheduledAt: string | null | undefined, now: Date = new Date()): ScheduleProximity {
  if (!scheduledAt) return "none";
  const target = new Date(scheduledAt);
  if (Number.isNaN(target.getTime())) return "none";
  const remaining = daysUntil(target, now);
  if (remaining <= PROXIMITY_URGENT_DAYS) return "urgent";
  if (remaining <= PROXIMITY_SOON_DAYS) return "soon";
  return "none";
}

/** Texto curto auxiliar ("amanhã", "em 5 dias", "atrasado 2 dias"). */
export function scheduleRelativeLabel(scheduledAt: string | null | undefined, now: Date = new Date()): string {
  if (!scheduledAt) return "";
  const target = new Date(scheduledAt);
  if (Number.isNaN(target.getTime())) return "";
  const remaining = daysUntil(target, now);
  if (remaining < 0) return `atrasado ${Math.abs(remaining)} dia${Math.abs(remaining) === 1 ? "" : "s"}`;
  if (remaining === 0) return "hoje";
  if (remaining === 1) return "amanhã";
  return `em ${remaining} dias`;
}

export function formatScheduleDate(scheduledAt: string | null | undefined): string {
  if (!scheduledAt) return "";
  const target = new Date(scheduledAt);
  if (Number.isNaN(target.getTime())) return "";
  return target.toLocaleString("pt-BR", { dateStyle: "medium", timeStyle: "short" });
}

/** Converte ISO -> valor para <input type="datetime-local"> no fuso local. */
export function toDateTimeLocalValue(scheduledAt: string | null | undefined): string {
  if (!scheduledAt) return "";
  const target = new Date(scheduledAt);
  if (Number.isNaN(target.getTime())) return "";
  const offset = target.getTimezoneOffset() * 60000;
  return new Date(target.getTime() - offset).toISOString().slice(0, 16);
}
