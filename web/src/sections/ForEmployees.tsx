import { Icon, VEHICLE_RENDER, type IconName } from '@carpool/ui';
import { config } from '../lib/config';

const POINTS: { icon: IconName; label: string }[] = [
  { icon: 'car', label: 'Drive or ride — one account' },
  { icon: 'wallet', label: 'See the cost before you commit' },
  { icon: 'users', label: 'Only colleagues, never strangers' },
];

/**
 * Benefits for employees, on the reference's forest inset panel: copy and
 * inline chips left, isometric vehicle render right.
 */
export function ForEmployees() {
  return (
    <section
      id="employees"
      style={{
        background: 'var(--color-bg)',
        paddingBlock: 'var(--panel-inset)',
      }}
    >
      <div className="panel panel--forest">
        <div className="panel__inner">
          <div className="split">
            <div>
              <span className="eyebrow">For employees</span>
              <h2
                className="split__title"
                style={{
                  marginTop: 'var(--space-4)',
                  color: 'var(--color-mint)',
                }}
              >
                One account. Drive some days, ride the others.
              </h2>
              <p className="split__lead">
                There is no separate driver profile to apply for. Register a vehicle and you can publish;
                leave it out and you can request a seat. Your trip history keeps both roles in one place.
              </p>

              <div className="chip-row" style={{ marginTop: 'var(--space-6)' }}>
                {POINTS.map((point) => (
                  <span className="chip chip--outline" key={point.label}>
                    <Icon name={point.icon} size={15} />
                    {point.label}
                  </span>
                ))}
              </div>

              <a
                className="btn btn-accent btn-lg"
                href={`${config.employeeUrl}/login`}
                style={{ marginTop: 'var(--space-7)' }}
              >
                Open the employee app
              </a>
            </div>

            <div className="split__media">
              <img src={VEHICLE_RENDER.pair} alt="Two cars rendered in isometric projection" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
