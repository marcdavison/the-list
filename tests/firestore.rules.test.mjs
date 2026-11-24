// Security rules tests. Run with: npm run test:rules (starts the Firestore emulator).
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, test } from 'node:test';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

const LIST = 'list1';
let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-rules-test',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
});

after(async () => {
  await env?.cleanup();
});

// Fresh data for each test: alice owns list1 with one item, bob is a member, eve is a stranger.
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'lists', LIST), {
      name: 'Groceries',
      ownerId: 'alice',
      memberIds: ['alice', 'bob'],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await setDoc(doc(db, 'lists', LIST, 'items', 'milk'), {
      text: 'Milk',
      checked: false,
      createdBy: 'alice',
      checkedBy: null,
      createdAt: new Date(),
    });
  });
});

const db = (uid) => (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).firestore();
const list = (uid) => doc(db(uid), 'lists', LIST);
const item = (uid, id = 'milk') => doc(db(uid), 'lists', LIST, 'items', id);

const newItem = (uid) => ({
  text: 'Eggs',
  shop: 'tesco',
  checked: false,
  createdBy: uid,
  checkedBy: null,
  createdAt: serverTimestamp(),
});

describe('lists', () => {
  test('signed-out users cannot read anything', async () => {
    await assertFails(getDoc(list(null)));
  });

  test('anyone signed in with the link can read the list doc', async () => {
    await assertSucceeds(getDoc(list('eve')));
  });

  test('"my lists" query only returns your own lists', async () => {
    const mine = query(collection(db('bob'), 'lists'), where('memberIds', 'array-contains', 'bob'));
    await assertSucceeds(getDocs(mine));
    await assertFails(getDocs(collection(db('eve'), 'lists')));
  });

  test('create: must own it and be the only member', async () => {
    const valid = {
      name: 'New',
      ownerId: 'eve',
      memberIds: ['eve'],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await assertSucceeds(setDoc(doc(db('eve'), 'lists', 'x'), valid));
    await assertFails(setDoc(doc(db('eve'), 'lists', 'y'), { ...valid, ownerId: 'alice' }));
    await assertFails(setDoc(doc(db('eve'), 'lists', 'z'), { ...valid, memberIds: ['eve', 'bob'] }));
    await assertFails(setDoc(doc(db('eve'), 'lists', 'w'), { ...valid, name: '' }));
  });

  test('a stranger can join by adding only themselves', async () => {
    await assertSucceeds(updateDoc(list('eve'), { memberIds: arrayUnion('eve') }));
  });

  test('a stranger cannot add others, remove members, or rename while joining', async () => {
    await assertFails(updateDoc(list('eve'), { memberIds: arrayUnion('eve', 'mallory') }));
    await assertFails(updateDoc(list('eve'), { memberIds: ['eve'] }));
    await assertFails(updateDoc(list('eve'), { memberIds: arrayUnion('eve'), name: 'Mine now' }));
    await assertFails(updateDoc(list('eve'), { name: 'Mine now' }));
  });

  test('only the owner can rename; members can bump updatedAt; nobody can change the owner', async () => {
    await assertFails(updateDoc(list('bob'), { name: 'Weekly shop', updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(list('alice'), { name: 'Weekly shop', updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(list('bob'), { updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(list('bob'), { ownerId: 'bob' }));
    await assertFails(updateDoc(list('alice'), { ownerId: 'bob' }));
  });

  test('a member can leave, but cannot remove someone else', async () => {
    await assertFails(updateDoc(list('bob'), { memberIds: arrayRemove('alice') }));
    await assertSucceeds(updateDoc(list('bob'), { memberIds: arrayRemove('bob') }));
  });

  test('the owner cannot leave (they delete instead)', async () => {
    await assertFails(updateDoc(list('alice'), { memberIds: arrayRemove('alice') }));
  });

  test('only the owner can delete the list', async () => {
    await assertFails(deleteDoc(list('bob')));
    await assertFails(deleteDoc(list('eve')));
    await assertSucceeds(deleteDoc(list('alice')));
  });

  test('owner can delete items and the list in one batch', async () => {
    const batch = writeBatch(db('alice'));
    batch.delete(item('alice'));
    batch.delete(list('alice'));
    await assertSucceeds(batch.commit());
  });
});

describe('items', () => {
  test('a non-member cannot read or write items', async () => {
    await assertFails(getDoc(item('eve')));
    await assertFails(getDocs(collection(db('eve'), 'lists', LIST, 'items')));
    await assertFails(setDoc(item('eve', 'new'), newItem('eve')));
    await assertFails(updateDoc(item('eve'), { checked: true, checkedBy: 'eve' }));
    await assertFails(deleteDoc(item('eve')));
  });

  test('after joining, the same user can read items', async () => {
    await updateDoc(list('eve'), { memberIds: arrayUnion('eve') });
    await assertSucceeds(getDocs(collection(db('eve'), 'lists', LIST, 'items')));
  });

  test('members can add, tick and delete items', async () => {
    await assertSucceeds(setDoc(item('bob', 'eggs'), newItem('bob')));
    await assertSucceeds(updateDoc(item('bob'), { checked: true, checkedBy: 'bob' }));
    await assertSucceeds(updateDoc(item('bob'), { checked: false, checkedBy: null }));
    await assertSucceeds(deleteDoc(item('bob')));
  });

  test('adding an item and bumping the list activity time in one batch works', async () => {
    const batch = writeBatch(db('bob'));
    batch.set(item('bob', 'eggs'), newItem('bob'));
    batch.update(list('bob'), { updatedAt: serverTimestamp() });
    await assertSucceeds(batch.commit());
  });

  test('item validation: no impersonation, no empty or overlong text, no extra fields', async () => {
    await assertFails(setDoc(item('bob', 'a'), { ...newItem('bob'), createdBy: 'alice' }));
    await assertFails(setDoc(item('bob', 'b'), { ...newItem('bob'), text: '' }));
    await assertFails(setDoc(item('bob', 'c'), { ...newItem('bob'), text: 'x'.repeat(201) }));
    await assertFails(setDoc(item('bob', 'd'), { ...newItem('bob'), price: 3 }));
    await assertFails(setDoc(item('bob', 'e'), { ...newItem('bob'), shop: 'asda' }));
    const { shop: _omitted, ...noShop } = newItem('bob');
    await assertFails(setDoc(item('bob', 'f'), noShop));
    await assertFails(updateDoc(item('bob'), { checked: true, checkedBy: 'alice' }));
    await assertFails(updateDoc(item('bob'), { createdBy: 'bob' }));
  });
});
