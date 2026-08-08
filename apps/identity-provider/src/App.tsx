import { OnboardingFlow } from './components/OnboardingFlow';
import { usePramanIdentity } from './hooks/usePramanIdentity';

function App() {
  const { isOriginAllowed } = usePramanIdentity();

  if (isOriginAllowed === null) {
    return (
      <div className="flex-1 bg-[#0b0c10] min-h-screen flex items-center justify-center text-zinc-100">
        <p className="text-zinc-500 text-sm">Verifying access...</p>
      </div>
    );
  }
  
  if (isOriginAllowed === false) {
    return (
      <div className="flex-1 bg-[#0b0c10] min-h-screen flex items-center justify-center text-zinc-100">
        <div className="text-center space-y-2 px-6">
          <h1 className="text-xl font-bold text-red-500">Access Denied</h1>
          <p className="text-zinc-400 text-sm">This origin is not authorized to use this API key.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#0b0c10] min-h-screen flex flex-col justify-between text-zinc-100 selection:bg-cyan-600/30 relative">
      {/* Noise background overlay */}
      <div className="absolute inset-0 bg-noise opacity-[0.035] pointer-events-none z-0" />
      {/* Header Navbar */}
      <header className="border-b border-zinc-900 bg-zinc-950/40 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Logo Icon */}
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center font-bold text-sm tracking-widest text-white shadow-md shadow-cyan-500/20">
              <img src='./PramanLogo.png' alt='Praman '/>
            </div>
            <span className="font-bold tracking-tight text-white">PramanAuth</span>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold text-zinc-400">
            <span className="bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-full text-cyan-400">
              praman network
            </span>
          </div>
        </div>
      </header>

      {/* Main onboarding container */}
      <main className="flex-1 flex items-center justify-center py-6">
        <OnboardingFlow />
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950/20 py-6 text-center text-xs text-zinc-600">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 PramanAuth Module. Decentralized & Secure Web3 SDK.</p>
          <div className="flex gap-4 font-mono text-[10px]">
            <span>face-api.js</span>
            <span>•</span>
            <span>Lit Protocol v3</span>
            <span>•</span>
            <span>Pinata IPFS</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
