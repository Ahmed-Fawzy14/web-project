import { Children, cloneElement, useCallback, useEffect, useId, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronLeft, FlaskConical, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { initials } from '../domain/format';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Runs a mock API command with a loading state, an error, and duplicate-click protection. */
export function useCommand(command, { delay = 350 } = {}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const locked = useRef(false);

  const run = useCallback(async (...args) => {
    if (locked.current) return { ok: false, duplicate: true };
    locked.current = true;
    setPending(true);
    setError(null);
    await wait(delay);
    const result = command(...args);
    locked.current = false;
    setPending(false);
    if (!result.ok) setError(result.error);
    return result;
  }, [command, delay]);

  return { run, pending, error, setError };
}

export function AsyncButton({ pending, children, variant = 'primary', className = '', type = 'button', disabled, ...props }) {
  return (
    <button type={type} className={`btn btn-${variant} ${className}`} disabled={pending || disabled} {...props}>
      {pending && <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function ErrorAlert({ children }) {
  if (!children) return null;
  return (
    <div className="alert alert-danger d-flex gap-2 align-items-start mb-0" role="alert">
      <AlertCircle size={18} className="flex-shrink-0 mt-1" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

export function SuccessAlert({ children }) {
  if (!children) return null;
  return (
    <div className="alert alert-success d-flex gap-2 align-items-start mb-0" role="status">
      <CheckCircle2 size={18} className="flex-shrink-0 mt-1" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

export function SimulatedBadge({ children = 'Simulated' }) {
  return (
    <span className="badge sim-badge">
      <FlaskConical size={12} aria-hidden="true" /> {children}
    </span>
  );
}

export function StatusBadge({ tone = 'secondary', children }) {
  return <span className={`badge rounded-pill text-bg-${tone}`}>{children}</span>;
}

export function Avatar({ name, large }) {
  return <span className={`avatar ${large ? 'avatar-lg' : ''}`} aria-hidden="true">{initials(name)}</span>;
}

export function PageHeader({ title, subtitle, backTo, backLabel = 'Back', actions }) {
  return (
    <header className="mb-4">
      {backTo && (
        <Link to={backTo} className="back-link">
          <ChevronLeft size={16} aria-hidden="true" /> {backLabel}
        </Link>
      )}
      <div className="d-flex flex-wrap justify-content-between align-items-end gap-2">
        <div>
          <h1 className="h3 mb-1">{title}</h1>
          {subtitle && <p className="text-body-secondary mb-0">{subtitle}</p>}
        </div>
        {actions}
      </div>
    </header>
  );
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="card text-center p-4 p-md-5">
      {Icon && <Icon size={32} className="mx-auto mb-2 text-gold" aria-hidden="true" />}
      <h2 className="h5">{title}</h2>
      {children && <p className="text-body-secondary mb-0">{children}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function LoadingBlock({ label = 'Loading' }) {
  return (
    <div className="text-center py-5" role="status">
      <div className="spinner-border text-primary" aria-hidden="true" />
      <p className="text-body-secondary mt-2 mb-0">{label}…</p>
    </div>
  );
}

/** Label, error and hint wired to a single form control passed as the child. */
export function Field({ label, error, hint, children, className = 'mb-3' }) {
  const id = useId();
  const child = Children.only(children);
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="form-label fw-semibold">{label}</label>
      {cloneElement(child, {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
        className: `${child.props.className ?? 'form-control'} ${error ? 'is-invalid' : ''}`,
      })}
      {hint && <div id={`${id}-hint`} className="form-text">{hint}</div>}
      {error && <div id={`${id}-error`} className="invalid-feedback d-block">{error}</div>}
    </div>
  );
}

export function Modal({ title, open, onClose, children, footer, size = '' }) {
  const ref = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} className={`app-dialog ${size}`} aria-labelledby={titleId} onClose={onClose}>
      {open && (
        <div className="modal-content">
          <div className="modal-header">
            <h2 className="modal-title h5" id={titleId}>{title}</h2>
            <button type="button" className="btn btn-sm btn-light ms-auto" aria-label="Close" onClick={onClose}>
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <div className="modal-body">{children}</div>
          {footer && <div className="modal-footer">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

export function Stat({ label, value, hint }) {
  return (
    <div className="card h-100 p-3">
      <div className="small text-body-secondary fw-semibold">{label}</div>
      <div className="h4 mb-0 text-primary">{value}</div>
      {hint && <div className="small text-body-secondary">{hint}</div>}
    </div>
  );
}

export function RadioCards({ legend, name, value, options, onChange }) {
  return (
    <fieldset className="mb-3">
      <legend className="form-label fw-semibold fs-6">{legend}</legend>
      <div className="d-flex flex-wrap gap-2">
        {options.map((option) => (
          <div key={option.value} className="flex-fill">
            <input
              type="radio"
              className="btn-check"
              id={`${name}-${option.value}`}
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <label className="btn btn-outline-primary w-100" htmlFor={`${name}-${option.value}`}>{option.label}</label>
          </div>
        ))}
      </div>
    </fieldset>
  );
}
