import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Icon, type IconName } from '../icons';
import { Button, IconButton, cx } from './primitives';

/* ------------------------------------------------------------------ states */

export function EmptyState({
  icon = 'car',
  title,
  text,
  action,
}: {
  icon?: IconName;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-state__art">
        <Icon name={icon} size={24} />
      </span>
      <h3 className="empty-state__title">{title}</h3>
      {text ? <p className="empty-state__text">{text}</p> : null}
      {action}
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  text = 'We could not load this section. Please try again.',
  onRetry,
  retryLabel = 'Try again',
}: {
  title?: string;
  text?: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div className="error-state" role="alert">
      <span className="error-state__art">
        <Icon name="alert" size={22} />
      </span>
      <h3 className="error-state__title">{title}</h3>
      <p className="error-state__text">{text}</p>
      {onRetry ? (
        <Button variant="secondary" icon="refresh" onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Offline / permission / not-found errors read differently to a generic
 * failure, so the message is chosen from the API error code.
 */
export function resolveErrorCopy(error: { code?: string; message?: string } | null | undefined): {
  title: string;
  text: string;
} {
  const code = error?.code ?? '';
  if (code === 'NETWORK_ERROR') {
    return {
      title: 'Connection unavailable',
      text: 'Check your internet connection and try again.',
    };
  }
  if (code === 'FORBIDDEN' || code === 'ACCOUNT_NOT_OPERATIONAL') {
    return {
      title: 'Access not allowed',
      text: error?.message ?? 'You do not have permission to view this.',
    };
  }
  if (code === 'RESOURCE_NOT_FOUND') {
    return {
      title: 'Not found',
      text: error?.message ?? 'That record no longer exists.',
    };
  }
  return {
    title: 'Something went wrong',
    text: error?.message ?? 'Please try again in a moment.',
  };
}

/* --------------------------------------------------------------- skeletons */

export function Skeleton({
  width,
  height,
  variant = 'text',
  className,
  style,
}: {
  width?: number | string;
  height?: number | string;
  variant?: 'text' | 'title' | 'block';
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={cx('skeleton', `skeleton--${variant}`, className)}
      style={{ display: 'block', width, height, ...style }}
      aria-hidden="true"
    />
  );
}

/** Preserves the final table layout so nothing jumps when data arrives. */
export function SkeletonTable({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="table-responsive" aria-busy="true">
      <table className="table">
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex}>
              {Array.from({ length: columns }).map((__, columnIndex) => (
                <td key={columnIndex}>
                  <Skeleton width={columnIndex === 0 ? '62%' : '44%'} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SkeletonCards({ count = 3, height = 148 }: { count?: number; height?: number }) {
  return (
    <div className="grid grid-auto" aria-busy="true">
      {Array.from({ length: count }).map((_, index) => (
        <div className="card" key={index}>
          <div className="card-body stack">
            <Skeleton width="38%" />
            <Skeleton variant="title" width="66%" />
            <Skeleton width="52%" />
            <Skeleton height={height / 4} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-4" aria-busy="true">
      {Array.from({ length: count }).map((_, index) => (
        <div className="card-statistic" key={index}>
          <Skeleton width="52%" />
          <Skeleton variant="title" width="40%" height={30} />
          <Skeleton width="30%" />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ modals */

export function Modal({
  open,
  onClose,
  title,
  lead,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  lead?: string;
  children?: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    if (!panelRef.current?.contains(document.activeElement)) {
      panelRef.current?.focus();
    }

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  /* Portalled to <body> deliberately. The scrim is `position: fixed`, and any
     ancestor with a transform, filter or backdrop-filter would become its
     containing block — confining the overlay to that ancestor's box and
     leaving the rest of the viewport undimmed. Rendering at the document root
     means no page can ever do that to a modal. */
  return createPortal(
    <div
      className="modal-scrim"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={cx('modal', wide && 'modal--wide')}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={panelRef}
      >
        <header className="modal__header">
          <div className="grow">
            <h2 className="modal__title">{title}</h2>
            {lead ? <p className="modal__lead">{lead}</p> : null}
          </div>
          <IconButton icon="x" label="Close" onClick={onClose} />
        </header>
        {children ? <div className="modal__body">{children}</div> : null}
        {footer ? <footer className="modal__footer">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}

/** Confirmation for destructive or access-changing actions. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'primary',
  busy,
  onConfirm,
  onCancel,
  children,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      lead={message}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  );
}

/* ------------------------------------------------------------------ toasts */

export interface Toast {
  id: number;
  tone: 'success' | 'error' | 'info';
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (tone: Toast['tone'], message: string) => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, tone, message }]);
      window.setTimeout(() => dismiss(id), tone === 'error' ? 6500 : 4000);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => push('success', message),
      error: (message) => push('error', message),
      info: (message) => push('info', message),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div className={cx('toast', `toast--${toast.tone}`)} key={toast.id}>
            <span className="toast__icon">
              <Icon
                name={toast.tone === 'success' ? 'check' : toast.tone === 'error' ? 'alert' : 'info'}
                size={15}
              />
            </span>
            <span className="toast__text">{toast.message}</span>
            <button className="toast__close" onClick={() => dismiss(toast.id)} aria-label="Dismiss">
              <Icon name="x" size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside a ToastProvider');
  return context;
}

/* -------------------------------------------------------------- pagination */

export function Pagination({
  page,
  pageSize,
  total,
  totalPages,
  onPage,
  label = 'records',
}: {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPage: (page: number) => void;
  label?: string;
}) {
  if (total === 0) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <div className="pagination">
      <span>
        Showing {first}–{last} of {total} {label}
      </span>
      <div className="pagination__controls">
        <Button
          variant="secondary"
          size="sm"
          icon="arrowLeft"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </Button>
        <span className="t-caption" style={{ padding: '0 var(--space-2)' }}>
          Page {page} of {Math.max(1, totalPages)}
        </span>
        <Button
          variant="secondary"
          size="sm"
          iconAfter="arrowRight"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- splash */

/**
 * A thin route line draws across, a car indicator travels it, then the app
 * fades in. Roughly one second — never a blank white screen on boot.
 */
export function Splash({ label = 'RideSync', leaving }: { label?: string; leaving?: boolean }) {
  return (
    <div className={cx('splash', leaving && 'splash--leaving')}>
      <div className="splash__inner">
        <span className="splash__word">{label}</span>
        <span className="splash__track">
          <span className="splash__road" />
          <span className="splash__car">
            <Icon name="car" size={18} />
          </span>
        </span>
      </div>
    </div>
  );
}
