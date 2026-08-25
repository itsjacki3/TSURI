import { useEffect } from 'react';

/**
 * Presentational modal shell — mirrors the .modal-overlay / .modal-box
 * markup from assets/css/style.css. Each page owns its own form state and
 * passes it in as `children`; this component only handles open/close,
 * the Escape key, and clicking the dark overlay to dismiss.
 */
export default function Modal({ open, title, onClose, children }) {
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-overlay open"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-box">
        <div className="modal-head">
          <h3>{title}</h3>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
}
