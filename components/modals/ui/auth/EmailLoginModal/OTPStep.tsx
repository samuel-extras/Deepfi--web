import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPSlot } from "@/components/ui/input-otp";
import { ArrowBackIcon } from "@/components/icons";

const OTPStep = ({
  email,
  otp,
  setOtp,
  onBackToEmail,
  onResendCode,
  onVerify,
  isLoading,
  errorMessage,
}: OTPStepProps) => {
  const handleOtpChange = (value: string) => {
    setOtp(value);
  };

  useEffect(() => {
    if (otp.length === 6 && onVerify) {
      onVerify();
    }
  }, [otp, onVerify]);

  return (
    <div className="space-y-6">
      <Button
        className="absolute top-5 left-5 flex justify-center items-center w-[35px] h-[35px] bg-transparent lg:hover:bg-[#1A1D1F]/20 border border-transparent lg:hover:border-border rounded-full"
        onClick={onBackToEmail}
      >
        <ArrowBackIcon stroke="white" className="w-4 h-4" />
      </Button>

      <div className="flex flex-col gap-4 justify-center items-center">
        <h1 className="font-semibold text-base text-white text-center">
          Enter confirmation code
        </h1>
        <div className="text-center">
          <p className="text-sm text-[#A9A9A9]">
            A confirmation code has been sent to
            <br />
            <span className="text-white font-medium">{email}</span> please enter
            your code
            <br />
            below.
          </p>
        </div>
      </div>

      <div className="flex justify-center mt-6">
        <OTPInput value={otp} onChange={handleOtpChange} maxLength={6} />
      </div>

      {errorMessage ? (
        <div className="flex justify-center">
          <p className="text-xs text-red-400">{errorMessage}</p>
        </div>
      ) : null}

      <div className="flex justify-center mt-4 items-center gap-1">
        <h1 className="font-normal text-xs text-[#A9A9A9]">
          Didn&apos;t get code?
        </h1>
        <Button
          size="sm"
          type="button"
          className="bg-transparent lg:hover:bg-transparent p-0 m-0"
          onClick={onResendCode}
          disabled={isLoading}
        >
          <span className="underline text-white font-normal text-xs">
            Resend
          </span>
        </Button>
      </div>
    </div>
  );
};

export default OTPStep;

interface OTPStepProps {
  email: string;
  otp: string;
  setOtp: (otp: string) => void;
  isLoading?: boolean;
  onVerify: () => void;
  onBackToEmail: () => void;
  onResendCode: () => void;
  errorMessage?: string;
}

const OTPInput = ({
  value,
  onChange,
  maxLength = 6,
}: {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
}) => {
  const slots = Array.from({ length: maxLength }, (_, index) => (
    <InputOTPSlot
      key={index}
      index={index}
      className="!w-12 !h-12 !bg-transparent !border !border-[#2D3134] !text-white !rounded-lg focus:!border-primary lg:hover:!border-primary !transition-colors !duration-200 !border-l !border-r !border-y"
    />
  ));

  return (
    <InputOTP maxLength={maxLength} value={value} onChange={onChange}>
      {slots}
    </InputOTP>
  );
};
