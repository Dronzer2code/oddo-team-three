import { DIAGRAM, Icon, VEHICLE_RENDER } from '@carpool/ui';

const SOURCES = ['Own vehicle', 'Company pool car', 'Shared household car'];
const OUTCOMES = [
  'Daily commute',
  'Shift handover',
  'Campus shuttle',
  'Client visit',
  'Airport run',
  'Late departure',
  'Site inspection',
  'Team offsite',
];

/**
 * How it works, on the reference's inset panel: a centred statement with an
 * inline pictorial, then a left-to-right diagram — vehicle sources feed the
 * matching service, which produces the trips employees actually take.
 */
export function HowItWorks() {
  return (
    <section
      id="how"
      style={{
        background: 'var(--color-bg)',
        paddingBlock: 'var(--panel-inset)',
      }}
    >
      <div className="panel panel--faint">
        <div className="panel__inner">
          <div className="section-head section-head--center">
            <span className="eyebrow">How RideSync works</span>
            <div className="section-head__text">
              <h2 className="section-head__title" style={{ fontSize: 'clamp(1.75rem, 3.4vw, 2.5rem)' }}>
                An employee publishes the drive they were making anyway, and RideSync fills the empty
                <span className="inline-mark">
                  <Icon name="seat" size={22} />
                </span>
                seats.
              </h2>
            </div>
          </div>

          <div className="flow">
            <div className="flow__group">
              <div className="flow__note">
                <h3 className="flow__note-title">Vehicle register</h3>
                <p className="flow__note-text">
                  Only vehicles the organisation has marked active can be selected for a new ride.
                </p>
              </div>
              <img className="flow__branch" src={DIAGRAM.branch} alt="" aria-hidden="true" />
              <div className="flow__stack">
                {SOURCES.map((source) => (
                  <span className="chip chip--white" key={source}>
                    {source}
                  </span>
                ))}
              </div>
            </div>

            <img className="flow__arrow" src={DIAGRAM.arrow} alt="" aria-hidden="true" />

            <div className="flow__group flow__group--forest">
              <div className="flow__card">
                Matching service
                <img src={VEHICLE_RENDER.topDown} alt="" aria-hidden="true" />
              </div>
            </div>

            <img className="flow__arrow" src={DIAGRAM.arrow} alt="" aria-hidden="true" />

            <div className="flow__group flow__group--stack">
              <div className="flow__matrix">
                {OUTCOMES.map((outcome) => (
                  <span className="chip chip--white" key={outcome}>
                    {outcome}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
