import React, { useState } from 'react';

export function SupportDashboard() {
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('Identity Recovery / Lost Wallet');
  const [message, setMessage] = useState('');
  const [emailError, setEmailError] = useState('');

  const validateEmail = (email: string) => {
    return String(email)
      .toLowerCase()
      .match(
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|.(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
      );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address before submitting.');
      return;
    }
    setEmailError('');

    const bodyText = `User Email: ${email}\n\nMessage:\n${message}`;
    const mailto = `mailto:networkpraman@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
    window.location.href = mailto;
  };

  return (
    <div className="w-full max-w-md mx-auto bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
      
      <div className="flex items-center gap-3 mb-6">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            Support & Recovery
          </h3>
          <p className="text-xs text-zinc-400">
            Lost your hardware wallet or experienced facial changes?
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-xs font-semibold text-zinc-400 mb-1">Your Email Address</label>
          <input 
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailError) setEmailError('');
            }}
            placeholder="you@example.com"
            className={`w-full bg-zinc-900 border ${emailError ? 'border-red-500' : 'border-zinc-800'} rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-cyan-500`}
            required
          />
          {emailError && <p className="text-red-500 text-[10px] mt-1">{emailError}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-400 mb-1">Issue Type</label>
          <select 
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
          >
            <option>Identity Recovery / Lost Wallet</option>
            <option>Facial Alterations / Injury</option>
            <option>Account Linking Issue</option>
            <option>Other Technical Support</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-400 mb-1">Message</label>
          <textarea 
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Please describe your issue in detail. Include any relevant transaction hashes or registered email addresses..."
            rows={5}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-cyan-500 resize-none"
            required
          />
        </div>

        <button
          type="submit"
          className="w-full py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-white bg-zinc-800 hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2 mt-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.909A2.25 2.25 0 0 1 2.25 8.671" />
          </svg>
          Send Email to Support
        </button>
      </form>
    </div>
  );
}
