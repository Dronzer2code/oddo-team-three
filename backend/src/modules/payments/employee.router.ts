import { Router } from 'express';
import { PAYMENT_STATUS, type WalletSummary } from '@carpool/shared';
import { actorOf, authenticate, requireRole } from '../../middleware/auth.js';
import { parseId } from '../../middleware/validate.js';
import { handler, ok } from '../../shared/http.js';
import { errors } from '../../shared/errors.js';
import { num, round2 } from '../../database/client.js';
import { mapPayment } from '../../shared/mappers.js';

export const employeePaymentsRouter = Router();
employeePaymentsRouter.use(authenticate, requireRole('employee'));

const PAYMENT_SELECT = `
SELECT p.*, payer.name AS payer_name, receiver.name AS receiver_name,
       t.start_location, t.destination
  FROM payments p
  JOIN users payer ON payer.id = p.payer_id
  JOIN users receiver ON receiver.id = p.receiver_id
  JOIN trips t ON t.id = p.trip_id`;

/** GET /api/employee/payments — my cost-sharing ledger. */
employeePaymentsRouter.get(
  '/',
  handler(async (req, res) => {
    const actor = actorOf(req);

    const { rows } = await req.db.query(
      `${PAYMENT_SELECT}
        WHERE p.organization_id = $2::uuid AND (p.payer_id = $1::uuid OR p.receiver_id = $1::uuid)
        ORDER BY p.created_at DESC LIMIT 100`,
      [actor.id, actor.organizationId],
    );

    const payments = rows.map((row) => mapPayment(row as Record<string, any>, actor.id));

    const sum = (predicate: (p: (typeof payments)[number]) => boolean) =>
      round2(payments.filter(predicate).reduce((total, p) => total + p.amount, 0));

    const summary: WalletSummary = {
      currency: actor.organizationCurrency,
      owed: sum((p) => p.direction === 'outgoing' && p.status === PAYMENT_STATUS.PENDING),
      receivable: sum((p) => p.direction === 'incoming' && p.status === PAYMENT_STATUS.PENDING),
      settledOut: sum((p) => p.direction === 'outgoing' && p.status === PAYMENT_STATUS.SETTLED),
      settledIn: sum((p) => p.direction === 'incoming' && p.status === PAYMENT_STATUS.SETTLED),
      net: 0,
      payments,
    };
    summary.net = round2(summary.receivable - summary.owed);

    return ok(res, summary);
  }),
);

/**
 * POST /api/employee/payments/:id/settle
 * Only the receiving driver can confirm a settlement — a payer cannot mark
 * their own debt as paid.
 */
employeePaymentsRouter.post(
  '/:id/settle',
  handler(async (req, res) => {
    const actor = actorOf(req);
    const paymentId = parseId(req.params.id, 'payment id');

    await req.db.transaction(async (tx) => {
      const { rows } = await tx.query<{ receiver_id: string; status: string }>(
        `SELECT receiver_id, status::text AS status FROM payments
          WHERE id = $1::uuid AND organization_id = $2::uuid FOR UPDATE`,
        [paymentId, actor.organizationId],
      );
      const payment = rows[0];
      if (!payment) throw errors.notFound('That payment does not exist');
      if (payment.receiver_id !== actor.id) {
        throw errors.forbidden('Only the driver receiving the amount can confirm settlement');
      }
      if (payment.status !== PAYMENT_STATUS.PENDING) throw errors.ruleViolation(`This payment is already ${payment.status}`);

      await tx.query(
        `UPDATE payments SET status = 'settled'::payment_status, paid_at = NOW() WHERE id = $1::uuid`,
        [paymentId],
      );
    });

    const { rows } = await req.db.query(`${PAYMENT_SELECT} WHERE p.id = $1::uuid`, [paymentId]);
    return ok(res, mapPayment(rows[0] as Record<string, any>, actor.id), 'Payment settled');
  }),
);

export { num as _num };
