import admin from 'firebase-admin';

let firebaseApp: admin.app.App | null = null;

export function initFirebase(): admin.app.App | null {
  if (firebaseApp) return firebaseApp;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (!projectId) {
    return null;
  }

  try {
    if (serviceAccountPath) {
      firebaseApp = admin.initializeApp({ credential: admin.credential.applicationDefault() });
    } else if (clientEmail && privateKey) {
      const key = privateKey.replace(/\\n/g, '\n');
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: key,
        }),
      });
    } else {
      return null;
    }
    return firebaseApp;
  } catch (err) {
    console.error('Firebase init error:', err);
    return null;
  }
}

export async function verifyFirebaseToken(idToken: string): Promise<{
  uid: string;
  email?: string;
  name?: string;
} | null> {
  const app = initFirebase();
  if (!app) return null;

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    return {
      uid: decoded.uid,
      email: decoded.email || undefined,
      name: (decoded.name as string) || (decoded.email?.split('@')[0]),
    };
  } catch (err) {
    console.error('Firebase token verify error:', err);
    return null;
  }
}

export const isFirebaseConfigured = (): boolean => {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
      ((process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) || process.env.GOOGLE_APPLICATION_CREDENTIALS)
  );
};

/** Create a user in Firebase Auth so they can log in with email/password */
export async function createFirebaseUser(email: string, password: string, displayName?: string): Promise<{ uid: string } | null> {
  const app = initFirebase();
  if (!app) return null;

  try {
    const userRecord = await admin.auth().createUser({
      email: email.toLowerCase().trim(),
      password,
      displayName: displayName?.trim() || undefined,
      emailVerified: false,
    });
    return { uid: userRecord.uid };
  } catch (err) {
    console.error('Firebase createUser error:', err);
    throw err;
  }
}

/**
 * Ensure a Firebase Auth user exists for the given email.
 * In dev, we use this for the default admin account so Firebase login works.
 */
export async function ensureFirebaseUser(
  email: string,
  password: string,
  displayName?: string
): Promise<{ uid: string; created: boolean } | null> {
  const app = initFirebase();
  if (!app) return null;

  const normalizedEmail = email.toLowerCase().trim();
  try {
    const created = await admin.auth().createUser({
      email: normalizedEmail,
      password,
      displayName: displayName?.trim() || undefined,
      emailVerified: false,
    });
    return { uid: created.uid, created: true };
  } catch (err: any) {
    const code = err?.code || err?.errorInfo?.code || '';
    if (code === 'auth/email-already-exists') {
      const existing = await admin.auth().getUserByEmail(normalizedEmail);
      await admin.auth().updateUser(existing.uid, {
        password,
        displayName: displayName?.trim() || existing.displayName || undefined,
      });
      return { uid: existing.uid, created: false };
    }
    console.error('Firebase ensureUser error:', err);
    throw err;
  }
}
