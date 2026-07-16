export async function verifyHardwareCamera(): Promise<boolean> {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      console.warn("MediaDevices API not supported.");
      // Safest default is to block if API isn't supported
      return false; 
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoInputs = devices.filter(device => device.kind === 'videoinput');

    if (videoInputs.length === 0) {
      console.error("No video input devices found.");
      return false;
    }

    // List of known virtual camera keywords commonly used for spoofing
    const virtualKeywords = [
      'obs', 
      'virtual', 
      'snap', 
      'manycam', 
      'epoccam', 
      'ivcam', 
      'xsplit', 
      'droidcam',
      'camtwisty'
    ];

    let hasHardwareCamera = false;

    for (const device of videoInputs) {
      const label = device.label.toLowerCase();
      // If the label contains any of the forbidden keywords, mark it as virtual
      const isVirtual = virtualKeywords.some(keyword => label.includes(keyword));
      
      if (isVirtual) {
        console.warn(`Blocked virtual camera: ${device.label}`);
      } else if (label.length > 0) {
        // We found a non-virtual camera that provided a label
        hasHardwareCamera = true;
      } else {
        // If the label is empty, permissions might not be granted yet. 
        // We generally can't verify it, but we might let it proceed to request permissions.
        // For strictness, if we require hardware, we might only accept non-empty labels that pass the filter.
      }
    }

    if (!hasHardwareCamera && videoInputs.some(d => d.label === '')) {
      // If we couldn't verify because labels are empty (permissions not granted)
      // Allow it to proceed momentarily so the browser prompts for permission
      return true; 
    }

    if (!hasHardwareCamera) {
      console.error("Only virtual cameras detected or no valid hardware camera found. AI Verification blocked.");
      return false;
    }

    return true;
  } catch (err) {
    console.error("Error enumerating devices:", err);
    return false;
  }
}
