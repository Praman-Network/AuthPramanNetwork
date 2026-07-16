import { RequestedScope, UserActualData, UserConsentState } from './types';

/**
 * Generates the final JSON payload for the 3rd-party developer.
 * Enforces strict security validation on required scopes.
 */
export const generateAuthPayload = (
  userActualData: UserActualData,
  userConsentState: UserConsentState,
  requestedScopes: RequestedScope[]
): Record<string, any> => {
  const payload: Record<string, any> = {};

  for (const scope of requestedScopes) {
    const { field, required } = scope;
    
    // Security check: Ignore frontend consent state for required fields.
    // If it's required, we treat consent as unconditionally true.
    const hasConsented = required ? true : userConsentState[field] === true;

    if (required) {
      // Validate that the backend actually possesses this data for the user
      if (userActualData[field] === undefined || userActualData[field] === null) {
        throw new Error(`Authentication Error: Missing required user data for field '${field}'.`);
      }
      
      // Map actual data
      payload[field] = userActualData[field];
      
    } else {
      // Optional field logic
      if (hasConsented) {
        // If they consented, provide the data (fallback to null if we don't have it)
        payload[field] = userActualData[field] !== undefined ? userActualData[field] : null;
      } else {
        // If optional and unchecked, STRICTLY return null to maintain type signatures
        payload[field] = null;
      }
    }
  }

  return payload;
};
