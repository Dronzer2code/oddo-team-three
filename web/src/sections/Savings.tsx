import { IMAGES } from '@carpool/ui';

const FIGURES = [
  { value: '3 → 1', label: 'Cars per four commuters' },
  { value: '₹4,800', label: 'Saved per driver each quarter' },
  { value: '41%', label: 'Fewer kilometres claimed' },
  { value: '12 t', label: 'CO₂ avoided per 1,000 trips' },
];

/**
 * Sustainability and cost saving. Same metric row treatment as the impact
 * band, on a light ground so the two do not read as one long dark section.
 */
export function Savings() {
  return (
    <section className="band band--white" id="savings">
      <div className="band__inner">
        <div className="split">
          <div className="split__media split__media--photo">
            <img src={IMAGES.roadAerial} alt="Aerial view of a multi-lane highway" />
          </div>
          <div>
            <span className="eyebrow">Cost and carbon</span>
            <h2 className="split__title" style={{ marginTop: 'var(--space-4)' }}>
              Four people, one car, the same working day.
            </h2>
            <p className="split__lead">
              Fuel is split at the rate that was in force when the trip ran, so what employees are asked to
              contribute matches what the organisation reports. No reconciliation afterwards.
            </p>
          </div>
        </div>

        <div className="metric-row metric-row--ink">
          {FIGURES.map((figure) => (
            <div className="metric" key={figure.label}>
              <div className="metric__value">{figure.value}</div>
              <p className="metric__label">{figure.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
