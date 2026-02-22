import { AuditLogger } from './AuditLogger.js';
import { CryptoUtils } from './CryptoUtils.js';
import { DeviceRegistry } from './DeviceRegistry.js';

/**
 * ROTATION & RECOVERY SERVICE
 * Manages secret rotation and emergency recovery keys.
 */

export class RotationService {
    static async rotateDeviceSecret(deviceId: string): Promise<string> {
        const newSecret = CryptoUtils.generateNonce();
        const device = DeviceRegistry.getDevice(deviceId);

        if (device) {
            await DeviceRegistry.registerDevice(deviceId, newSecret, device.nickname);
            await AuditLogger.log({
                level: 'IMPORTANT',
                deviceId: 'SYSTEM',
                action: 'SECRET_ROTATION',
                resource: `device:${deviceId}`,
                status: 'SUCCESS'
            });
            return newSecret;
        }
        throw new Error('DEVICE_NOT_FOUND');
    }

    static async generateRecoveryCodes(deviceId: string): Promise<string[]> {
        const codes = Array.from({ length: 10 }, () => CryptoUtils.generateNonce().substring(0, 8));
        // In a real system, these would be hashed and stored in the registry
        await AuditLogger.log({
            level: 'CRITICAL',
            deviceId,
            action: 'RECOVERY_CODES_GENERATED',
            resource: 'security',
            status: 'INITIALIZED'
        });
        return codes;
    }
}
