import { useState, useCallback, useEffect } from 'react';
import { useWallets, usePrivy } from '@privy-io/react-auth';
import { ethers } from 'ethers';

export function useEmbeddedWallet() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [embeddedSigner, setEmbeddedSigner] = useState<ethers.Signer | null>(null);
  const [embeddedAddress, setEmbeddedAddress] = useState<string | null>(null);
  
  const { wallets } = useWallets();
  const { createWallet, authenticated, ready } = usePrivy();

  const generateWallet = useCallback(async () => {
    setIsGenerating(true);
    try {
      let privyWallet: any = wallets.find(w => w.walletClientType === 'privy');
      
      // If it's not generated automatically by Privy (e.g. no createOnLogin), create it explicitly
      if (!privyWallet) {
        privyWallet = (await createWallet()) as any;
      }

      if (!privyWallet) {
        throw new Error("Privy embedded wallet could not be created.");
      }

      // Extract EIP-1193 provider from Privy's embedded wallet
      const ethereumProvider = await privyWallet.getEthereumProvider();
      
      // Wrap it in Ethers v6 BrowserProvider
      const provider = new ethers.BrowserProvider(ethereumProvider);
      
      // Get the Signer which corresponds to the user's embedded wallet
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      
      setEmbeddedSigner(signer);
      setEmbeddedAddress(address);
      
      return signer;
    } catch (error) {
      console.error("Failed to retrieve embedded wallet:", error);
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, [wallets]);

  // Auto-sync the wallet if Privy finishes loading it in the background or user authenticates
  useEffect(() => {
    if (!ready) return; // Wait until Privy is fully initialized
    
    const privyWallet = wallets.find(w => w.walletClientType === 'privy');
    
    // Only auto-generate if they are authenticated AND don't have a wallet yet, or if the wallet exists
    if (authenticated && (privyWallet || authenticated) && !embeddedSigner && !isGenerating) {
      generateWallet();
    }
  }, [ready, wallets, authenticated, embeddedSigner, isGenerating, generateWallet]);

  const clearWallet = useCallback(() => {
    setEmbeddedSigner(null);
    setEmbeddedAddress(null);
    setIsGenerating(false);
  }, []);

  // Clear wallet automatically if unauthenticated
  useEffect(() => {
    if (ready && !authenticated) {
      clearWallet();
    }
  }, [ready, authenticated, clearWallet]);

  return {
    generateWallet, // Still exposes for manual trigger if needed
    isGenerating,
    embeddedWallet: embeddedSigner,
    embeddedAddress, // Exposing synchronous address for UI
    clearWallet
  };
}
