import {
  forwardRef,
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { Icon, type IconName } from '../icons';

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/* ------------------------------------------------------------------ button */

export type ButtonVariant =
  'primary' | 'secondary' | 'accent' | 'ghost' | 'danger' | 'danger-outline' | 'neutral';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  icon?: IconName;
  iconAfter?: IconName;
  loading?: boolean;
  block?: boolean;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  accent: 'btn-accent',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
  'danger-outline': 'btn-danger-outline',
  neutral: '',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    icon,
    iconAfter,
    loading,
    block,
    className,
    children,
    disabled,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={rest.type ?? 'button'}
      className={cx(
        'btn',
        VARIANT_CLASS[variant],
        size === 'sm' && 'btn-sm',
        size === 'lg' && 'btn-lg',
        block && 'btn-block',
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <span className="spinner" />
      ) : icon ? (
        <Icon name={icon} size={size === 'sm' ? 14 : 16} />
      ) : null}
      {children}
      {iconAfter && !loading ? <Icon name={iconAfter} size={size === 'sm' ? 14 : 16} /> : null}
    </button>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  label: string;
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, variant = 'ghost', size = 'md', className, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={cx('btn', 'btn-icon', VARIANT_CLASS[variant], size === 'sm' && 'btn-sm', className)}
      title={label}
      aria-label={label}
      {...rest}
    >
      <Icon name={icon} size={size === 'sm' ? 14 : 16} />
    </button>
  );
});

/* ------------------------------------------------------------------ fields */

export interface FieldProps {
  label: string;
  htmlFor?: string;
  error?: string | null;
  hint?: string;
  optional?: boolean;
  children: ReactNode;
  className?: string;
}

/** Label + control + hint/error. Every input in the platform is wrapped here. */
export function Field({ label, htmlFor, error, hint, optional, children, className }: FieldProps) {
  return (
    <div className={cx('form-group', className)}>
      <label className="form-label" htmlFor={htmlFor}>
        {label}
        {optional ? <span className="form-label__optional">optional</span> : null}
      </label>
      {children}
      {error ? (
        <span className="invalid-feedback" role="alert">
          <Icon name="alert" size={13} />
          {error}
        </span>
      ) : hint ? (
        <span className="form-hint">{hint}</span>
      ) : null}
    </div>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string | null;
  hint?: string;
  optional?: boolean;
  icon?: IconName;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, optional, icon, className, id, ...rest },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  const control = (
    <input
      ref={ref}
      id={inputId}
      className={cx('form-control', error && 'is-invalid', className)}
      aria-invalid={error ? true : undefined}
      {...rest}
    />
  );

  const wrapped = icon ? (
    <span className="input-group">
      <span className="input-group__icon">
        <Icon name={icon} size={15} />
      </span>
      {control}
    </span>
  ) : (
    control
  );

  if (!label) return wrapped;
  return (
    <Field label={label} htmlFor={inputId} error={error} hint={hint} optional={optional}>
      {wrapped}
    </Field>
  );
});

/* `Select`, `DateField` and `TimeField` live in ./pickers — the native
   controls hand their popup to the operating system, which ignores every
   token in tokens.css. */

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string | null;
  hint?: string;
  optional?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, hint, optional, className, id, ...rest },
  ref,
) {
  const generatedId = useId();
  const areaId = id ?? generatedId;
  const control = (
    <textarea
      ref={ref}
      id={areaId}
      className={cx('form-control', error && 'is-invalid', className)}
      aria-invalid={error ? true : undefined}
      {...rest}
    />
  );
  if (!label) return control;
  return (
    <Field label={label} htmlFor={areaId} error={error} hint={hint} optional={optional}>
      {control}
    </Field>
  );
});

export interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
}

export function SearchInput({ label = 'Search', className, ...rest }: SearchInputProps) {
  return (
    <span className={cx('input-group', className)}>
      <span className="input-group__icon">
        <Icon name="search" size={15} />
      </span>
      <input type="search" className="form-control" aria-label={label} {...rest} />
    </span>
  );
}

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}

export function Switch({ checked, onChange, label, hint, disabled }: SwitchProps) {
  return (
    <label className="switch">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="switch__track" aria-hidden="true" />
      <span className="switch__text">
        <span className="switch__label">{label}</span>
        {hint ? <span className="switch__hint">{hint}</span> : null}
      </span>
    </label>
  );
}

/* ------------------------------------------------------------------ badges */

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'accent' | 'ink';

export function Badge({
  tone = 'neutral',
  children,
  plain,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  plain?: boolean;
  className?: string;
}) {
  return (
    <span className={cx('badge', tone !== 'neutral' && `badge--${tone}`, plain && 'badge--plain', className)}>
      {children}
    </span>
  );
}

/* ----------------------------------------------------------------- avatars */

export function Avatar({
  name,
  size = 'md',
  ink,
  src,
}: {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  ink?: boolean;
  src?: string | null;
}) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <span
      className={cx(
        'avatar',
        size === 'sm' && 'avatar--sm',
        size === 'lg' && 'avatar--lg',
        ink && 'avatar--ink',
      )}
      aria-hidden="true"
    >
      {src ? <img src={src} alt="" /> : letters || '—'}
    </span>
  );
}

export function Identity({
  name,
  meta,
  size = 'md',
  ink,
}: {
  name: string;
  meta?: string | null;
  size?: 'sm' | 'md' | 'lg';
  ink?: boolean;
}) {
  return (
    <span className="identity">
      <Avatar name={name} size={size} ink={ink} />
      <span className="grow">
        <span className="identity__name">{name}</span>
        {meta ? <span className="identity__meta">{meta}</span> : null}
      </span>
    </span>
  );
}

/** License-plate styling without a monospace font. */
export function Plate({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx('plate', className)}>{children}</span>;
}

/* ------------------------------------------------------------------ alerts */

export function Alert({
  tone = 'info',
  children,
  className,
}: {
  tone?: 'info' | 'error' | 'warning' | 'success';
  children: ReactNode;
  className?: string;
}) {
  const icon: IconName =
    tone === 'error' ? 'alert' : tone === 'success' ? 'check' : tone === 'warning' ? 'alert' : 'info';
  return (
    <div className={cx('alert', `alert--${tone}`, className)} role={tone === 'error' ? 'alert' : undefined}>
      <span className="alert__icon">
        <Icon name={icon} size={15} />
      </span>
      <span className="grow">{children}</span>
    </div>
  );
}
