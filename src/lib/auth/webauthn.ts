import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type VerifiedRegistrationResponse,
  type VerifiedAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from "@simplewebauthn/server";
import { redis } from "@/lib/redis";

/**
 * WebAuthn is the free, web-native replacement for native Keychain/Keystore
 * device binding, per design doc §1/§4 — the private key is generated and
 * held in the device's own secure hardware and never leaves it; the server
 * only ever stores the public key. This is what makes "one device per
 * student" a cryptographic guarantee rather than a database flag a client
 * could simply lie about.
 *
 * Challenges are stored in Redis, keyed to the student, with a short TTL —
 * standard WebAuthn ceremony practice to prevent replay of a stale
 * challenge.
 */

const rpID = () => process.env.WEBAUTHN_RP_ID!;
const rpName = () => process.env.WEBAUTHN_RP_NAME!;
const origin = () => process.env.WEBAUTHN_ORIGIN!;

const challengeKey = (studentId: string) => `webauthn_challenge:${studentId}`;

export async function createRegistrationOptions(studentId: string, studentLabel: string) {
  const options = await generateRegistrationOptions({
    rpName: rpName(),
    rpID: rpID(),
    userName: studentLabel,
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });
  await redis.set(challengeKey(studentId), options.challenge, { ex: 300 });
  return options;
}

export async function verifyRegistration(
  studentId: string,
  response: RegistrationResponseJSON
): Promise<VerifiedRegistrationResponse> {
  const expectedChallenge = await redis.get<string>(challengeKey(studentId));
  if (!expectedChallenge) throw new Error("Registration challenge expired — try again.");

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin(),
    expectedRPID: rpID(),
    requireUserVerification: false,
  });
  await redis.del(challengeKey(studentId));
  return verification;
}

export async function createAuthenticationOptions(studentId: string, credentialId: string) {
  const options = await generateAuthenticationOptions({
    rpID: rpID(),
    userVerification: "preferred",
    allowCredentials: [{ id: credentialId }],
  });
  await redis.set(challengeKey(studentId), options.challenge, { ex: 300 });
  return options;
}

export async function verifyAuthentication(
  studentId: string,
  response: AuthenticationResponseJSON,
  credentialPublicKey: string,
  credentialCounter: number
): Promise<VerifiedAuthenticationResponse> {
  const expectedChallenge = await redis.get<string>(challengeKey(studentId));
  if (!expectedChallenge) throw new Error("Sign-in challenge expired — try again.");

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin(),
    expectedRPID: rpID(),
    requireUserVerification: false,
    credential: {
      id: response.id,
      publicKey: Buffer.from(credentialPublicKey, "base64"),
      counter: credentialCounter,
    },
  });
  await redis.del(challengeKey(studentId));
  return verification;
}
