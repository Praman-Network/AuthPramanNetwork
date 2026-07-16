import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { usePramanIdentity } from './usePramanIdentity';

export function useAccountLinking(embeddedWalletAddress: string) {
  const [isLinking, setIsLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkedAddress, setLinkedAddress] = useState<string | null>(null);

  // We reuse the existing face scanning hooks for biometric re-verification
  const { verifyAndLogin, setIsScanning } = usePramanIdentity();

  const linkWallet = useCallback(async () => {
    setIsLinking(true);
    setError(null);

    try {
      // 1. Connect External Wallet (MetaMask)
      if (!(window as any).ethereum) {
        throw new Error("MetaMask not detected. Please install a Web3 Wallet.");
      }

      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      if (accounts.length === 0) {
        throw new Error('No accounts connected.');
      }
      
      const signer = await provider.getSigner();
      const externalAddress = await signer.getAddress();

      if (externalAddress.toLowerCase() === embeddedWalletAddress.toLowerCase()) {
        throw new Error("External wallet cannot be the same as the embedded wallet.");
      }

      // 2. Trigger Biometric Re-verification
      // In a full implementation, we'd open a modal webcam here. 
      // For this hook, we assume the UI handles the webcam stream and provides a mock image,
      // or we can invoke verifyAndLogin which runs the logic.
      setIsScanning(true);
      
      // Simulate capture from a hidden or modal webcam
      const mockImageSrc = "data:image/jpeg;base64,mocked_image_data";
      
      // Attempt verification
      const authResult = await verifyAndLogin(mockImageSrc);

      if (!authResult || !authResult.zkProof) {
        throw new Error("Biometric verification failed. Faces do not match.");
      }

      // 3. Call backend to map the new wallet to the unified identity
      const response = await fetch('/api/link-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeddedWalletAddress,
          externalWalletAddress: externalAddress,
          zkProof: authResult.zkProof,
          faceDescriptorHash: authResult.faceDescriptorHash
        })
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Linking failed on backend.");
      }

      setLinkedAddress(externalAddress);
      
    } catch (err: any) {
      setError(err.message || 'An error occurred during account linking.');
    } finally {
      setIsLinking(false);
      setIsScanning(false);
    }
  }, [embeddedWalletAddress, verifyAndLogin, setIsScanning]);

  return {
    linkWallet,
    isLinking,
    error,
    linkedAddress
  };
}
