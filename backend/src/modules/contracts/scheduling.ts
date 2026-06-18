import { AppError } from '../../utils/errors.js';

/**
 * Regras puras (sem dependência de banco/HTTP) do agendamento de serviços.
 * Compartilhadas pelo router e pelos testes. O frontend espelha `scheduleProximity`
 * em `features/marketplace/schedule.ts`.
 */

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** A partir de quantos dias restantes a data fica "urgente" (vermelha). */
export const PROXIMITY_URGENT_DAYS = 3;
/** A partir de quantos dias restantes a data fica "próxima" (alerta). */
export const PROXIMITY_SOON_DAYS = 7;

export type ScheduleStatus = 'unscheduled' | 'scheduled' | 'cancelled';
export type ScheduleProximity = 'none' | 'soon' | 'urgent';

/** Status de contrato em que o serviço ainda pode ser agendado/movido. */
const ACTIVE_CONTRACT_STATUSES = ['pending', 'accepted', 'in_progress'];

/** Converte a entrada do usuário em Date, rejeitando valores inválidos. */
export function parseScheduleDate(input: unknown): Date {
  if (typeof input !== 'string' || input.trim() === '') {
    throw new AppError('Data de agendamento inválida', 400);
  }
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new AppError('Data de agendamento inválida', 400);
  }
  return date;
}

/** Garante que a data alvo está no futuro em relação a `now`. */
export function assertFutureDate(date: Date, now: Date = new Date()): void {
  if (date.getTime() <= now.getTime()) {
    throw new AppError('A data de agendamento deve estar no futuro', 400);
  }
}

export function assertCanSchedule(contractStatus: string, scheduleStatus: ScheduleStatus): void {
  if (!ACTIVE_CONTRACT_STATUSES.includes(contractStatus)) {
    throw new AppError('Contrato não pode ser agendado neste estado', 400);
  }
  if (scheduleStatus === 'scheduled') {
    throw new AppError('Serviço já agendado. Use o reagendamento.', 400);
  }
}

export function assertCanReschedule(contractStatus: string, scheduleStatus: ScheduleStatus): void {
  if (!ACTIVE_CONTRACT_STATUSES.includes(contractStatus)) {
    throw new AppError('Contrato não pode ser reagendado neste estado', 400);
  }
  if (scheduleStatus !== 'scheduled') {
    throw new AppError('Não há agendamento ativo para reagendar', 400);
  }
}

export function assertCanCancelSchedule(scheduleStatus: ScheduleStatus): void {
  if (scheduleStatus !== 'scheduled') {
    throw new AppError('Não há agendamento ativo para cancelar', 400);
  }
}

/** Dias inteiros (arredondados para cima) que faltam até a data alvo. Negativo = vencido. */
export function daysUntil(scheduledAt: string | Date, now: Date = new Date()): number {
  const target = typeof scheduledAt === 'string' ? new Date(scheduledAt) : scheduledAt;
  return Math.ceil((target.getTime() - now.getTime()) / MS_PER_DAY);
}

/**
 * Classifica a proximidade da data alvo para colorir o componente.
 * - `urgent`: faltam <= 3 dias ou já venceu → vermelho
 * - `soon`: faltam <= 7 dias → alerta
 * - `none`: ainda distante
 */
export function scheduleProximity(scheduledAt: string | Date | null | undefined, now: Date = new Date()): ScheduleProximity {
  if (!scheduledAt) return 'none';
  const target = typeof scheduledAt === 'string' ? new Date(scheduledAt) : scheduledAt;
  if (Number.isNaN(target.getTime())) return 'none';
  const remaining = daysUntil(target, now);
  if (remaining <= PROXIMITY_URGENT_DAYS) return 'urgent';
  if (remaining <= PROXIMITY_SOON_DAYS) return 'soon';
  return 'none';
}
