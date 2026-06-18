"use client";

import { useEffect } from "react";
import { useModalBaseController } from "../ui/ModalBaseController";

type Controls = {
  closeOnBackdropClick?: boolean;
  showCloseButton?: boolean;
  beforeClose?: () => boolean | Promise<boolean>;
  afterClose?: () => void | Promise<void>;
};

export function useModalControls(
  controls: Controls,
  deps: React.DependencyList = []
) {
  const { setOptions, setCloseHooks } = useModalBaseController();

  useEffect(() => {
    setOptions({
      closeOnBackdropClick: controls.closeOnBackdropClick ?? true,
      showCloseButton: controls.showCloseButton ?? true,
    });
    setCloseHooks({
      beforeClose: controls.beforeClose,
      afterClose: controls.afterClose,
    });
    return () => {
      setOptions({ closeOnBackdropClick: true, showCloseButton: true });
      setCloseHooks({});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
