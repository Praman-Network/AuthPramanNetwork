/**
 * DeviceGuard scans media devices and identifies virtual/spoofed camera interfaces.
 */
export class DeviceGuard {
  private static VIRTUAL_CAMERA_KEYWORDS = [
    'obs',
    'virtual',
    'manycam',
    'droidcam',
    'fake',
    'splitcam',
    'cameleon',
  ];

  /**
   * Scans available media devices.
   * Returns details of virtual cameras if detected.
   */
  public static async scanDevices(): Promise<{
    isVirtual: boolean;
    virtualCameraLabel?: string;
  }> {
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.enumerateDevices
    ) {
      return { isVirtual: false };
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((device) => device.kind === 'videoinput');

      for (const device of videoDevices) {
        // If permission has not been granted yet, the label might be empty.
        // The check should be re-run after getUserMedia succeeds to scan labels accurately.
        const label = device.label.toLowerCase();
        
        const isVirtual = this.VIRTUAL_CAMERA_KEYWORDS.some((keyword) =>
          label.includes(keyword)
        );

        if (isVirtual) {
          return {
            isVirtual: true,
            virtualCameraLabel: device.label,
          };
        }
      }

      return { isVirtual: false };
    } catch (err) {
      console.warn('[PramanSDK] DeviceGuard enumeration failed:', err);
      return { isVirtual: false };
    }
  }
}
