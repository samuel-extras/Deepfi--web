export interface ConfirmActionModalInputProps {
  header: string;
  subheader?: string;
  buttonText: string;
  onConfirm: () => Promise<void> | void;
}

export type OnboardingModalInputProps = Record<string, never>;

export interface ModalRegistry {
  confirmAction: ConfirmActionModalInputProps;
  onboarding: OnboardingModalInputProps;
}

export type ModalId = keyof ModalRegistry;

export type ModalRenderProps<T extends ModalId> = ModalRegistry[T] & {
  onClose: () => void;
};

export type ActiveModalState = {
  id: ModalId;
  props: ModalRegistry[ModalId];
} | null;
