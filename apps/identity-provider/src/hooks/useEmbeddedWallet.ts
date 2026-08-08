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
      // First try to find a Privy embedded wallet
      let targetWallet: any = wallets.find(w => w.walletClientType === 'privy');
      
      // If no embedded wallet, just use the first connected wallet (e.g. MetaMask)
      if (!targetWallet && wallets.length > 0) {
         targetWallet = wallets[0];
      }

      // If it's not generated automatically by Privy (e.g. no createOnLogin), create it explicitly
      if (!targetWallet) {
        targetWallet = (await createWallet()) as any;
      }

      if (!targetWallet) {
        throw new Error("No wallet could be retrieved or created.");
      }

      // Extract EIP-1193 provider from the wallet
      const ethereumProvider = await targetWallet.getEthereumProvider();
      
      // Wrap it in Ethers v6 BrowserProvider
      const provider = new ethers.BrowserProvider(ethereumProvider);
      
      // Get the Signer which corresponds to the user's wallet
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      
      setEmbeddedSigner(signer);
      setEmbeddedAddress(address);
      
      return signer;
    } catch (error) {
      console.error("Failed to retrieve wallet:", error);
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, [wallets, createWallet]);

  // Auto-sync the wallet if Privy finishes loading it in the background or user authenticates
  useEffect(() => {
    if (!ready) return; // Wait until Privy is fully initialized
    
    // Only auto-generate if they are authenticated AND don't have a signer yet
    if (authenticated && !embeddedSigner && !isGenerating) {
      generateWallet();
    }
  }, [ready, authenticated, embeddedSigner, isGenerating, generateWallet]);

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
