import { useEffect, useId, useRef, type ReactNode } from "react";

interface ConfirmDialogProps {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * The app's own confirmation sheet. Used instead of the system dialog so it keeps
 * the same look as the rest of Brasa. Cancel has the focus, so Enter never deletes by accident.
 */
export default function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel,
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="scrim" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <div className="glass confirm" role="alertdialog" aria-modal="true" aria-labelledby={titleId}>
        <span className={`confirm__orb${danger ? " confirm__orb--danger" : ""}`} aria-hidden="true" />
        <h2 id={titleId}>{title}</h2>
        <p>{body}</p>
        <div className="confirm__actions">
          <button ref={cancelRef} type="button" className="glass-button" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className={`glass-button glass-button--primary${danger ? " glass-button--danger" : ""}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
