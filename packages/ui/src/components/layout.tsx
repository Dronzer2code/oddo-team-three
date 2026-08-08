import type { ReactNode } from 'react';
import { Icon, type IconName } from '../icons';
import { cx } from './primitives';

/* ------------------------------------------------------------------- cards */

export function Card({
  children,
  className,
  interactive,
  as: Tag = 'section',
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
  as?: 'section' | 'div' | 'article';
}) {
  return <Tag className={cx('card', interactive && 'card--interactive', className)}>{children}</Tag>;
}

export function CardHeader({
  title,
  lead,
  actions,
  className,
}: {
  title: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cx('card-header', className)}>
      <div className="grow">
        <h2>{title}</h2>
        {lead ? <p className="t-caption" style={{ marginTop: 2 }}>{lead}</p> : null}
      </div>
      {actions ? <div className="card-header__actions">{actions}</div> : null}
    </header>
  );
}

export function CardBody({
  children,
  className,
  tight,
  flush,
}: {
  children: ReactNode;
  className?: string;
  tight?: boolean;
  flush?: boolean;
}) {
  return (
    <div className={cx('card-body', tight && 'card-body--tight', flush && 'card-body--flush', className)}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className }: { children: ReactNode; className?: string }) {
  return <footer className={cx('card-footer', className)}>{children}</footer>;
}

/* ------------------------------------------------------------ page header */

export interface Crumb {
  label: string;
  href?: string;
}

export function PageHeader({
  title,
  lead,
  actions,
  breadcrumbs,
  renderLink,
}: {
  title: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
  breadcrumbs?: Crumb[];
  /** Injected by each app so the design system stays router-agnostic. */
  renderLink?: (crumb: Crumb) => ReactNode;
}) {
  return (
    <div>
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <nav className="breadcrumb" aria-label="Breadcrumb">
          {breadcrumbs.map((crumb, index) => (
            <span key={`${crumb.label}-${index}`} className="row" style={{ gap: 6 }}>
              {index > 0 ? <Icon name="chevronRight" size={12} /> : null}
              {crumb.href && renderLink ? renderLink(crumb) : <span>{crumb.label}</span>}
            </span>
          ))}
        </nav>
      ) : null}
      <div className="section-header">
        <div className="section-header__text">
          <h1 className="section-header__title">{title}</h1>
          {lead ? <p className="section-header__lead">{lead}</p> : null}
        </div>
        {actions ? <div className="section-header__actions">{actions}</div> : null}
      </div>
    </div>
  );
}

export function SectionHeading({
  title,
  lead,
  actions,
}: {
  title: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="row-between" style={{ marginBottom: 'var(--space-4)', alignItems: 'flex-end' }}>
      <div className="grow">
        <h2 className="t-subtitle">{title}</h2>
        {lead ? <p className="t-caption">{lead}</p> : null}
      </div>
      {actions ? <div className="row" style={{ gap: 'var(--space-2)' }}>{actions}</div> : null}
    </div>
  );
}

/* -------------------------------------------------------------- statistics */

export interface StatProps {
  label: string;
  value: ReactNode;
  icon?: IconName;
  accent?: boolean;
  foot?: ReactNode;
  small?: boolean;
}

export function Stat({ label, value, icon, accent, foot, small }: StatProps) {
  return (
    <article className="card-statistic">
      <div className="card-statistic__head">
        <span className="t-label">{label}</span>
        {icon ? (
          <span className={cx('card-statistic__icon', accent && 'card-statistic__icon--accent')}>
            <Icon name={icon} size={15} />
          </span>
        ) : null}
      </div>
      <div className={cx('card-statistic__value', small && 'card-statistic__value--sm')}>{value}</div>
      {foot ? <div className="card-statistic__foot">{foot}</div> : null}
    </article>
  );
}

export function Trend({ direction, children }: { direction: 'up' | 'down' | 'flat'; children: ReactNode }) {
  if (direction === 'flat') return <span className="t-caption">{children}</span>;
  return (
    <span className={cx('trend', direction === 'up' ? 'trend--up' : 'trend--down')}>
      <Icon name={direction === 'up' ? 'arrowUp' : 'arrowDown'} size={12} />
      {children}
    </span>
  );
}

/* ------------------------------------------------------------ detail list */

export function DetailList({
  items,
  className,
}: {
  items: Array<{ label: string; value: ReactNode }>;
  className?: string;
}) {
  return (
    <dl className={cx('detail-list', className)}>
      {items.map((item) => (
        <div className="detail-list__item" key={item.label}>
          <dt className="detail-list__label">{item.label}</dt>
          <dd className="detail-list__value">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
