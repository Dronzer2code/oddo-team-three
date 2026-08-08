const ROW_ONE = [
  'Morning commute',
  'Evening commute',
  'Shift changeover',
  'Campus to campus',
  'Park-and-ride',
  'Client meetings',
];

const ROW_TWO = [
  'Airport transfers',
  'Late departures',
  'Team offsites',
  'Training days',
  'Site inspections',
  'Weekend on-call',
];

function Row({ items, reverse }: { items: string[]; reverse?: boolean }) {
  // The track is duplicated so the translate loop is seamless.
  const track = [...items, ...items];
  return (
    <div className={reverse ? 'marquee marquee--reverse' : 'marquee'} aria-hidden="true">
      <div className="marquee__track">
        {track.map((item, index) => (
          <span className="marquee__item" key={`${item}-${index}`}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Two counter-scrolling chip rows, as the reference uses between sections. */
export function Marquee() {
  return (
    <section className="band band--white">
      <div
        style={{
          display: 'grid',
          gap: 'var(--space-2)',
          padding: 'clamp(2rem, 4vw, 3rem) 0',
        }}
      >
        <Row items={ROW_ONE} />
        <Row items={ROW_TWO} reverse />
      </div>
      <p className="sr-only">
        RideSync covers commutes, shift changeovers, campus transfers, client meetings and offsite travel.
      </p>
    </section>
  );
}
