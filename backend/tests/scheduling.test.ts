import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';

process.env.DATABASE_URL = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'baito-sched-')), 'test.db');

const { sqlite } = await import('../src/db/connection.js');
const { runMigrations } = await import('../src/db/migrate.js');
const {
  scheduleProximity,
  daysUntil,
  parseScheduleDate,
  assertFutureDate,
  assertCanSchedule,
  assertCanReschedule,
  assertCanCancelSchedule,
} = await import('../src/modules/contracts/scheduling.js');

runMigrations();

const NOW = new Date('2026-06-17T12:00:00.000Z');
const inDays = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000).toISOString();

test('proximidade: data distante não colore', () => {
  assert.equal(scheduleProximity(inDays(30), NOW), 'none');
  assert.equal(scheduleProximity(inDays(8), NOW), 'none');
});

test('proximidade: data próxima (<= 7 dias) vira alerta', () => {
  assert.equal(scheduleProximity(inDays(7), NOW), 'soon');
  assert.equal(scheduleProximity(inDays(4), NOW), 'soon');
});

test('proximidade: <= 3 dias vira urgente (vermelho)', () => {
  assert.equal(scheduleProximity(inDays(3), NOW), 'urgent');
  assert.equal(scheduleProximity(inDays(1), NOW), 'urgent');
});

test('proximidade: data vencida é urgente', () => {
  assert.equal(scheduleProximity(inDays(-2), NOW), 'urgent');
});

test('proximidade: sem data é none', () => {
  assert.equal(scheduleProximity(null, NOW), 'none');
  assert.equal(scheduleProximity(undefined, NOW), 'none');
});

test('daysUntil arredonda para cima', () => {
  assert.equal(daysUntil(inDays(3), NOW), 3);
  assert.equal(daysUntil(new Date(NOW.getTime() + 2.1 * 24 * 60 * 60 * 1000), NOW), 3);
});

test('parseScheduleDate rejeita entradas inválidas', () => {
  assert.throws(() => parseScheduleDate(''), /inválida/);
  assert.throws(() => parseScheduleDate('não é data'), /inválida/);
  assert.throws(() => parseScheduleDate(123 as unknown), /inválida/);
  assert.equal(parseScheduleDate(inDays(5)).toISOString(), inDays(5));
});

test('assertFutureDate rejeita passado e presente', () => {
  assert.throws(() => assertFutureDate(new Date(inDays(-1)), NOW), /futuro/);
  assert.throws(() => assertFutureDate(NOW, NOW), /futuro/);
  assert.doesNotThrow(() => assertFutureDate(new Date(inDays(1)), NOW));
});

test('regras de transição de agendamento', () => {
  // schedule: só em contrato ativo e não agendado
  assert.doesNotThrow(() => assertCanSchedule('pending', 'unscheduled'));
  assert.doesNotThrow(() => assertCanSchedule('accepted', 'cancelled'));
  assert.throws(() => assertCanSchedule('confirmed', 'unscheduled'), /neste estado/);
  assert.throws(() => assertCanSchedule('pending', 'scheduled'), /já agendado/);

  // reschedule: só com agendamento ativo
  assert.doesNotThrow(() => assertCanReschedule('in_progress', 'scheduled'));
  assert.throws(() => assertCanReschedule('pending', 'unscheduled'), /ativo/);
  assert.throws(() => assertCanReschedule('cancelled', 'scheduled'), /neste estado/);

  // cancel-schedule: só com agendamento ativo
  assert.doesNotThrow(() => assertCanCancelSchedule('scheduled'));
  assert.throws(() => assertCanCancelSchedule('unscheduled'), /ativo/);
});

test('ciclo de vida do agendamento via SQL: schedule -> reschedule -> cancel', () => {
  // Monta um contrato mínimo a partir do seed demo (cliente + prestador existentes).
  const client = sqlite.prepare("SELECT id FROM users WHERE role = 'client' LIMIT 1").get() as { id: string };
  const provider = sqlite.prepare('SELECT id FROM provider_profiles LIMIT 1').get() as { id: string };
  assert.ok(client?.id && provider?.id, 'seed deve fornecer cliente e prestador');

  const id = randomUUID();
  sqlite
    .prepare('INSERT INTO contracts (id, client_id, provider_id, title) VALUES (?, ?, ?, ?)')
    .run(id, client.id, provider.id, 'Serviço de teste de agendamento');

  const read = () =>
    sqlite
      .prepare('SELECT scheduled_at AS scheduledAt, schedule_status AS scheduleStatus, reschedule_count AS rescheduleCount FROM contracts WHERE id = ?')
      .get(id) as { scheduledAt: string | null; scheduleStatus: string; rescheduleCount: number };

  assert.equal(read().scheduleStatus, 'unscheduled');

  // schedule
  sqlite.prepare("UPDATE contracts SET scheduled_at = ?, schedule_status = 'scheduled' WHERE id = ?").run(inDays(10), id);
  assert.equal(read().scheduleStatus, 'scheduled');
  assert.equal(read().scheduledAt, inDays(10));

  // reschedule (count++)
  sqlite.prepare('UPDATE contracts SET scheduled_at = ?, reschedule_count = reschedule_count + 1 WHERE id = ?').run(inDays(2), id);
  assert.equal(read().rescheduleCount, 1);
  assert.equal(scheduleProximity(read().scheduledAt, NOW), 'urgent');

  // cancel-schedule
  sqlite.prepare("UPDATE contracts SET scheduled_at = NULL, schedule_status = 'cancelled' WHERE id = ?").run(id);
  assert.equal(read().scheduleStatus, 'cancelled');
  assert.equal(read().scheduledAt, null);
});
