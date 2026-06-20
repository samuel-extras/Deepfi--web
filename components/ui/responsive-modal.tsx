"use client";

/**
 * Responsive modal — a Dialog on desktop, a Drawer on mobile. Hand-authored
 * (composes the existing shadcn Dialog + Drawer + useMediaQuery) so the same
 * markup renders the right primitive per viewport.
 */
import * as React from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

const DESKTOP_MQ = "(min-width: 768px)";
const ModalCtx = React.createContext(true);
const useIsDesktopModal = () => React.useContext(ModalCtx);

function ResponsiveModal(props: React.ComponentProps<typeof Dialog>) {
  const isDesktop = useMediaQuery(DESKTOP_MQ);
  const Root = isDesktop ? Dialog : Drawer;
  return (
    <ModalCtx.Provider value={isDesktop}>
      <Root {...props} />
    </ModalCtx.Provider>
  );
}

function ResponsiveModalTrigger(props: React.ComponentProps<typeof DialogTrigger>) {
  const C = useIsDesktopModal() ? DialogTrigger : DrawerTrigger;
  return <C {...props} />;
}

function ResponsiveModalClose(props: React.ComponentProps<typeof DialogClose>) {
  const C = useIsDesktopModal() ? DialogClose : DrawerClose;
  return <C {...props} />;
}

function ResponsiveModalContent({
  showCloseButton,
  ...props
}: React.ComponentProps<typeof DialogContent>) {
  if (useIsDesktopModal())
    return <DialogContent showCloseButton={showCloseButton} {...props} />;
  return <DrawerContent {...props} />;
}

function ResponsiveModalHeader(props: React.ComponentProps<"div">) {
  const C = useIsDesktopModal() ? DialogHeader : DrawerHeader;
  return <C {...props} />;
}

function ResponsiveModalTitle(props: React.ComponentProps<typeof DialogTitle>) {
  const C = useIsDesktopModal() ? DialogTitle : DrawerTitle;
  return <C {...props} />;
}

function ResponsiveModalDescription(
  props: React.ComponentProps<typeof DialogDescription>,
) {
  const C = useIsDesktopModal() ? DialogDescription : DrawerDescription;
  return <C {...props} />;
}

function ResponsiveModalFooter(props: React.ComponentProps<"div">) {
  const C = useIsDesktopModal() ? DialogFooter : DrawerFooter;
  return <C {...props} />;
}

export {
  ResponsiveModal,
  ResponsiveModalTrigger,
  ResponsiveModalClose,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
};
