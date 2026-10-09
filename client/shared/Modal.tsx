import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  /**
   * Heading shown in the modal header.
   */
  title: string;

  /**
   * Called when the backdrop, close button or Escape is used.
   */
  onClose: () => void;

  /**
   * Modal body.
   */
  children: ReactNode;
}

/**
 * Full-screen overlay dialog.
 *
 * @param {ModalProps} arg0 [!important, no description here]
 */
export default function Modal({ title, onClose, children }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const appRoot = document.getElementById("root");
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    const previousRootOverflow = document.documentElement.style.overflow;

    appRoot?.setAttribute("inert", "");
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    dialogRef.current?.focus();

    return () => {
      appRoot?.removeAttribute("inert");
      document.body.style.overflow = previousOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
      previousFocus?.focus();
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{title}</h2>

          <button type="button" className="modal-close" onClick={onClose}>
            Close
          </button>
        </div>

        {children}
      </div>
    </div>,
    document.body,
  );
}
