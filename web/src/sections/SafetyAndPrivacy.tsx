import { Icon, IMAGES, type IconName } from '@carpool/ui';

const RULES: { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'building',
    title: 'Nobody sees another organisation',
    text: 'Every record carries an organisation reference, and the organisation is resolved from the signed-in account — never from anything the browser sends.',
  },
  {
    icon: 'shield',
    title: 'Contact details stay private',
    text: 'A ride shows the driver’s name, department and vehicle. Phone numbers and addresses are not exposed to other passengers.',
  },
  {
    icon: 'history',
    title: 'Nothing is quietly deleted',
    text: 'Records referenced by a trip, payment or report are retired rather than removed, so historical reporting cannot be rewritten.',
  },
];

/**
 * Safety and privacy: photographic plate left, the three rules that actually
 * hold in the API right.
 */
export function SafetyAndPrivacy() {
  return (
    <section className="band band--faint" id="safety">
      <div className="band__inner">
        <div className="split split--reverse">
          <div>
            <span className="eyebrow">Safety and privacy</span>
            <h2 className="split__title" style={{ marginTop: 'var(--space-4)' }}>
              Closed to your organisation by design.
            </h2>
            <p className="split__lead">
              These are not interface conventions — they are enforced on the server for every request, and
              covered by the test suite.
            </p>

            <div className="stack-lg" style={{ marginTop: 'var(--space-7)' }}>
              {RULES.map((rule) => (
                <div className="row" key={rule.title} style={{ alignItems: 'flex-start' }}>
                  <span className="feature__icon" style={{ width: 42, height: 42 }}>
                    <Icon name={rule.icon} size={20} />
                  </span>
                  <div className="grow">
                    <h3 className="t-subtitle">{rule.title}</h3>
                    <p className="t-caption" style={{ marginTop: 'var(--space-1)' }}>
                      {rule.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="split__media split__media--photo">
            <img src={IMAGES.passengers} alt="A passenger travelling in the back of a car" />
          </div>
        </div>
      </div>
    </section>
  );
}
