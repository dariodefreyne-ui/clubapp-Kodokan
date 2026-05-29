/**
 * useFirestore.js  –  Firestore + Storage CRUD hooks for Kodokan Clubapp
 *
 * Exports:
 *   useCollection(collectionName, constraints?)  → { data, loading, error }
 *   useDocument(collectionName, docId)           → { data, loading, error }
 *   addDocument(collectionName, data)            → Promise<{ id }>
 *   updateDocument(collectionName, docId, data)  → Promise<void>
 *   deleteDocument(collectionName, docId)        → Promise<void>
 *   uploadFile(storagePath, file)                → Promise<string>  (download URL)
 *
 * All collection hooks use onSnapshot for real-time updates.
 * Loading starts as `true` and flips to `false` after the first snapshot.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';

// ─── useCollection ──────────────────────────────────────────────────────────────
/**
 * Real-time listener for an entire collection (or a constrained query).
 *
 * @param {string}   collectionName   Firestore collection path, e.g. 'leden'
 * @param {Array}    constraints      Optional array of Firestore query constraints
 *                                    e.g. [where('actief', '==', true), orderBy('naam')]
 * @returns {{ data: Array, loading: boolean, error: Error|null }}
 */
export function useCollection(collectionName, constraints = []) {
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  // Serialiseer de constraints tot een stabiele sleutel. Zo wordt de listener
  // wél opnieuw opgezet wanneer een filter/orderBy/limit verandert, terwijl een
  // vers array-literal met dezelfde inhoud géén oneindige re-subscribe triggert.
  const constraintsKey = JSON.stringify(constraints);

  useEffect(() => {
    if (!collectionName) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    let q;
    try {
      const colRef = collection(db, collectionName);
      q = constraints.length > 0
        ? query(colRef, ...constraints)
        : colRef;
    } catch (err) {
      setError(err);
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      q,
      snapshot => {
        const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setData(docs);
        setLoading(false);
        setError(null);
      },
      err => {
        console.error(`[useCollection] ${collectionName}:`, err);
        setError(err);
        setLoading(false);
      },
    );

    return unsubscribe;
    // constraints wordt via de geserialiseerde sleutel gevolgd.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName, constraintsKey]);

  return { data, loading, error };
}

// ─── useDocument ────────────────────────────────────────────────────────────────
/**
 * Real-time listener for a single document.
 *
 * @param {string} collectionName
 * @param {string} docId
 * @returns {{ data: object|null, loading: boolean, error: Error|null }}
 */
export function useDocument(collectionName, docId) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!collectionName || !docId) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const docRef     = doc(db, collectionName, docId);
    const unsubscribe = onSnapshot(
      docRef,
      snapshot => {
        if (snapshot.exists()) {
          setData({ id: snapshot.id, ...snapshot.data() });
        } else {
          setData(null);
        }
        setLoading(false);
        setError(null);
      },
      err => {
        console.error(`[useDocument] ${collectionName}/${docId}:`, err);
        setError(err);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [collectionName, docId]);

  return { data, loading, error };
}

// ─── addDocument ────────────────────────────────────────────────────────────────
/**
 * Add a new document to a collection.
 * Automatically adds `createdAt` and `updatedAt` server timestamps.
 *
 * @param {string} collectionName
 * @param {object} data
 * @returns {Promise<{ id: string }>}
 */
export async function addDocument(collectionName, data) {
  try {
    const colRef  = collection(db, collectionName);
    const docRef  = await addDoc(colRef, {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { id: docRef.id };
  } catch (err) {
    console.error(`[addDocument] ${collectionName}:`, err);
    throw err;
  }
}

// ─── updateDocument ─────────────────────────────────────────────────────────────
/**
 * Update (merge) fields on an existing document.
 * Automatically sets `updatedAt` server timestamp.
 *
 * @param {string} collectionName
 * @param {string} docId
 * @param {object} data
 * @returns {Promise<void>}
 */
export async function updateDocument(collectionName, docId, data) {
  try {
    const docRef = doc(db, collectionName, docId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.error(`[updateDocument] ${collectionName}/${docId}:`, err);
    throw err;
  }
}

// ─── deleteDocument ─────────────────────────────────────────────────────────────
/**
 * Permanently delete a document.
 *
 * @param {string} collectionName
 * @param {string} docId
 * @returns {Promise<void>}
 */
export async function deleteDocument(collectionName, docId) {
  try {
    const docRef = doc(db, collectionName, docId);
    await deleteDoc(docRef);
  } catch (err) {
    console.error(`[deleteDocument] ${collectionName}/${docId}:`, err);
    throw err;
  }
}

// ─── uploadFile ─────────────────────────────────────────────────────────────────
/**
 * Upload a File/Blob to Firebase Storage and return its download URL.
 *
 * @param {string}       storagePath   e.g. 'fotos/leden/abc123.jpg'
 * @param {File|Blob}    file
 * @param {Function}     [onProgress]  Called with progress 0-100 (optional)
 * @returns {Promise<string>}          Public download URL
 */
export async function uploadFile(storagePath, file, onProgress) {
  try {
    const storageRef  = ref(storage, storagePath);
    const uploadTask  = uploadBytesResumable(storageRef, file);

    return await new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        snapshot => {
          if (typeof onProgress === 'function') {
            const pct = Math.round(
              (snapshot.bytesTransferred / snapshot.totalBytes) * 100,
            );
            onProgress(pct);
          }
        },
        err => {
          console.error(`[uploadFile] ${storagePath}:`, err);
          reject(err);
        },
        async () => {
          try {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(url);
          } catch (err) {
            reject(err);
          }
        },
      );
    });
  } catch (err) {
    console.error(`[uploadFile] ${storagePath}:`, err);
    throw err;
  }
}

// ─── useUpload (bonus convenience hook) ────────────────────────────────────────
/**
 * Hook wrapper around uploadFile that tracks progress and state.
 *
 * @returns {{ upload, uploading, progress, error, url }}
 *
 * Usage:
 *   const { upload, uploading, progress, url } = useUpload();
 *   await upload('fotos/leden/xyz.jpg', file);
 */
export function useUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress,  setProgress]  = useState(0);
  const [error,     setError]     = useState(null);
  const [url,       setUrl]       = useState(null);

  const upload = useCallback(async (storagePath, file) => {
    setUploading(true);
    setProgress(0);
    setError(null);
    setUrl(null);

    try {
      const downloadUrl = await uploadFile(storagePath, file, pct => setProgress(pct));
      setUrl(downloadUrl);
      setProgress(100);
      return downloadUrl;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setUploading(false);
    }
  }, []);

  return { upload, uploading, progress, error, url };
}
