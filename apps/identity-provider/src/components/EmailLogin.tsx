import { useLogin } from '@privy-io/react-auth';

interface EmailLoginProps {
  onSuccess: (email: string) => void;
  isProcessing: boolean;
}

export function EmailLogin({ onSuccess, isProcessing }: EmailLoginProps) {
  const { login } = useLogin({
    onComplete: ({ user }) => {
      // Find the email in the linked accounts
      const emailObj = user.linkedAccounts.find((account: any) => account.type === 'email');
      const email = emailObj && 'address' in emailObj ? emailObj.address : '';
      onSuccess(email);
    },
    onError: (error) => {
      console.error('Privy Login Error:', error);
    }
  });

  return (
    <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />
      
      <div className="mb-6">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-cyan-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.909A2.25 2.25 0 0 1 2.25 8.671" />
          </svg>
          Login with Email (Privy)
        </h3>
        <p className="text-xs text-zinc-400 mt-1">
          Securely login with email. A non-custodial embedded wallet will be generated for you automatically.
        </p>
      </div>

      <button
        onClick={login}
        disabled={isProcessing}
        className="w-full py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
      >
        {isProcessing ? (
          <><div className="w-4 h-4 border-2 border-zinc-400 border-t-white rounded-full animate-spin" /> Processing...</>
        ) : (
          'Login / Sign Up'
        )}
      </button>
    </div>
  );
}
