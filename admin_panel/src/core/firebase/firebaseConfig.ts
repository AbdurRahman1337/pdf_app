/**
 * Firebase Configuration & Initialization
 *
 * @react-native-firebase/app auto-reads google-services.json (Android)
 * and GoogleService-Info.plist (iOS) — no manual config object needed.
 * Just import this module to ensure Firebase is initialized before use.
 */
import firebase from '@react-native-firebase/app';
import auth from '@react-native-firebase/auth';

// Re-export auth instance for convenient usage across the app
export { auth, firebase };

export default firebase;
