import { BOOKING_STATUS, formatDateTime, type Booking } from '@carpool/shared';
import { Alert, Button, Modal } from '@carpool/ui';
import { api } from '../../lib/api';
import { useMutation } from '../../lib/hooks';

/**
 * Cancel Booking. Confirmed seats go back to the ride the moment the API
 * succeeds, so the dialog says so plainly before the passenger commits.
 */
export function CancelBookingDialog({
  booking,
  onClose,
  onDone,
}: {
  booking: Booking | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const mutation = useMutation((id: string) => api.passenger.bookings.cancel(id));

  if (!booking) return null;

  async function confirm() {
    const result = await mutation.run(booking!.id);
    if (result) onDone();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Cancel Booking"
      lead={`${booking.startLocation} → ${booking.destination}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.busy}>
            Keep Booking
          </Button>
          <Button variant="danger" onClick={confirm} loading={mutation.busy}>
            Cancel Booking
          </Button>
        </>
      }
    >
      <div className="stack">
        {mutation.error ? <Alert tone="error">{mutation.error.message}</Alert> : null}
        <p className="t-caption">
          Departing {formatDateTime(booking.departureAt)} with {booking.driver.name}.
        </p>
        <Alert tone="warning">
          {booking.status === BOOKING_STATUS.CONFIRMED
            ? `Your ${booking.requestedSeats} seat${
                booking.requestedSeats === 1 ? '' : 's'
              } will be released back to the ride straight away.`
            : 'Your request will be withdrawn and the driver will no longer see it.'}
        </Alert>
      </div>
    </Modal>
  );
}
