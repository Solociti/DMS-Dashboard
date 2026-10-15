import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface ModalEnvironment {
  appRoot: HTMLElement | null;
  rootWasInert: boolean;
  bodyOverflow: string;
  documentOverflow: string;
}

const modalStack: symbol[] = [];
let modalEnvironment: ModalEnvironment | null = null;

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
  const modalId = useRef(Symbol());

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;

    if (modalStack.length === 0) {
      const appRoot = document.getElementById("root");
      modalEnvironment = {
        appRoot,
        rootWasInert: appRoot?.hasAttribute("inert") ?? false,
        bodyOverflow: document.body.style.overflow,
        documentOverflow: document.documentElement.style.overflow,
      };

      appRoot?.setAttribute("inert", "");
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    }

    modalStack.push(modalId.current);
    dialogRef.current?.focus();

    return () => {
      const stackIndex = modalStack.indexOf(modalId.current);
      if (stackIndex !== -1) {
        modalStack.splice(stackIndex, 1);
      }

      if (modalStack.length === 0 && modalEnvironment) {
        const { appRoot, rootWasInert, bodyOverflow, documentOverflow } =
          modalEnvironment;
        if (!rootWasInert) {
          appRoot?.removeAttribute("inert");
        }
        document.body.style.overflow = bodyOverflow;
        document.documentElement.style.overflow = documentOverflow;
        modalEnvironment = null;
      }

      previousFocus?.focus();
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        modalStack[modalStack.length - 1] === modalId.current
      ) {
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
