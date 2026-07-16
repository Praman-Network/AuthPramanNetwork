// Mock Database interface
interface IdentityRecord {
  primaryWallet: string; // Embedded Wallet Address
  linkedWallets: string[]; // External Wallets
  faceDescriptorHash: string;
}

// In-memory mock DB for concept
const identityDB = new Map<string, IdentityRecord>();

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { embeddedWalletAddress, externalWalletAddress, zkProof, faceDescriptorHash } = req.body;

  if (!embeddedWalletAddress || !externalWalletAddress || !zkProof || !faceDescriptorHash) {
    return res.status(400).json({ success: false, error: 'Missing required parameters' });
  }

  try {
    // 1. Verify ZK Proof (using snarkjs or backend verifier)
    // const isValid = await verifyZKProof(zkProof, faceDescriptorHash);
    const isValid = true; // Mock verification for this concept

    if (!isValid) {
      return res.status(401).json({ success: false, error: 'Invalid ZK Proof' });
    }

    // 2. Prevent Sybil Attacks: Ensure the face isn't already mapped to a different unified identity
    let existingIdentity = identityDB.get(faceDescriptorHash);

    if (existingIdentity) {
      // Identity exists, check if the embedded wallet matches
      if (existingIdentity.primaryWallet.toLowerCase() !== embeddedWalletAddress.toLowerCase()) {
         return res.status(403).json({ success: false, error: 'Face already registered to another account.' });
      }
      
      // Ensure the external wallet isn't already linked
      if (existingIdentity.linkedWallets.includes(externalWalletAddress.toLowerCase())) {
        return res.status(400).json({ success: false, error: 'Wallet already linked.' });
      }

      // Add to linked wallets
      existingIdentity.linkedWallets.push(externalWalletAddress.toLowerCase());
    } else {
      // Edge case: If identity doesn't exist in DB, create it (should ideally exist from onboarding)
      existingIdentity = {
        primaryWallet: embeddedWalletAddress.toLowerCase(),
        linkedWallets: [externalWalletAddress.toLowerCase()],
        faceDescriptorHash: faceDescriptorHash
      };
    }

    identityDB.set(faceDescriptorHash, existingIdentity);

    // 3. (Optional) Smart Contract Interaction
    // If the identity mapping is stored on-chain, we would emit a transaction here
    // e.g. await registryContract.linkAddress(externalWalletAddress, faceDescriptorHash);

    return res.status(200).json({ 
      success: true, 
      message: 'Wallet successfully linked to biometric identity.' 
    });

  } catch (error: any) {
    console.error("Linking error:", error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
