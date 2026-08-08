import { Icon, IMAGES } from '@carpool/ui';
import { config } from '../lib/config';

/**
 * Mobile promotion on the reference's forest inset panel: device render bleeding
 * off the bottom edge, centred copy and two store badges on the right. Also
 * carries the three sign-in entry points the brief requires.
 */
export function AppEntries() {
  return (
    <section
      id="apps"
      style={{
        background: 'var(--color-bg)',
        paddingBlock: 'var(--panel-inset)',
      }}
    >
      <div className="panel panel--forest">
        <div className="panel__inner">
          <div className="promo">
            <div className="promo__device">
              <img src={IMAGES.phoneMap} alt="The RideSync mobile app showing a matched route" />
            </div>
            <div className="promo__body">
              <span className="eyebrow">RideSync on mobile</span>
              <h2 className="promo__title">
                Publish a ride from the car park. Accept a request from the platform.
              </h2>
              <p className="promo__text">
                The React Native app talks to the same API and obeys the same authorisation rules as the web
                application — no business logic is duplicated on the device.
              </p>
              <div className="store-row">
                <span className="store-badge">
                  <Icon name="phone" size={20} />
                  <span>
                    <span className="store-badge__over">Download on</span>
                    <span className="store-badge__name">iOS TestFlight</span>
                  </span>
                </span>
                <span className="store-badge">
                  <Icon name="download" size={20} />
                  <span>
                    <span className="store-badge__over">Get it on</span>
                    <span className="store-badge__name">Android build</span>
                  </span>
                </span>
              </div>

              <div
                className="chip-row"
                style={{
                  justifyContent: 'center',
                  marginTop: 'var(--space-4)',
                }}
              >
                <a className="chip" href={`${config.employeeUrl}/login`}>
                  Employee sign in
                </a>
                <a className="chip" href={`${config.adminUrl}/login`}>
                  Administrator sign in
                </a>
                <a className="chip chip--outline" href="#contact">
                  Request access
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
