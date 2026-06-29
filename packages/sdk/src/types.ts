export interface PramanConfig {
  apiKey: string;
  network: string;
  webhookUrl?: string;
  adminAddress?: string;
  backendUrl?: string;
  liveness?: boolean | 'strict' | 'standard' | 'off';
  livenessLevel?: 'strict' | 'standard' | 'off';
  idpUrl?: string;
}

export interface AuthResult {
  success: boolean;
  jwt: string;
  pii?: {
    name: string;
    email: string;
    mobile: string;
  };
  proof?: any;
  faceDescriptorHash?: string;
  ipfsCid?: string;
  error?: string;
  livenessScore?: number;
  handoverSessionId?: string;
  is_mock?: boolean;
}

export interface PopupOptions {
  idpUrl?: string;
  scopes?: string[];
  width?: number;
  height?: number;
}

export interface PopupAuthResult {
  success: boolean;
  user: {
    did: string;
    email?: string;
    verified: boolean;
  };
  token: string;
  proof?: any;
}

export interface ProgressStepData {
  step: string;
  message: string;
}

export const PramanErrors = {
  LIVELINESS_FAILED: 'LIVELINESS_FAILED',
  VIRTUAL_CAMERA_DETECTED: 'VIRTUAL_CAMERA_DETECTED',
  HANDOVER_TIMEOUT: 'HANDOVER_TIMEOUT',
} as const;

export type PramanErrorType = typeof PramanErrors[keyof typeof PramanErrors];


