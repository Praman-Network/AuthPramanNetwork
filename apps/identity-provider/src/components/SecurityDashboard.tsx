import { useAccountLinking } from '../hooks/useAccountLinking';

interface SecurityDashboardProps {
  email: string;
  embeddedWalletAddress: string;
}

export function SecurityDashboard({ email, embeddedWalletAddress }: SecurityDashboardProps) {
  const { linkWallet, isLinking, error, linkedAddress } = useAccountLinking(embeddedWalletAddress);

  return (
    <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-6 shadow-xl max-w-md mx-auto relative overflow-hidden text-zinc-100">
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-blue-400">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.5a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 0012 21.75h1.5A2.25 2.25 0 0015.75 19.5V4.5A2.25 2.25 0 0013.5 2.25H12z" />
        </svg>
        Security Dashboard
      </h2>

      <div className="space-y-4 mb-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs text-zinc-400 uppercase tracking-wider font-bold mb-1">Primary Email</p>
          <p className="text-sm font-medium">{email}</p>
        </div>
        
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs text-zinc-400 uppercase tracking-wider font-bold mb-1">Embedded Wallet (SBT Holder)</p>
          <p className="text-sm font-mono truncate">{embeddedWalletAddress}</p>
        </div>

        {linkedAddress && (
          <div className="bg-green-950/20 border border-green-900/40 rounded-xl p-4">
            <p className="text-xs text-green-400 uppercase tracking-wider font-bold mb-1 flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Linked External Wallet
            </p>
            <p className="text-sm font-mono truncate text-green-300">{linkedAddress}</p>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 bg-red-950/30 border border-red-900/50 p-3 rounded-xl text-xs text-red-400 font-mono">
          ⚠ {error}
        </div>
      )}

      {!linkedAddress && (
        <button
          onClick={linkWallet}
          disabled={isLinking}
          className="w-full py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
        >
          {isLinking ? (
            <><div className="w-4 h-4 border-2 border-zinc-400 border-t-white rounded-full animate-spin" /> Verifying Biometrics...</>
          ) : (
            'Link External Web3 Wallet'
          )}
        </button>
      )}
    </div>
  );
}
