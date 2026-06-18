"use client";

import AuthLoadingAnimation from "../AuthLoadingAnimation";

interface LoadingConfirmationProps {
  isDone: boolean;
}

const LoadingConfirmation = ({ isDone }: LoadingConfirmationProps) => {
  return (
    <div className="space-y-6">
      <h1 className="font-semibold text-base text-white text-center">
        {isDone ? "Account Confirmed" : "Confirming..."}
      </h1>

      <div className="flex justify-center items-center mt-4">
        <AuthLoadingAnimation status={isDone ? "success" : "loading"} />
      </div>
    </div>
  );
};

export default LoadingConfirmation;
