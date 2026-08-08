import { IMAGES, Icon } from '@carpool/ui';

const POINTS = [
  {
    title: 'Colleagues only',
    text: 'Every record carries an organization reference and every request is scoped to the signed-in user’s organization on the server.',
  },
  {
    title: 'Contact details are earned, not published',
    text: 'A driver’s phone number appears once a seat is accepted. Before that, passengers see a name, a department and the vehicle.',
  },
  {
    title: 'Approved vehicles only',
    text: 'Companies can require vehicle approval before a car is allowed to carry colleagues. Inactive vehicles cannot be selected for new rides.',
  },
  {
    title: 'Nothing quietly disappears',
    text: 'Employees and vehicles referenced by past trips are deactivated, never deleted, so historical reports stay intact.',
  },
];

export function SafetyAndPrivacy() {
  return (
    <section className="section" id="safety">
      <div className="split split--reverse">
        <div className="split__media">
          <img src={IMAGES.parking} alt="Parked cars in a company car park at dusk" loading="lazy" />
        </div>
        <div>
          <span className="eyebrow">Safety and privacy</span>
          <h2 className="section__title">Sharing a car is a trust decision.</h2>
          <p className="section__lead">
            So the platform is conservative by default: closed to your organization, minimal data on display,
            and an audit trail behind every administrative action.
          </p>

          <ul className="checklist">
            {POINTS.map((point) => (
              <li key={point.title}>
                <span className="checklist__mark">
                  <Icon name="shield" size={12} />
                </span>
                <span>
                  <span className="checklist__title">{point.title}</span>
                  <br />
                  <span className="checklist__text">{point.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
