export interface ConnectAccountModalInputProps {
  onConfirm: (value: string) => void;
}

export type EmailLoginModalInputProps = Record<string, never>;

export interface AccountConfirmedModalInputProps {
  accountType: "email" | "wallet";
  accountInfo: string;
  loading?: boolean; // OTP flow in progress
  isVerified?: boolean; // Whether the verification was already completed
}

export type TermsAndConditionsModalInputProps = Record<string, never>;

export interface ConfirmActionModalInputProps {
  header: string;
  subheader?: string;
  buttonText: string;
  onConfirm: () => Promise<void> | void;
}

export type OnboardingModalInputProps = Record<string, never>;

export interface ModalRegistry {
  connectAccount: ConnectAccountModalInputProps;
  emailLogin: EmailLoginModalInputProps;
  accountConfirmed: AccountConfirmedModalInputProps;
  termsAndConditions: TermsAndConditionsModalInputProps;
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
