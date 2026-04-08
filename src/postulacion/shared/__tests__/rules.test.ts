import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, getDocs, collection } from 'firebase/firestore';
import { readFileSync } from 'fs';

let testEnv: RulesTestEnvironment;

describe('Firebase Security Rules', () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'proyecto-beca-2026',
      firestore: {
        rules: readFileSync('firestore.rules', 'utf8'),
        host: '127.0.0.1',
        port: 8080,
      },
      storage: {
        rules: readFileSync('storage.rules', 'utf8'),
        host: '127.0.0.1',
        port: 9199,
      }
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  describe('Firestore: postulantes', () => {
    it('should deny any direct access to postulantes collection', async () => {
      const aliceDb = testEnv.authenticatedContext('alice').firestore();
      const docRef = doc(aliceDb, 'postulantes/some-id');
      
      await expect(getDoc(docRef)).rejects.toThrow();
      await expect(setDoc(docRef, { name: 'Alice' })).rejects.toThrow();
    });
  });

  describe('Firestore: users', () => {
    it('should allow user to read their own profile', async () => {
      const aliceDb = testEnv.authenticatedContext('alice').firestore();
      const docRef = doc(aliceDb, 'users/alice');
      
      // We need to create the doc first as admin to test reading it
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'users/alice'), { role: 'user' });
      });

      await expect(getDoc(docRef)).resolves.toBeDefined();
    });

    it('should deny user from reading other profiles', async () => {
      const aliceDb = testEnv.authenticatedContext('alice').firestore();
      const bobDoc = doc(aliceDb, 'users/bob');
      
      await expect(getDoc(bobDoc)).rejects.toThrow();
    });

    it('should allow superadmin to read any profile', async () => {
      // Mocking get() in rules requires the document to exist
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'users/admin_user'), { role: 'superadmin' });
        await setDoc(doc(context.firestore(), 'users/alice'), { role: 'user' });
      });

      const adminDb = testEnv.authenticatedContext('admin_user').firestore();
      const aliceDoc = doc(adminDb, 'users/alice');
      
      await expect(getDoc(aliceDoc)).resolves.toBeDefined();
    });
  });

  describe('Firestore: historical_ruts', () => {
    it('should allow public to get a specific RUT', async () => {
      const unauthDb = testEnv.unauthenticatedContext().firestore();
      const docRef = doc(unauthDb, 'historical_ruts/12345678-9');
      
      await expect(getDoc(docRef)).resolves.toBeDefined();
    });

    it('should deny public from listing ALL historical RUTs', async () => {
      const unauthDb = testEnv.unauthenticatedContext().firestore();
      const colRef = collection(unauthDb, 'historical_ruts');
      
      await expect(getDocs(colRef)).rejects.toThrow();
    });
  });
});
