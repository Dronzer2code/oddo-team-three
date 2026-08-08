const STEPS = [
  {
    index: 'Step 01',
    title: 'Your company invites the team',
    text: 'An administrator invites employees or shares the organization code. Nobody outside the company can join, and access can be suspended at any time.',
  },
  {
    index: 'Step 02',
    title: 'Drivers publish the commute they already make',
    text: 'Pick the vehicle, the route and how many seats are free. The estimated cost per seat is calculated from the company fuel and running-cost configuration.',
  },
  {
    index: 'Step 03',
    title: 'Colleagues request a seat',
    text: 'Passengers search by area, date and time, then request a seat. The driver accepts or declines — no group chats, no guessing.',
  },
  {
    index: 'Step 04',
    title: 'The trip closes the loop',
    text: 'Start the trip, complete it with the real distance, and the cost split is settled between colleagues. The company sees participation and cost the same day.',
  },
];

export function HowItWorks() {
  return (
    <section className="section" id="how">
      <div className="section__head">
        <span className="eyebrow">How it works</span>
        <h2 className="section__title">Four steps. No coordination overhead.</h2>
        <p className="section__lead">
          The whole product is one loop: publish, request, accept, complete. Everything the company needs
          for reporting falls out of that loop automatically.
        </p>
      </div>

      <div className="steps">
        {STEPS.map((step) => (
          <article className="step" key={step.index}>
            <div className="step__index">{step.index}</div>
            <h3 className="step__title">{step.title}</h3>
            <p className="step__text">{step.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
