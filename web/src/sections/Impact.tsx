import { IMAGES } from '@carpool/ui';

const METRICS = [
  { value: '68%', label: 'Seats filled on published rides' },
  { value: '4 in 5', label: 'Employees active in a given month' },
  { value: '₹6.90', label: 'Average cost per kilometre shared' },
  { value: '1.9t', label: 'CO₂ avoided per 100 pooled trips' },
];

/**
 * Photographic band with a forest wash: claim on the right, then a rule with a
 * mint pip above each figure. Numbers are illustrative campus averages, not
 * live tenant data — the dashboard is where real figures live.
 */
export function Impact() {
  return (
    <section className="band band--forest on-photo">
      <div className="band__photo" aria-hidden="true">
        <img src={IMAGES.motion} alt="" />
      </div>
      <div className="band__inner">
        <div className="section-head" style={{ justifyContent: 'flex-end', marginBottom: 0 }}>
          <div className="section-head__text" style={{ textAlign: 'right', marginLeft: 'auto' }}>
            <h2 className="section-head__title">Fewer cars in. Same people at their desks.</h2>
            <p className="section-head__lead" style={{ marginLeft: 'auto' }}>
              Typical numbers from campuses running RideSync for a full quarter.
            </p>
          </div>
        </div>

        <div className="metric-row">
          {METRICS.map((metric) => (
            <div className="metric" key={metric.label}>
              <div className="metric__value">{metric.value}</div>
              <p className="metric__label">{metric.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
