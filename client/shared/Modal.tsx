import { useEffect, type ReactNode } from "react";

interface ModalProps {
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
export default function Modal({ onClose, children }: ModalProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="modal-close" onClick={onClose}>
          Close
        </button>

        {children}
      </div>
    </div>
  );
}
