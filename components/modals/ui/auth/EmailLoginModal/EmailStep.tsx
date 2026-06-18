import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmailIcon } from "@/components/icons";

interface EmailStepProps {
  email: string;
  setEmail: (email: string) => void;
  isLoading: boolean;
  onSubmit: () => void;
  errorMessage?: string;
}

const EmailStep = ({
  email,
  setEmail,
  isLoading,
  onSubmit,
  errorMessage,
}: EmailStepProps) => {
  return (
    <div className="space-y-6 lg:w-[350px]">
      <h1 className="font-semibold text-lg text-white text-center">
        Login or Sign up
      </h1>

      <div className="mt-6 group/input-group relative flex gap-0 w-full items-center border-b border-white lg:hover:border-primary focus-within:border-primary transition-colors duration-200 h-10">
        <EmailIcon stroke="white" className="w-4 h-4 mr-2" />

        <Input
          type="email"
          placeholder="your@email.com"
          className="
              flex-1
              !border-none
              !bg-transparent
              text-white
              placeholder:text-[#A9A9A9]
              !shadow-none
              !ring-0
              !ring-offset-0
              focus:!ring-0
              focus:!ring-offset-0
              focus-visible:!ring-0
              focus-visible:!outline-none
              focus:!outline-none
              focus:!border-none
              !p-0
            "
          value={email}
          onChange={e => setEmail(e.target.value)}
          disabled={isLoading}
          autoFocus
        />
      </div>

      {errorMessage ? (
        <p className="text-xs text-red-400 mt-1">{errorMessage}</p>
      ) : null}

      <div className="flex justify-center mt-6">
        <Button
          size="lg"
          className="font-semibold text-xs text-[#1F1F1F] rounded-[25px] transition-all duration-200"
          onClick={onSubmit}
          disabled={isLoading || !email}
          type="button"
        >
          {isLoading ? "Sending..." : "Submit"}
        </Button>
      </div>
    </div>
  );
};

export default EmailStep;
