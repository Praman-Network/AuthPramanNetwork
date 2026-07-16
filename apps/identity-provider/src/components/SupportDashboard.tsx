import React, { useState } from 'react';

export function SupportDashboard() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    walletAddress: '',
    issueType: 'face_changed',
    description: ''
  });
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');
    setErrorMessage('');

    try {
      const apiUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/api/support`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      if (data.success) {
        setStatus('success');
      } else {
        throw new Error(data.error || 'Failed to submit support request');
      }
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err.message);
    }
  };

  if (status === 'success') {
    return (
      <div className="w-full max-w-lg mx-auto bg-zinc-900 border border-green-500/30 rounded-3xl p-8 text-center shadow-2xl">
        <div className="w-16 h-16 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/30">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-8 h-8">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Request Received</h2>
        <p className="text-zinc-400 text-sm mb-6">
          Our security team has received your ticket and will contact you at {formData.email} shortly. 
          If manual KYC is required, we will provide a secure link.
        </p>
        <button 
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-sm font-bold transition-all border border-zinc-700"
        >
          Return Home
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl text-left relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />
      
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white tracking-tight">Account Support</h2>
        <p className="text-xs text-zinc-400 mt-1">Submit a secure request to recover access or update biometric data.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Full Name</label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Email Address</label>
          <input
            type="email"
            required
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Wallet Address (If known)</label>
          <input
            type="text"
            value={formData.walletAddress}
            onChange={(e) => setFormData({...formData, walletAddress: e.target.value})}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors font-mono"
            placeholder="0x..."
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Issue Category</label>
          <select
            value={formData.issueType}
            onChange={(e) => setFormData({...formData, issueType: e.target.value})}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors appearance-none"
          >
            <option value="face_changed">Facial Features Changed (Accident/Surgery)</option>
            <option value="lost_wallet">Lost Access to Hardware Wallet</option>
            <option value="locked_out">Repeated Liveness Verification Failures</option>
            <option value="other">Other Security Issue</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Details</label>
          <textarea
            required
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors resize-none"
            placeholder="Please describe the issue..."
          />
        </div>

        {status === 'error' && (
          <div className="p-3 bg-red-950/30 border border-red-800/50 rounded-xl text-xs text-red-400">
            {errorMessage}
          </div>
        )}

        <button
          type="submit"
          disabled={status === 'submitting'}
          className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 active:scale-95 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {status === 'submitting' ? (
            <><div className="w-4 h-4 border-2 border-zinc-300 border-t-white rounded-full animate-spin"/> Submitting...</>
          ) : 'Submit Support Request'}
        </button>
      </form>
    </div>
  );
}
