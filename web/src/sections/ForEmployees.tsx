import { IMAGES, Icon } from '@carpool/ui';

const POINTS = [
  {
    title: 'One screen answers the morning question',
    text: 'Your next ride, the seats left in it, and two buttons: find a ride or publish one.',
  },
  {
    title: 'Ride with colleagues, not strangers',
    text: 'Every ride belongs to your organization. You see a name, a department and a vehicle — nothing more until a seat is confirmed.',
  },
  {
    title: 'Costs are worked out for you',
    text: 'Fuel and running cost come from the company configuration, split across the people actually in the car.',
  },
  {
    title: 'A trip history you can point at',
    text: 'Distance, cost and role for every trip you have taken or driven — useful at reimbursement time.',
  },
];

export function ForEmployees() {
  return (
    <section className="section" id="employees">
      <div className="split">
        <div>
          <span className="eyebrow">For employees</span>
          <h2 className="section__title">Your commute, minus the empty seats.</h2>
          <p className="section__lead">
            The employee app is deliberately small. It is built for the thirty seconds before you leave the
            house, not for browsing.
          </p>

          <ul className="checklist">
            {POINTS.map((point) => (
              <li key={point.title}>
                <span className="checklist__mark">
                  <Icon name="check" size={12} />
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

        <div className="split__media">
          <img src={IMAGES.carInterior} alt="Two colleagues sharing a car on the way to work" loading="lazy" />
        </div>
      </div>
    </section>
  );
}
