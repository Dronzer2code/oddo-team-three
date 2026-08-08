import type { ReactNode } from 'react';
import { PHOTO } from '../assets';

/**
 * Wordmark, shared by all four applications so the logotype is defined once.
 * Light lowercase with a raised registered mark, set in type rather than as an
 * image so it stays crisp and recolours with the surface it sits on.
 */
export function Wordmark({ ink = false, href }: { ink?: boolean; href?: string }) {
  const className = ink ? 'brand brand--ink' : 'brand';
  const inner = (
    <>
      <span className="brand__name">ridesync</span>
      <span className="brand__reg" aria-hidden="true">
        ®
      </span>
    </>
  );
  return href ? (
    <a className={className} href={href} aria-label="RideSync">
      {inner}
    </a>
  ) : (
    <span className={className}>{inner}</span>
  );
}

export interface AuthProof {
  value: string;
  label: string;
}

/**
 * Sign-in / onboarding shell used by both the admin panel and the employee
 * application. The form column is a single left-aligned axis — wordmark pinned
 * top-left, form centred vertically on the same axis, legal line pinned bottom
 * — beside a forest photographic plate carrying the claim and proof figures.
 */
export function AuthLayout({
  eyebrow,
  title,
  lead,
  children,
  footer,
  claim,
  claimText,
  proof = [],
  photo = PHOTO.openRoad,
  legal = 'Demo environment · seeded data only',
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  children: ReactNode;
  footer?: ReactNode;
  claim: string;
  claimText?: string;
  proof?: AuthProof[];
  photo?: string;
  legal?: string;
}) {
  return (
    <div className="auth">
      <div className="auth__panel">
        <Wordmark ink />

        <div className="auth__inner">
          {eyebrow ? <span className="auth__eyebrow">{eyebrow}</span> : null}
          <h1 className="auth__title">{title}</h1>
          {lead ? <p className="auth__lead">{lead}</p> : null}
          {children}
        </div>

        <div className="auth__legal">
          <span>{legal}</span>
          {footer}
        </div>
      </div>

      <div className="auth__aside">
        <img className="auth__aside-photo" src={photo} alt="" aria-hidden="true" />
        <div className="auth__aside-content">
          <div>
            <p className="auth__aside-quote">{claim}</p>
            {claimText ? <p className="auth__aside-text">{claimText}</p> : null}
          </div>
          {proof.length ? (
            <div className="auth__aside-meta">
              {proof.map((item) => (
                <div key={item.label}>
                  <div className="auth__aside-stat-value">{item.value}</div>
                  <div className="auth__aside-stat-label">{item.label}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
