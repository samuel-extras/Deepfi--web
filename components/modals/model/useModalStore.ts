"use client";

import { create } from "zustand";
import type { ActiveModalState, ModalId, ModalRegistry } from "./types";

interface ModalState {
  activeModal: ActiveModalState;
}

interface ModalActions {
  openModal: <T extends ModalId>(id: T, props: ModalRegistry[T]) => void;
  closeModal: () => void;
}

export const useModalStore = create<ModalState & ModalActions>((set) => ({
  activeModal: null,
  openModal: <T extends ModalId>(id: T, props: ModalRegistry[T]) =>
    set({ activeModal: { id, props } }),
  closeModal: () => set({ activeModal: null }),
}));
