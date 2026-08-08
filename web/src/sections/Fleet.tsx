import { VEHICLE_RENDER } from '@carpool/ui';

const CLASSES = [
  {
    render: VEHICLE_RENDER.sedan,
    name: 'Sedan / hatchback',
    text: 'The everyday commuter car. Three passenger seats, lowest cost per kilometre.',
    tag: '3 seats offered',
  },
  {
    render: VEHICLE_RENDER.suv,
    name: 'SUV',
    text: 'Room for luggage and site kit, and the usual choice for longer inter-campus runs.',
    tag: '4 seats offered',
  },
  {
    render: VEHICLE_RENDER.van,
    name: 'Van / minibus',
    text: 'Company-owned pool vehicles used for shift changeovers and team travel.',
    tag: '6 seats offered',
  },
];

/**
 * Vehicle classes, laid out like the reference's rental cards: mint card,
 * isometric render, name, description and a white capacity chip.
 */
export function Fleet() {
  return (
    <section className="band band--white" id="fleet">
      <div className="band__inner">
        <div className="section-head">
          <div className="section-head__text">
            <span className="eyebrow">Vehicles in the pool</span>
            <h2 className="section-head__title" style={{ marginTop: 'var(--space-4)' }}>
              Whatever your people already drive, RideSync prices it.
            </h2>
          </div>
          <a className="btn btn-primary" href="#companies">
            Configure costs
          </a>
        </div>

        <div className="offer-grid">
          {CLASSES.map((vehicle) => (
            <article className="offer" key={vehicle.name}>
              <div className="offer__media">
                <img src={vehicle.render} alt={`${vehicle.name} rendered in isometric projection`} />
              </div>
              <h3 className="offer__title">{vehicle.name}</h3>
              <p className="offer__text">{vehicle.text}</p>
              <span className="offer__tag">{vehicle.tag}</span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
