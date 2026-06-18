"use client";

import { Suspense, lazy, type ComponentType, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useModalStore } from "../model/useModalStore";
import type { ModalId } from "../model/types";
import ModalBase from "./ModalBase";
import {
  ModalBaseControllerProvider,
  useModalBaseController,
} from "./ModalBaseController";

type ModalComponentModule = {
  default: ComponentType<ModalComponentProps>;
};

type ModalComponentProps = Record<string, unknown> & {
  onClose: () => void;
};

type ModalConfig = {
  load: () => Promise<unknown>;
  useModalBase?: boolean;
};

function resolveModalComponent(
  loaded: unknown
): ComponentType<ModalComponentProps> {
  if (typeof loaded === "function") {
    return loaded as ComponentType<ModalComponentProps>;
  }

  if (
    loaded &&
    typeof loaded === "object" &&
    "default" in loaded &&
    typeof (loaded as { default?: unknown }).default === "function"
  ) {
    return (loaded as ModalComponentModule).default;
  }

  throw new Error("Modal loader did not return a valid component");
}

const lazyModalCache = new Map<ModalId, ComponentType<ModalComponentProps>>();

function getLazyModalComponent(
  id: ModalId
): ComponentType<ModalComponentProps> {
  const cached = lazyModalCache.get(id);
  if (cached) return cached;

  const lazyComponent = lazy(async () => {
    const loaded = await MODAL_CONFIG[id].load();
    const resolvedComponent = resolveModalComponent(loaded);
    return { default: resolvedComponent };
  });

  lazyModalCache.set(id, lazyComponent);
  return lazyComponent;
}

const MODAL_CONFIG: Record<ModalId, ModalConfig> = {
  connectAccount: { load: () => import("./auth/ConnectAccountModal") },
  emailLogin: { load: () => import("./auth/EmailLoginModal") },
  accountConfirmed: { load: () => import("./auth/AccountConfirmedModal") },
  termsAndConditions: { load: () => import("./auth/TermsAndConditionsModal") },
  confirmAction: { load: () => import("./ConfirmActionModal") },
  onboarding: {
    load: () =>
      import("./onboarding").then(mod => ({
        default: mod.OnboardingModal,
      })),
  },
} as const;

export function ModalRoot() {
  const { activeModal, closeModal } = useModalStore();
  const [mounted, setMounted] = useState(false);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
    const target = document.getElementById("modal-root");
    setPortalTarget(target);
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    if (activeModal) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [activeModal, closeModal]);

  if (!mounted || !portalTarget || !activeModal) return null;

  const { id, props } = activeModal;
  const modalConfig = MODAL_CONFIG[id];

  if (!modalConfig) {
    console.warn(`Modal "${id}" not found in configuration`);
    return null;
  }

  const { useModalBase = true } = modalConfig;

  function ModalWithController() {
    const { options, requestClose } = useModalBaseController();

    const LazyModalComponent = getLazyModalComponent(id);
    const element = (
      <Suspense fallback={null}>
        <LazyModalComponent
          {...((props as Record<string, unknown>) ?? {})}
          onClose={requestClose}
        />
      </Suspense>
    );

    if (!useModalBase) return element;
    return (
      <ModalBase
        show={!!activeModal}
        onClose={requestClose}
        closeOnBackdropClick={options.closeOnBackdropClick}
        showCloseButton={options.showCloseButton}
      >
        {element}
      </ModalBase>
    );
  }

  return createPortal(
    <ModalBaseControllerProvider onClose={closeModal}>
      <ModalWithController />
    </ModalBaseControllerProvider>,
    portalTarget
  );
}
