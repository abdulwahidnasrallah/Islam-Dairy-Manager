import argon2 from "argon2";

/**
 * All password hashing goes through this file. Never call argon2 (or any
 * other hashing) directly from a service/controller — this is the single
 * place the hashing algorithm and parameters are chosen.
 */
export const passwordService = {
  async hash(plainPassword: string): Promise<string> {
    return argon2.hash(plainPassword, { type: argon2.argon2id });
  },

  async verify(hash: string, plainPassword: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plainPassword);
    } catch {
      // Malformed hash or verification error — treat as "wrong password",
      // never surface the internal reason to the caller.
      return false;
    }
  },
};
