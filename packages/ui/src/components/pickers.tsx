/* ==========================================================================
   Pickers — Select, DateField, TimeField
   --------------------------------------------------------------------------
   Native <select>, <input type="date"> and <input type="time"> all render
   their popup with the operating system, not with the page's CSS. That popup
   ignores every design token in tokens.css, so the four applications used to
   show a grey Windows menu the moment anything was opened.

   These three controls replace the native ones. Each is a button styled as a
   .form-control plus a popover painted from the same tokens as the rest of
   the platform. The popover is portalled to <body> and positioned with fixed
   coordinates so a card, a table scroller or a modal can never clip it.

   The public props are deliberately the same shape the native controls had —
   `value` is still a string, `onChange` still receives something with
   `target.value` — so call sites read exactly as they did before.
   ========================================================================== */

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Icon, type IconName } from '../icons';
import { cx, Field } from './primitives';

/* ------------------------------------------------------------------ shared */

/** What a call site receives from `onChange`. Mirrors a DOM change event. */
export interface FieldChangeEvent {
  target: { value: string; name?: string };
  currentTarget: { value: string; name?: string };
}

function changeEvent(value: string, name?: string): FieldChangeEvent {
  const target = { value, name };
  return { target, currentTarget: target };
}

interface PopoverGeometry {
  left: number;
  top: number;
  width: number;
  placement: 'below' | 'above';
}

/**
 * Open/close plumbing shared by the three controls: outside click, Escape,
 * and fixed-position geometry that flips above the trigger when the viewport
 * runs out of room below it.
 */
function usePopover(estimatedHeight: number) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [geometry, setGeometry] = useState<PopoverGeometry>({
    left: 0,
    top: 0,
    width: 0,
    placement: 'below',
  });

  const measure = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const height = menuRef.current?.offsetHeight ?? estimatedHeight;
    const below = window.innerHeight - rect.bottom;
    const placement: 'below' | 'above' = below < height + 16 && rect.top > below ? 'above' : 'below';
    setGeometry({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)),
      top: placement === 'below' ? rect.bottom + 6 : rect.top - 6 - height,
      width: rect.width,
      placement,
    });
  }, [estimatedHeight]);

  useLayoutEffect(() => {
    if (open) measure();
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const node = event.target as Node;
      if (triggerRef.current?.contains(node) || menuRef.current?.contains(node)) return;
      setOpen(false);
    };
    const onScrollOrResize = () => measure();
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [open, measure]);

  return { open, setOpen, triggerRef, menuRef, geometry };
}

/** The popover surface itself — portalled so nothing can clip it. */
function Popover({
  geometry,
  menuRef,
  minWidth,
  className,
  children,
  labelledBy,
  role,
}: {
  geometry: PopoverGeometry;
  menuRef: React.RefObject<HTMLDivElement>;
  minWidth?: number;
  className?: string;
  children: ReactNode;
  labelledBy?: string;
  role?: string;
}) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      ref={menuRef}
      role={role}
      aria-labelledby={labelledBy}
      className={cx('picker-pop', geometry.placement === 'above' && 'picker-pop--above', className)}
      style={{
        left: geometry.left,
        top: geometry.top,
        minWidth: Math.max(geometry.width, minWidth ?? 0),
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

/** Shared trigger button: looks exactly like a .form-control. */
function Trigger({
  id,
  triggerRef,
  open,
  disabled,
  invalid,
  onToggle,
  onKeyDown,
  placeholder,
  text,
  icon,
  ariaLabel,
  className,
  staticIcon,
}: {
  id: string;
  triggerRef: React.RefObject<HTMLButtonElement>;
  open: boolean;
  disabled?: boolean;
  invalid?: boolean;
  onToggle: () => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
  placeholder: string;
  text: string | null;
  icon: IconName;
  ariaLabel?: string;
  className?: string;
  /** Calendar and clock glyphs should not flip when the popover opens. */
  staticIcon?: boolean;
}) {
  return (
    <button
      ref={triggerRef}
      id={id}
      type="button"
      role="combobox"
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-invalid={invalid || undefined}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onToggle}
      onKeyDown={onKeyDown}
      className={cx(
        'form-control',
        'picker-trigger',
        open && 'is-open',
        invalid && 'is-invalid',
        !text && 'is-placeholder',
        className,
      )}
    >
      <span className="picker-trigger__text">{text ?? placeholder}</span>
      <Icon
        name={icon}
        size={15}
        className={cx('picker-trigger__icon', staticIcon && 'picker-trigger__icon--static')}
      />
    </button>
  );
}

/* ------------------------------------------------------------------ select */

export interface SelectOption {
  value: string;
  label: string;
  hint?: string;
  disabled?: boolean;
}

export interface SelectProps {
  label?: string;
  error?: string | null;
  hint?: string;
  optional?: boolean;
  options: SelectOption[];
  placeholder?: string;
  value?: string;
  name?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
  /** Shown above the option list once the list gets long enough to scroll. */
  searchable?: boolean;
  'aria-label'?: string;
  onChange?: (event: FieldChangeEvent) => void;
}

/** A listbox that obeys the design tokens, in place of the OS <select> popup. */
export function Select({
  label,
  error,
  hint,
  optional,
  options,
  placeholder,
  value,
  name,
  id,
  disabled,
  className,
  searchable,
  onChange,
  ...rest
}: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const { open, setOpen, triggerRef, menuRef, geometry } = usePopover(260);
  const [active, setActive] = useState(0);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const typeahead = useRef({ text: '', at: 0 });

  // A placeholder means "empty is a legal choice" (every filter dropdown), so
  // it becomes a real clearing row. Without one the list is the options alone.
  const allOptions = useMemo<SelectOption[]>(
    () => (placeholder ? [{ value: '', label: placeholder }, ...options] : options),
    [options, placeholder],
  );

  // Search is only worth showing on genuinely long lists (timezones, drivers).
  const withSearch = searchable ?? options.length > 9;
  const visible = useMemo(() => {
    if (!withSearch || !query.trim()) return allOptions;
    const needle = query.trim().toLowerCase();
    return allOptions.filter((option) => option.value === '' || option.label.toLowerCase().includes(needle));
  }, [allOptions, query, withSearch]);

  const selected = options.find((option) => option.value === value) ?? null;

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    const index = visible.findIndex((option) => option.value === (value ?? ''));
    setActive(index < 0 ? 0 : index);
    if (withSearch) window.setTimeout(() => searchRef.current?.focus(), 0);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the highlighted row inside the scroll viewport.
  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector('.picker-option.is-active')?.scrollIntoView({ block: 'nearest' });
  }, [active, open, menuRef]);

  const commit = (option: SelectOption) => {
    if (option.disabled) return;
    setOpen(false);
    triggerRef.current?.focus();
    if (option.value !== (value ?? '')) onChange?.(changeEvent(option.value, name));
  };

  const move = (delta: number) => {
    setActive((current) => {
      const count = visible.length;
      if (count === 0) return 0;
      let next = current;
      for (let step = 0; step < count; step += 1) {
        next = (next + delta + count) % count;
        if (!visible[next]?.disabled) return next;
      }
      return current;
    });
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!open) {
      if (
        event.key === 'ArrowDown' ||
        event.key === 'ArrowUp' ||
        event.key === 'Enter' ||
        event.key === ' '
      ) {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        move(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        move(-1);
        break;
      case 'Home':
        event.preventDefault();
        setActive(0);
        break;
      case 'End':
        event.preventDefault();
        setActive(visible.length - 1);
        break;
      case 'Enter':
      case ' ': {
        const option = visible[active];
        if (option) {
          event.preventDefault();
          commit(option);
        }
        break;
      }
      case 'Escape':
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        break;
      case 'Tab':
        setOpen(false);
        break;
      default: {
        // Type-ahead, but only when there is no search box to type into.
        if (withSearch || event.key.length !== 1) break;
        const now = Date.now();
        typeahead.current.text =
          now - typeahead.current.at > 700 ? event.key : typeahead.current.text + event.key;
        typeahead.current.at = now;
        const needle = typeahead.current.text.toLowerCase();
        const index = visible.findIndex(
          (option) => !option.disabled && option.label.toLowerCase().startsWith(needle),
        );
        if (index >= 0) setActive(index);
        break;
      }
    }
  };

  const control = (
    <div className={cx('picker', className)}>
      <Trigger
        id={selectId}
        triggerRef={triggerRef}
        open={open}
        disabled={disabled}
        invalid={Boolean(error)}
        onToggle={() => setOpen((current) => !current)}
        onKeyDown={onKeyDown}
        placeholder={placeholder ?? 'Select…'}
        text={selected?.label ?? null}
        icon="chevronDown"
        ariaLabel={rest['aria-label'] ?? (label ? undefined : placeholder)}
      />
      {name ? <input type="hidden" name={name} value={value ?? ''} /> : null}
      {open ? (
        <Popover geometry={geometry} menuRef={menuRef} role="listbox" labelledBy={selectId}>
          {withSearch ? (
            <div className="picker-pop__search">
              <Icon name="search" size={14} />
              <input
                ref={searchRef}
                value={query}
                placeholder="Type to filter"
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActive(0);
                }}
                onKeyDown={onKeyDown}
                aria-label="Filter options"
              />
            </div>
          ) : null}
          <div className="picker-pop__list">
            {visible.length === 0 ? (
              <div className="picker-pop__empty">No match</div>
            ) : (
              visible.map((option, index) => {
                const isSelected = option.value === (value ?? '');
                return (
                  <button
                    key={option.value || `__placeholder-${index}`}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={option.disabled}
                    className={cx(
                      'picker-option',
                      index === active && 'is-active',
                      isSelected && 'is-selected',
                      option.value === '' && 'picker-option--muted',
                    )}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => commit(option)}
                  >
                    <span className="picker-option__label">
                      {option.label}
                      {option.hint ? <span className="picker-option__hint">{option.hint}</span> : null}
                    </span>
                    {isSelected ? <Icon name="check" size={15} /> : null}
                  </button>
                );
              })
            )}
          </div>
        </Popover>
      ) : null}
    </div>
  );

  if (!label) return control;
  return (
    <Field label={label} htmlFor={selectId} error={error} hint={hint} optional={optional}>
      {control}
    </Field>
  );
}

/* -------------------------------------------------------------- date field */

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** `Date` → `YYYY-MM-DD`, in local time (never `toISOString`, which is UTC). */
export function dateToInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** `YYYY-MM-DD` → local `Date` at midnight, or null when unparseable. */
export function inputToDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateLabel(value: string): string | null {
  const date = inputToDate(value);
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  const base = `${pad(date.getDate())} ${MONTHS[date.getMonth()]!.slice(0, 3)} ${date.getFullYear()}`;
  if (days === 0) return `Today · ${base}`;
  if (days === 1) return `Tomorrow · ${base}`;
  if (days === -1) return `Yesterday · ${base}`;
  return base;
}

/** Monday-first grid of the 6 weeks covering `month`. */
function monthGrid(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7; // shift Sunday=0 to Monday=0
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - offset);
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

export interface DateFieldProps {
  label?: string;
  error?: string | null;
  hint?: string;
  optional?: boolean;
  /** `YYYY-MM-DD`. */
  value?: string;
  min?: string;
  max?: string;
  name?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  /** Adds a "Clear" action to the footer. Defaults to true for filter fields. */
  clearable?: boolean;
  'aria-label'?: string;
  onChange?: (event: FieldChangeEvent) => void;
}

/** Calendar popover in the platform palette, in place of the OS date picker. */
export function DateField({
  label,
  error,
  hint,
  optional,
  value = '',
  min,
  max,
  name,
  id,
  disabled,
  className,
  placeholder = 'Pick a date',
  clearable = true,
  onChange,
  ...rest
}: DateFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const { open, setOpen, triggerRef, menuRef, geometry } = usePopover(340);

  const selected = inputToDate(value);
  const minDate = inputToDate(min);
  const maxDate = inputToDate(max);
  const [month, setMonth] = useState<Date>(() => selected ?? new Date());

  useEffect(() => {
    if (open) setMonth(selected ?? new Date());
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const outOfRange = (day: Date) =>
    (minDate !== null && day < minDate) || (maxDate !== null && day > maxDate);

  const commit = (day: Date) => {
    if (outOfRange(day)) return;
    setOpen(false);
    triggerRef.current?.focus();
    onChange?.(changeEvent(dateToInput(day), name));
  };

  const shiftMonth = (delta: number) =>
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));

  const days = monthGrid(month);

  const control = (
    <div className={cx('picker', className)}>
      <Trigger
        id={fieldId}
        triggerRef={triggerRef}
        open={open}
        disabled={disabled}
        invalid={Boolean(error)}
        onToggle={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) {
            event.preventDefault();
            setOpen(false);
          } else if (!open && (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        placeholder={placeholder}
        text={formatDateLabel(value)}
        icon="calendar"
        staticIcon
        ariaLabel={rest['aria-label'] ?? (label ? undefined : placeholder)}
      />
      {name ? <input type="hidden" name={name} value={value} /> : null}
      {open ? (
        <Popover geometry={geometry} menuRef={menuRef} minWidth={288} className="picker-pop--calendar">
          <div className="calendar__head">
            <button
              type="button"
              className="calendar__nav"
              aria-label="Previous month"
              onClick={() => shiftMonth(-1)}
            >
              <Icon name="chevronLeft" size={16} />
            </button>
            <span className="calendar__title" aria-live="polite">
              {MONTHS[month.getMonth()]} {month.getFullYear()}
            </span>
            <button
              type="button"
              className="calendar__nav"
              aria-label="Next month"
              onClick={() => shiftMonth(1)}
            >
              <Icon name="chevronRight" size={16} />
            </button>
          </div>

          <div className="calendar__weekdays" aria-hidden="true">
            {WEEKDAYS.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className="calendar__grid" role="grid">
            {days.map((day) => {
              const iso = dateToInput(day);
              const inMonth = day.getMonth() === month.getMonth();
              const disabledDay = outOfRange(day);
              return (
                <button
                  key={iso}
                  type="button"
                  role="gridcell"
                  disabled={disabledDay}
                  aria-selected={iso === value}
                  aria-label={`${day.getDate()} ${MONTHS[day.getMonth()]} ${day.getFullYear()}`}
                  className={cx(
                    'calendar__day',
                    !inMonth && 'is-outside',
                    iso === value && 'is-selected',
                    day.getTime() === today.getTime() && 'is-today',
                  )}
                  onClick={() => commit(day)}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          <div className="picker-pop__foot">
            <button
              type="button"
              className="picker-pop__action"
              disabled={outOfRange(today)}
              onClick={() => commit(today)}
            >
              Today
            </button>
            {/* Only forward-looking fields (a departure, not a report range)
                have any use for a one-tap tomorrow. */}
            {minDate !== null && minDate >= today ? (
              <button
                type="button"
                className="picker-pop__action"
                disabled={outOfRange(new Date(today.getTime() + 86_400_000))}
                onClick={() => commit(new Date(today.getTime() + 86_400_000))}
              >
                Tomorrow
              </button>
            ) : null}
            {clearable && value ? (
              <button
                type="button"
                className="picker-pop__action picker-pop__action--muted"
                onClick={() => {
                  setOpen(false);
                  onChange?.(changeEvent('', name));
                }}
              >
                Clear
              </button>
            ) : null}
          </div>
        </Popover>
      ) : null}
    </div>
  );

  if (!label) return control;
  return (
    <Field label={label} htmlFor={fieldId} error={error} hint={hint} optional={optional}>
      {control}
    </Field>
  );
}

/* -------------------------------------------------------------- time field */

/** `Date` → `HH:MM`, local. */
export function timeToInput(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** `HH:MM` → minutes since midnight, or null when unparseable. */
export function timeToMinutes(value: string | undefined | null): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function formatTimeLabel(value: string): string | null {
  const minutes = timeToMinutes(value);
  if (minutes === null) return null;
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

export interface TimeFieldProps {
  label?: string;
  error?: string | null;
  hint?: string;
  optional?: boolean;
  /** `HH:MM`. */
  value?: string;
  /** `HH:MM` — earlier times are shown but not selectable. */
  min?: string;
  max?: string;
  name?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  /** Minute granularity offered in the right-hand column. */
  step?: number;
  clearable?: boolean;
  'aria-label'?: string;
  onChange?: (event: FieldChangeEvent) => void;
}

/** Hour/minute columns in the platform palette, in place of the OS time picker. */
export function TimeField({
  label,
  error,
  hint,
  optional,
  value = '',
  min,
  max,
  name,
  id,
  disabled,
  className,
  placeholder = 'Pick a time',
  step = 5,
  clearable = true,
  onChange,
  ...rest
}: TimeFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const { open, setOpen, triggerRef, menuRef, geometry } = usePopover(300);

  const current = timeToMinutes(value);
  const minMinutes = timeToMinutes(min);
  const maxMinutes = timeToMinutes(max);

  const hour = current === null ? null : Math.floor(current / 60);
  const minute = current === null ? null : current % 60;

  const hours = useMemo(() => Array.from({ length: 24 }, (_, index) => index), []);
  const minutes = useMemo(
    () => Array.from({ length: Math.ceil(60 / step) }, (_, index) => index * step),
    [step],
  );

  const allowed = (total: number) =>
    (minMinutes === null || total >= minMinutes) && (maxMinutes === null || total <= maxMinutes);

  /** An hour is selectable when at least one of its offered minutes is. */
  const hourAllowed = (value_: number) => minutes.some((m) => allowed(value_ * 60 + m));

  const emit = (total: number) =>
    onChange?.(changeEvent(`${pad(Math.floor(total / 60))}:${pad(total % 60)}`, name));

  const pickHour = (next: number) => {
    // Keep the chosen minute where possible, otherwise snap to the first legal one.
    const keep = minute ?? 0;
    const snapped = minutes.reduce(
      (best, m) => (Math.abs(m - keep) < Math.abs(best - keep) ? m : best),
      minutes[0]!,
    );
    const candidate = next * 60 + snapped;
    if (allowed(candidate)) return emit(candidate);
    const fallback = minutes.find((m) => allowed(next * 60 + m));
    if (fallback !== undefined) emit(next * 60 + fallback);
  };

  const pickMinute = (next: number) => {
    const total = (hour ?? new Date().getHours()) * 60 + next;
    if (allowed(total)) emit(total);
  };

  // Scroll the selected hour/minute into view whenever the popover opens.
  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      menuRef.current
        ?.querySelectorAll('.timegrid__option.is-selected')
        .forEach((node) => node.scrollIntoView({ block: 'center' }));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, menuRef]);

  const control = (
    <div className={cx('picker', className)}>
      <Trigger
        id={fieldId}
        triggerRef={triggerRef}
        open={open}
        disabled={disabled}
        invalid={Boolean(error)}
        onToggle={() => setOpen((value_) => !value_)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) {
            event.preventDefault();
            setOpen(false);
          } else if (!open && (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        placeholder={placeholder}
        text={formatTimeLabel(value)}
        icon="clock"
        staticIcon
        ariaLabel={rest['aria-label'] ?? (label ? undefined : placeholder)}
      />
      {name ? <input type="hidden" name={name} value={value} /> : null}
      {open ? (
        <Popover geometry={geometry} menuRef={menuRef} minWidth={228} className="picker-pop--time">
          <div className="timegrid">
            <div className="timegrid__column" role="listbox" aria-label="Hour">
              <div className="timegrid__caption">Hour</div>
              <div className="timegrid__scroll">
                {hours.map((value_) => (
                  <button
                    key={value_}
                    type="button"
                    role="option"
                    aria-selected={value_ === hour}
                    disabled={!hourAllowed(value_)}
                    className={cx('timegrid__option', value_ === hour && 'is-selected')}
                    onClick={() => pickHour(value_)}
                  >
                    {pad(value_)}
                  </button>
                ))}
              </div>
            </div>
            <div className="timegrid__column" role="listbox" aria-label="Minute">
              <div className="timegrid__caption">Minute</div>
              <div className="timegrid__scroll">
                {minutes.map((value_) => (
                  <button
                    key={value_}
                    type="button"
                    role="option"
                    aria-selected={value_ === minute}
                    disabled={!allowed((hour ?? new Date().getHours()) * 60 + value_)}
                    className={cx('timegrid__option', value_ === minute && 'is-selected')}
                    onClick={() => pickMinute(value_)}
                  >
                    {pad(value_)}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="picker-pop__foot">
            <button
              type="button"
              className="picker-pop__action"
              onClick={() => {
                const now = new Date();
                const total = now.getHours() * 60 + Math.ceil(now.getMinutes() / step) * step;
                const clamped = Math.min(total, 23 * 60 + 59);
                if (allowed(clamped)) {
                  emit(clamped);
                  setOpen(false);
                }
              }}
            >
              Now
            </button>
            <button type="button" className="picker-pop__action" onClick={() => setOpen(false)}>
              Done
            </button>
            {clearable && value ? (
              <button
                type="button"
                className="picker-pop__action picker-pop__action--muted"
                onClick={() => {
                  setOpen(false);
                  onChange?.(changeEvent('', name));
                }}
              >
                Clear
              </button>
            ) : null}
          </div>
        </Popover>
      ) : null}
    </div>
  );

  if (!label) return control;
  return (
    <Field label={label} htmlFor={fieldId} error={error} hint={hint} optional={optional}>
      {control}
    </Field>
  );
}
