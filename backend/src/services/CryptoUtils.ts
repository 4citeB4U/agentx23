import crypto from 'crypto';

/**
 * CRYPTO UTILITY
 * Handles HMAC-SHA256 signing and verification.
 */

export class CryptoUtils {
    static sign(message: string, secret: string): string {
        return crypto.createHmac('sha256', secret).update(message).digest('hex');
    }

    static verifySignature(message: string, signature: string, secret: string): boolean {
        const expectedSignature = this.sign(message, secret);
        try {
            return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
        } catch (e) {
            return false;
        }
    }

    static generateNonce(): string {
        return crypto.randomBytes(16).toString('hex');
    }
}
