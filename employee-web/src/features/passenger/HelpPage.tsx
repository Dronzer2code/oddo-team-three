import { Link } from 'react-router-dom';
import { Card, CardBody, CardHeader, DetailList, Icon, PageHeader } from '@carpool/ui';
import { useApi } from '../../lib/hooks';
import { api } from '../../lib/api';

/**
 * Help & Safety. Everything on this page is either a link into the product or
 * a contact detail the organization actually configured — nothing invented.
 */
export function HelpPage() {
  const profile = useApi(() => api.employee.profile.get(), []);

  return (
    <>
      <PageHeader title="Help & Safety" lead="How carpooling works here, and who to contact." />

      <div className="grid grid-split-tight" style={{ alignItems: 'start' }}>
        <div className="stack-lg">
          <Card>
            <CardHeader title="Before the ride" />
            <CardBody>
              <ul className="stack" style={{ paddingLeft: '1.1rem' }}>
                <li>Check the driver's name and the vehicle registration on your booking before you get in.</li>
                <li>Your seat is only held once the booking shows <strong>Confirmed</strong>.</li>
                <li>Cancel as early as you can so the seat goes back to a colleague who needs it.</li>
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="During the ride" />
            <CardBody>
              <ul className="stack" style={{ paddingLeft: '1.1rem' }}>
                <li>The Live Trip page shows the trip status your driver has set.</li>
                <li>Driver contact details are shared with you once your seat is confirmed.</li>
                <li>If something feels wrong, end the ride and contact your administrator.</li>
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="After the ride" />
            <CardBody>
              <ul className="stack" style={{ paddingLeft: '1.1rem' }}>
                <li>Your share of the cost is calculated when the driver completes the trip.</li>
                <li>Settle with the driver directly — RideSync records it but does not move money.</li>
                <li>Completed trips stay in your History with the distance and cost recorded at the time.</li>
              </ul>
            </CardBody>
          </Card>
        </div>

        <div className="stack-lg">
          <Card>
            <CardHeader title="Your organization" />
            <CardBody>
              <DetailList
                items={[
                  { label: 'Organization', value: profile.data?.organizationName ?? '—' },
                  { label: 'Your account', value: profile.data?.email ?? '—' },
                  { label: 'Account status', value: profile.data?.status ?? '—' },
                ]}
              />
              <p className="t-caption" style={{ marginTop: 'var(--space-3)' }}>
                Access questions — suspension, approvals, vehicle reviews — are handled by your
                organization's administrator.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Quick links" />
            <CardBody className="stack">
              <Link className="btn btn-secondary btn-sm" to="/passenger/bookings">
                <Icon name="seat" size={14} />
                My Bookings
              </Link>
              <Link className="btn btn-secondary btn-sm" to="/passenger/live-trip">
                <Icon name="pin" size={14} />
                Live Trip
              </Link>
              <Link className="btn btn-secondary btn-sm" to="/passenger/profile">
                <Icon name="user" size={14} />
                Profile
              </Link>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
