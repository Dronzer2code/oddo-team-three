import { Icon, IMAGES, VEHICLE_RENDER } from '@carpool/ui';
import { Stars } from '../components/Stars';
import { config } from '../lib/config';

/**
 * Forest hero band. Left: display headline with a vehicle render set inline
 * between words, lead, a split pill action and a rating proof line. Right: a
 * photographic plate with a white card floated over it — the reference layout.
 */
export function Hero() {
  return (
    <section className="band band--forest" id="top">
      <div className="hero">
        <div>
          <h1 className="hero__title">
            Share the drive to
            <img className="hero__title-figure" src={VEHICLE_RENDER.sedan} alt="" aria-hidden="true" />
            work.
          </h1>
          <p className="hero__lead">
            RideSync turns the cars already in your company car park into a commuting network — one
            organisation, one set of rules, every seat accounted for.
          </p>

          <div className="hero__actions">
            <span className="pill-duo">
              <span className="pill-duo__label">Already invited?</span>
              <a className="btn btn-primary" href={`${config.employeeUrl}/login`}>
                Employee sign in
              </a>
            </span>
            <a className="btn btn-secondary" href="#contact">
              Book a walkthrough
            </a>
          </div>

          <div className="hero__proof">
            <div className="rating">
              <Stars />
              <p className="rating__caption">Trusted by mobility teams at 40+ campuses</p>
            </div>
          </div>
        </div>

        <div className="hero__media">
          <div className="hero__media-frame">
            <img src={IMAGES.heroCommute} alt="Aerial view of a motorway interchange at rush hour" />
          </div>
          <div className="hero__card">
            <h2 className="hero__card-title">Every seat, priced and accounted for.</h2>
            <p className="hero__card-text">
              Publish the drive you were making anyway. RideSync splits the fuel and running cost across
              everyone on board using your organisation's own rates.
            </p>
            <div className="chip-row">
              <span className="chip">
                <Icon name="clock" size={15} />
                Publish in seconds
              </span>
              <span className="chip">
                <Icon name="route" size={15} />
                Same-route matching
              </span>
              <span className="chip">
                <Icon name="wallet" size={15} />
                Cost split per seat
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
