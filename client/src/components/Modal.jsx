import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/** Dialog shell. When `onSubmit` is given, body and footer are wrapped in a <form>. */
export default function Modal({ open, title, subtitle, onClose, onSubmit, children, footer, size = '' }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const inner = (
    <>
      <div className="modal-body">{children}</div>
      {footer && <div className="modal-foot">{footer}</div>}
    </>
  );

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${size}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <div>
            <h3>{title}</h3>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {onSubmit ? (
          <form
            style={{ display: 'contents' }}
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit();
            }}
          >
            {inner}
          </form>
        ) : (
          inner
        )}
      </div>
    </div>,
    document.body
  );
}

export function FormModal({ submitText = 'Save', saving, onClose, ...props }) {
  return (
    <Modal
      {...props}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving && <span className="spinner" style={{ width: 14, height: 14, borderTopColor: 'currentColor' }} />}
            {submitText}
          </button>
        </>
      }
    />
  );
}
