// Client-side encryption utilities using Web Crypto API
export class ChatCrypto {
  private static keyPair: CryptoKeyPair | null = null;
  private static symmetricKey: CryptoKey | null = null;

  // Generate RSA key pair for key exchange
  static async generateKeyPair(): Promise<CryptoKeyPair> {
    if (!this.keyPair) {
      this.keyPair = await window.crypto.subtle.generateKey(
        {
          name: 'RSA-OAEP',
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: 'SHA-256',
        },
        true,
        ['encrypt', 'decrypt']
      );
    }
    return this.keyPair;
  }

  // Generate symmetric key for message encryption
  static async generateSymmetricKey(): Promise<CryptoKey> {
    if (!this.symmetricKey) {
      this.symmetricKey = await window.crypto.subtle.generateKey(
        {
          name: 'AES-GCM',
          length: 256,
        },
        true,
        ['encrypt', 'decrypt']
      );
    }
    return this.symmetricKey;
  }

  // Encrypt message with AES-GCM
  static async encryptMessage(message: string): Promise<string> {
    try {
      const key = await this.generateSymmetricKey();
      const encoder = new TextEncoder();
      const data = encoder.encode(message);
      
      // Generate random IV
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      
      const encrypted = await window.crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv,
        },
        key,
        data
      );

      // Combine IV and encrypted data
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encrypted), iv.length);

      // Convert to base64
      return btoa(String.fromCharCode(...combined));
    } catch (error) {
      console.error('Encryption failed:', error);
      return message; // Fallback to unencrypted
    }
  }

  // Decrypt message with AES-GCM
  static async decryptMessage(encryptedMessage: string): Promise<string> {
    try {
      const key = await this.generateSymmetricKey();
      
      // Convert from base64
      const combined = new Uint8Array(
        atob(encryptedMessage).split('').map(char => char.charCodeAt(0))
      );

      // Extract IV and encrypted data
      const iv = combined.slice(0, 12);
      const encryptedData = combined.slice(12);

      const decrypted = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv,
        },
        key,
        encryptedData
      );

      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      console.error('Decryption failed:', error);
      return encryptedMessage; // Fallback to encrypted text
    }
  }

  // Generate a unique room ID for two users
  static generateRoomId(userId1: string, userId2: string): string {
    const sorted = [userId1, userId2].sort();
    return `room_${sorted[0]}_${sorted[1]}`;
  }
}