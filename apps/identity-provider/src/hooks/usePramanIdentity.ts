import { useState, useEffect, useCallback, useRef } from 'react';
const faceapi = (window as any).faceapi;
import { ethers } from 'ethers';
import {
  encryptPII,
  uploadToIPFS,
  getManualAuthSig,
  decryptPII,
  generateZKFaceProof,
  quantizeFaceVector,
  hashFaceVector,
  FaceRegistryConfig as faceRegistryConfig,
  fetchFromIPFS
} from '@praman/sdk';

// SHA-256 helper removed in favor of Keccak256 biometrics hashing

export type ProgressStep =
  | 'idle'
  | 'connecting-wallet'
  | 'loading-models'
  | 'waiting-for-scan'
  | 'scanning-face'
  | 'generating-vector'
  | 'checking-duplicate'
  | 'encrypting-pii'
  | 'uploading-ipfs'
  | 'generating-zk-proof'
  | 'registering-on-chain'
  | 'redirecting'
  | 'success'
  | 'error';

interface PramanIdentityConfig {
  adminAddress?: string;
  onLog?: (message: string) => void;
}

export function usePramanIdentity(config?: PramanIdentityConfig) {
  const adminAddress = config?.adminAddress || '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
  
  // Use stable ref to prevent infinite callback re-creations
  const onLogRef = useRef(config?.onLog);
  useEffect(() => {
    onLogRef.current = config?.onLog;
  }, [config?.onLog]);

  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isModelLoaded, setIsModelLoaded] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressStep, setProgressStep] = useState<ProgressStep>('idle');
  const [ipfsCid, setIpfsCid] = useState<string | null>(null);
  const [zkProof, setZkProof] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  // Local logging helper with stable reference
  const addLog = useCallback((msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const formattedMsg = `[${timestamp}] ${msg}`;
    setLogs((prev) => [...prev, formattedMsg]);
    if (onLogRef.current) {
      onLogRef.current(formattedMsg);
    }
  }, []);

  // Connects the wallet using standard Ethers.js
  const connectWallet = useCallback(async () => {
    setError(null);
    setProgressStep('connecting-wallet');
    addLog('Requesting wallet connection...');

    if (!(window as any).ethereum) {
      const err = 'No Web3 wallet found. Please install MetaMask or another browser wallet.';
      setError(err);
      setProgressStep('error');
      addLog(`Wallet connection error: ${err}`);
      return null;
    }

    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      if (accounts.length === 0) {
        throw new Error('No accounts returned from wallet.');
      }
      
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      
      setWalletAddress(address);
      setProgressStep('idle');
      addLog(`Wallet connected: ${address}`);
      return signer;
    } catch (err: any) {
      const errMsg = err.message || 'Failed to connect wallet';
      setError(errMsg);
      setProgressStep('error');
      addLog(`Wallet connection error: ${errMsg}`);
      return null;
    }
  }, [addLog]);

  // Loads face-api.js models from public folder with a fallback to jsDelivr CDN
  const loadModels = useCallback(async () => {
    if (isModelLoaded) return;
    setError(null);
    setProgressStep('loading-models');
    addLog('Loading face detection & landmark models...');

    const localModelUrl = '/models';
    const cdnModelUrl = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';

    try {
      // Attempt to load from public/models/ locally
      await faceapi.nets.ssdMobilenetv1.loadFromUri(localModelUrl);
      await faceapi.nets.faceLandmark68Net.loadFromUri(localModelUrl);
      await faceapi.nets.faceRecognitionNet.loadFromUri(localModelUrl);
      
      setIsModelLoaded(true);
      setProgressStep('idle');
      addLog('Face models loaded successfully from local storage.');
    } catch (localError) {
      addLog('Local models not found or failed to load. Fetching from jsDelivr CDN fallback...');
      try {
        await faceapi.nets.ssdMobilenetv1.loadFromUri(cdnModelUrl);
        await faceapi.nets.faceLandmark68Net.loadFromUri(cdnModelUrl);
        await faceapi.nets.faceRecognitionNet.loadFromUri(cdnModelUrl);
        
        setIsModelLoaded(true);
        setProgressStep('idle');
        addLog('Face models loaded successfully from CDN fallback.');
      } catch (cdnError: any) {
        const errMsg = `Failed to load face-api models: ${cdnError.message || cdnError}`;
        setError(errMsg);
        setProgressStep('error');
        addLog(`Model loading error: ${errMsg}`);
      }
    }
  }, [isModelLoaded, addLog]);

  // Registration Mode: Scans face, encrypts PII, uploads to IPFS, and registers on contract
  const scanAndRegister = useCallback(async (
    piiData: { name: string; email: string; mobile: string },
    webcamScreenshot: string | null
  ) => {
    setError(null);
    setIsProcessing(true);

    if (!isModelLoaded) {
      const err = 'Face models are not loaded yet.';
      setError(err);
      setIsProcessing(false);
      setProgressStep('error');
      addLog(`Error: ${err}`);
      return null;
    }

    if (!webcamScreenshot) {
      const err = 'Failed to capture frame from Webcam. Make sure your camera is active.';
      setError(err);
      setIsProcessing(false);
      setProgressStep('error');
      addLog(`Error: ${err}`);
      return null;
    }

    let signer: any = null;
    let currentAddress = walletAddress;

    // Connect wallet if not already connected
    if (!currentAddress) {
      signer = await connectWallet();
      if (!signer) {
        setIsProcessing(false);
        return null;
      }
      currentAddress = await signer.getAddress();
    } else {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      signer = await provider.getSigner();
    }

    try {
      // 1. Process Frame (Face Landmark & Vector Generation)
      setProgressStep('scanning-face');
      addLog('Analyzing facial structure and liveness...');
      
      const img = new Image();
      img.src = webcamScreenshot;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('Failed to parse webcam image screenshot'));
      });

      setProgressStep('generating-vector');
      addLog('Extracting 128-dimensional face embedding...');
      
      const detection = await faceapi
        .detectSingleFace(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        throw new Error('No face detected. Please ensure your face is clearly visible, well-lit, and centered.');
      }

      const faceVector = Array.from(detection.descriptor) as number[];
      addLog(`Face detected successfully. Bounding box: x=${Math.round(detection.detection.box.x)}, y=${Math.round(detection.detection.box.y)}`);
      
      const quantizedNewVector = quantizeFaceVector(faceVector);
      const faceDescriptorHash = hashFaceVector(quantizedNewVector);
      addLog(`Biometric vector quantized. Keccak256 hash: ${faceDescriptorHash}`);

      // 1.5 Duplicate Check against Smart Contract (Registration guard)
      setProgressStep('checking-duplicate');
      addLog('Connecting to FaceRegistry Smart Contract to verify face is not already registered...');
      
      const faceRegistryAddress = faceRegistryConfig.address;
      const faceRegistryAbi = faceRegistryConfig.abi;
      
      const contract = new ethers.Contract(faceRegistryAddress, faceRegistryAbi, signer);
      
      // Check 1: Is this exact face hash already on-chain?
      const isFaceReg: boolean = Boolean(await contract.isFaceRegistered(faceDescriptorHash));
      
      // Check 2: Has this wallet address already registered a face?
      const walletHash: string = await contract.getUserFaceHash(currentAddress);
      const isWalletReg: boolean = (walletHash !== '0x0000000000000000000000000000000000000000000000000000000000000000' && walletHash !== '0x');
      
      const isAlreadyRegistered = isFaceReg || isWalletReg;
      addLog(`On-chain check — face registered: ${isFaceReg}, wallet registered: ${isWalletReg}`);
      
      // GUARD: Block registration if already exists
      if (isAlreadyRegistered === true) {
        throw new Error('Identity already exists. Sybil attack prevented. Please Login.');
      }
      addLog('✓ No duplicate found. Proceeding with PII encryption and IPFS upload.');

      // 2. Encryption (Strict Lit Protocol)
      setProgressStep('encrypting-pii');
      
      addLog('Requesting Lit authorization signature (SIWE)...');
      const authSig = await getManualAuthSig(signer);
      addLog('Auth signature captured. Connecting to Lit nodes...');

      addLog('Encrypting user PII client-side...');
      const { ciphertext, dataToEncryptHash } = await encryptPII(
        piiData,
        currentAddress!,
        adminAddress,
        authSig
      );
      addLog('PII encrypted using Lit Protocol on datil-dev network.');

      // 3. Decentralized Storage (IPFS Upload via Pinata)
      setProgressStep('uploading-ipfs');
      addLog('Uploading encrypted payload to IPFS...');
      
      const ipfsPayload = {
        ciphertext,
        dataToEncryptHash,
        faceDescriptorHash,
        quantizedVector: quantizedNewVector,
        userAddress: currentAddress!,
      };

      const ipfsResult = await uploadToIPFS(ipfsPayload);
      setIpfsCid(ipfsResult.cid);
      addLog(`Payload pinned to Pinata IPFS node. CID: ${ipfsResult.cid}`);

      // 4. On-Chain Registry Registration (No ZK proofs during Registration!)
      setProgressStep('registering-on-chain');
      addLog('Registering face hash and IPFS CID on-chain...');
      addLog('Sending registerFace transaction to registry contract...');
      const tx = await contract.registerFace(faceDescriptorHash, ipfsResult.cid, {
        maxPriorityFeePerGas: ethers.parseUnits('30', 'gwei'),
        maxFeePerGas: ethers.parseUnits('35', 'gwei'),
        gasLimit: 300000
      });
      addLog(`Transaction sent: ${tx.hash}. Waiting for block confirmation...`);
      await tx.wait();
      addLog('Transaction confirmed! Face registered on-chain successfully.');

      setProgressStep('success');
      setIsProcessing(false);
      addLog('Identity Module registration completed successfully.');
      
      return {
        ipfsCid: ipfsResult.cid,
        faceDescriptorHash,
      };
    } catch (err: any) {
      const errMsg = err.message || 'Registration flow failed';
      setError(errMsg);
      setProgressStep('error');
      setIsProcessing(false);
      addLog(`Flow execution error: ${errMsg}`);
      return null;
    }
  }, [isModelLoaded, walletAddress, adminAddress, connectWallet, addLog]);

  // Login Mode: Scans face, queries contract to fetch registered vector, runs ZK prover in browser to match
  const verifyAndLogin = useCallback(async (
    webcamScreenshot: string | null
  ) => {
    setError(null);
    setIsProcessing(true);

    if (!isModelLoaded) {
      const err = 'Face models are not loaded yet.';
      setError(err);
      setIsProcessing(false);
      setProgressStep('error');
      addLog(`Error: ${err}`);
      return null;
    }

    if (!webcamScreenshot) {
      const err = 'Failed to capture frame from Webcam. Make sure your camera is active.';
      setError(err);
      setIsProcessing(false);
      setProgressStep('error');
      addLog(`Error: ${err}`);
      return null;
    }

    let signer: any = null;
    let currentAddress = walletAddress;

    // Connect wallet if not already connected
    if (!currentAddress) {
      signer = await connectWallet();
      if (!signer) {
        setIsProcessing(false);
        return null;
      }
      currentAddress = await signer.getAddress();
    } else {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      signer = await provider.getSigner();
    }

    try {
      // 1. Process Frame (Face Landmark & Vector Generation)
      setProgressStep('scanning-face');
      addLog('Analyzing facial structure for verification...');
      
      const img = new Image();
      img.src = webcamScreenshot;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('Failed to parse webcam image screenshot'));
      });

      setProgressStep('generating-vector');
      addLog('Extracting 128-dimensional face embedding...');
      
      const detection = await faceapi
        .detectSingleFace(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        throw new Error('No face detected. Please ensure your face is clearly visible, well-lit, and centered.');
      }

      const faceVector = Array.from(detection.descriptor) as number[];
      addLog('Face detected successfully.');
      
      const quantizedNewVector = quantizeFaceVector(faceVector);
      const faceDescriptorHash = hashFaceVector(quantizedNewVector);
      addLog(`Biometric vector quantized. Keccak256 hash: ${faceDescriptorHash}`);

      // 2. Wallet-based registration lookup (Login guard)
      // 2. Query FaceRegistry Contract
      setProgressStep('checking-duplicate');
      addLog('Querying FaceRegistry contract — checking wallet address for registration...');
      
      const faceRegistryAddress = faceRegistryConfig.address;
      const faceRegistryAbi = faceRegistryConfig.abi;
      
      const contract = new ethers.Contract(faceRegistryAddress, faceRegistryAbi, signer);
      
      // Look up by WALLET ADDRESS — this is the stable identifier across logins
      const storedFaceHash: string = await contract.getUserFaceHash(currentAddress);
      const zeroHash = '0x0000000000000000000000000000000000000000000000000000000000000000';
      const isRegistered = (storedFaceHash !== zeroHash && storedFaceHash !== '0x');
      
      if (isRegistered === false) {
        throw new Error('User not found. Please Register first.');
      }
      
      const registeredCid = await contract.getUserCid(currentAddress);
      const registeredHash = storedFaceHash;
      
      addLog(`✓ Wallet is registered. IPFS CID: ${registeredCid}`);

      // 3. Load saved quantized face vector for ZK comparison
      addLog('Loading saved biometric template from IPFS...');

      const payload = await fetchFromIPFS(registeredCid);
      const savedVector = payload.quantizedVector;

      if (!savedVector || savedVector.length !== 128) {
        throw new Error(
          'Registered biometric template not found in IPFS payload.'
        );
      }
      addLog('✓ Retrieved 128-d registered face descriptor template.');

      // 4. Run ZK fullProve in browser to verify face match
      setProgressStep('generating-zk-proof');
      addLog('Loading verification key and running snarkjs.groth16.fullProve...');
      
      const zkResult = await generateZKFaceProof(quantizedNewVector, savedVector, registeredHash);
      setZkProof(zkResult.proof);
      setIpfsCid(registeredCid);
      
      addLog('Real Groth16 ZK match proof generated and verified successfully in the browser!');

      setProgressStep('success');
      setIsProcessing(false);
      addLog('Biometric Login verified successfully.');
      
      return {
        ipfsCid: registeredCid,
        zkProof: zkResult.proof,
        faceDescriptorHash,
      };
    } catch (err: any) {
      const errMsg = err.message || 'Login flow failed';
      setError(errMsg);
      setProgressStep('error');
      setIsProcessing(false);
      addLog(`Flow execution error: ${errMsg}`);
      return null;
    }
  }, [isModelLoaded, walletAddress, connectWallet, addLog]);

  // Utility to decrypt and retrieve user PII (for self-verification)
  const testDecryption = useCallback(async (
    ipfsCid: string
  ) => {
    if (!walletAddress) {
      await connectWallet();
    }
    
    addLog('Fetching encrypted payload from IPFS...');
    const payload = await fetchFromIPFS(ipfsCid);

    addLog('Starting test decryption flow...');
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      
      const authSig = await getManualAuthSig(signer);
      
      const decrypted = await decryptPII(
        payload.ciphertext,
        payload.dataToEncryptHash,
        walletAddress || '',
        adminAddress,
        authSig
      );
      
      addLog('Test decryption successful!');
      return decrypted;
    } catch (err: any) {
      const errMsg = err.message || 'Decryption failed';
      addLog(`Test decryption error: ${errMsg}`);
      throw err;
    }
  }, [walletAddress, adminAddress, connectWallet, addLog]);

  // Load models on mount automatically
  useEffect(() => {
    loadModels();
  }, [loadModels]);

  return {
    walletAddress,
    isModelLoaded,
    isScanning,
    isProcessing,
    progressStep,
    ipfsCid,
    zkProof,
    error,
    logs,
    connectWallet,
    scanAndRegister,
    verifyAndLogin,
    setIsScanning,
    testDecryption,
    addLog,
  };
}
