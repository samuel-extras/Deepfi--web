"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

export type ModalBaseOptions = {
  closeOnBackdropClick?: boolean;
  showCloseButton?: boolean;
};

export type ModalCloseHooks = {
  beforeClose?: () => boolean | Promise<boolean>;
  afterClose?: () => void | Promise<void>;
};

type ModalBaseControllerValue = {
  options: ModalBaseOptions;
  setOptions: (opts: ModalBaseOptions) => void;
  setCloseHooks: (hooks: ModalCloseHooks) => void;
  requestClose: () => Promise<void>;
};

const ModalBaseControllerContext =
  createContext<ModalBaseControllerValue | null>(null);

export function useModalBaseController() {
  const ctx = useContext(ModalBaseControllerContext);
  if (!ctx) {
    throw new Error(
      "useModalBaseController must be used within ModalBaseControllerProvider"
    );
  }
  return ctx;
}

export function ModalBaseControllerProvider({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void | Promise<void>;
}) {
  const [options, setOptionsState] = useState<ModalBaseOptions>({
    closeOnBackdropClick: true,
    showCloseButton: true,
  });
  const [hooks, setHooks] = useState<ModalCloseHooks>({});

  const setOptions = useCallback((opts: ModalBaseOptions) => {
    setOptionsState((prev) => ({ ...prev, ...opts }));
  }, []);

  const setCloseHooks = useCallback((h: ModalCloseHooks) => {
    setHooks(h);
  }, []);

  const requestClose = useCallback(async () => {
    try {
      const proceed = hooks.beforeClose ? await hooks.beforeClose() : true;
      if (!proceed) return;
      await Promise.resolve(onClose());
      if (hooks.afterClose) await hooks.afterClose();
    } catch {
      // Swallow errors to avoid breaking UI when a hook fails
    }
  }, [hooks, onClose]);

  const value = useMemo(
    () => ({ options, setOptions, setCloseHooks, requestClose }),
    [options, setOptions, setCloseHooks, requestClose]
  );

  return (
    <ModalBaseControllerContext.Provider value={value}>
      {children}
    </ModalBaseControllerContext.Provider>
  );
}
