import React, { useState } from 'react';
import type { RequestedScope, UserConsentState } from '@praman-network/sdk';

interface ConsentModalProps {
  requestedScopes: RequestedScope[];
  onAuthorize: (consentState: UserConsentState) => void;
  onCancel: () => void;
}

export const ConsentModal: React.FC<ConsentModalProps> = ({
  requestedScopes,
  onAuthorize,
  onCancel,
}) => {
  const [consentState, setConsentState] = useState<UserConsentState>(() => {
    const initialState: UserConsentState = {};
    requestedScopes.forEach((scope) => {
      initialState[scope.field] = true;
    });
    return initialState;
  });

  const handleToggle = (field: string) => {
    setConsentState((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const handleAuthorize = () => {
    const finalConsentState = { ...consentState };
    requestedScopes.forEach((scope) => {
      if (scope.required) {
        finalConsentState[scope.field] = true;
      }
    });
    onAuthorize(finalConsentState);
  };

  const formatFieldLabel = (field: string) => {
    return field
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md">
      <div className="w-full max-w-md p-6 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl font-sans text-zinc-100">
        
        <div className="mb-6 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 mb-4 bg-cyan-500/10 rounded-full border border-cyan-500/30">
            <svg className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Authorize Request</h2>
          <p className="mt-2 text-sm text-zinc-400">
            A third-party application is requesting access to your data. Select what you wish to share.
          </p>
        </div>

        <div className="space-y-3 mb-8">
          {requestedScopes.map((scope) => (
            <div
              key={scope.field}
              className={`flex items-start p-4 rounded-xl border transition-all ${
                scope.required
                  ? 'bg-zinc-800/50 border-zinc-700'
                  : 'bg-zinc-800 border-zinc-700 hover:border-cyan-500/50 cursor-pointer'
              }`}
              onClick={() => !scope.required && handleToggle(scope.field)}
            >
              <div className="flex items-center h-5 mt-0.5">
                <input
                  type="checkbox"
                  checked={consentState[scope.field]}
                  disabled={scope.required}
                  onChange={() => !scope.required && handleToggle(scope.field)}
                  className={`w-5 h-5 rounded border-zinc-600 focus:ring-cyan-500 focus:ring-offset-zinc-900 ${
                    scope.required
                      ? 'text-cyan-600/50 cursor-not-allowed bg-zinc-700 opacity-70'
                      : 'text-cyan-500 cursor-pointer bg-zinc-900'
                  }`}
                />
              </div>
              <div className="ml-3 flex-1">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-white cursor-pointer select-none">
                    {formatFieldLabel(scope.field)}
                  </label>
                  {scope.required && (
                    <span className="px-2 py-0.5 text-[10px] font-semibold text-cyan-300 bg-cyan-500/20 rounded-full border border-cyan-500/30 tracking-wide uppercase">
                      Required
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-400 mt-1">
                  {scope.description || (scope.required ? 'Strictly required by the application to function.' : 'Optional data for enhanced experience.')}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-3 mt-6">
          <button
            onClick={onCancel}
            className="w-full sm:w-1/2 px-4 py-3 text-sm font-semibold text-zinc-300 bg-transparent border border-zinc-700 rounded-xl hover:bg-zinc-800 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-600 focus:ring-offset-2 focus:ring-offset-zinc-900"
          >
            Cancel
          </button>
          <button
            onClick={handleAuthorize}
            className="w-full sm:w-1/2 px-4 py-3 text-sm font-semibold text-white bg-cyan-600 rounded-xl hover:bg-cyan-500 transition-colors shadow-[0_0_20px_rgba(147,51,234,0.25)] hover:shadow-[0_0_25px_rgba(147,51,234,0.4)] focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-zinc-900"
          >
            Authorize
          </button>
        </div>
      </div>
    </div>
  );
};
