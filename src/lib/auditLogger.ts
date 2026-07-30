import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './firebase';

export async function logAuditEvent(
  action: string,
  category: 'security' | 'settings' | 'users' | 'paypal' | 'auth',
  details: string,
  previousValue?: any,
  newValue?: any
) {
  try {
    const user = auth.currentUser;
    await addDoc(collection(db, 'audit_logs'), {
      action,
      category,
      details,
      previousValue: previousValue !== undefined ? JSON.stringify(previousValue) : null,
      newValue: newValue !== undefined ? JSON.stringify(newValue) : null,
      userId: user?.uid || 'system',
      userEmail: user?.email || 'System',
      timestamp: serverTimestamp(),
      ip: '127.0.0.1',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Server'
    });

    // Also mirror into system logs for unified visibility
    await addDoc(collection(db, 'logs'), {
      type: 'info',
      message: `${action}: ${details}`,
      source: `Audit:${category.toUpperCase()}`,
      timestamp: serverTimestamp(),
      details: user?.email ? `Modifiziert von ${user.email}` : undefined
    });
  } catch (err) {
    console.warn("Could not write audit log:", err);
  }
}
