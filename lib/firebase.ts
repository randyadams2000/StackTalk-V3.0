import type { FirebaseApp } from "firebase/app"
import type { Auth, User } from "firebase/auth"
import type { Firestore } from "firebase/firestore"

export interface FirebaseConfig {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
}

// Real Firebase configuration - replace with your actual config
const firebaseConfig: FirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

// Global variables to store Firebase instances
let firebaseApp: FirebaseApp | null = null
let firebaseAuth: Auth | null = null
let firebaseFirestore: Firestore | null = null
let initializationPromise: Promise<{ app: FirebaseApp | null; auth: Auth | null; firestore: Firestore | null }> | null =
  null

// Dynamic Firebase initialization with proper loading order
const initializeFirebaseInternal = async (): Promise<{
  app: FirebaseApp | null
  auth: Auth | null
  firestore: Firestore | null
}> => {
  // If already initializing, wait for that to complete
  if (initializationPromise) {
    console.log("Firebase: Waiting for existing initialization to complete...")
    return initializationPromise
  }

  // If already initialized, return existing instances
  if (firebaseApp && firebaseAuth && firebaseFirestore) {
    console.log("Firebase: Using existing initialized instances")
    return { app: firebaseApp, auth: firebaseAuth, firestore: firebaseFirestore }
  }

  // Start new initialization
  initializationPromise = (async () => {
    try {
      // Check if we're in a browser environment
      if (typeof window === "undefined") {
        console.log("Firebase: Server-side environment detected, skipping initialization")
        return { app: null, auth: null, firestore: null }
      }

      console.log("Firebase: Starting dynamic initialization...")

      // Wait for document to be ready
      if (document.readyState === "loading") {
        console.log("Firebase: Waiting for document ready...")
        await new Promise((resolve) => {
          document.addEventListener("DOMContentLoaded", resolve, { once: true })
        })
      }

      // Additional safety delay
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Dynamically import Firebase modules to ensure proper loading order
      console.log("Firebase: Importing Firebase modules...")
      const [{ initializeApp, getApps, getApp }, { getAuth }, { getFirestore }] = await Promise.all([
        import("firebase/app"),
        import("firebase/auth"),
        import("firebase/firestore"),
      ])

      console.log("Firebase: Firebase modules imported successfully")

      // Initialize Firebase App first
      if (!firebaseApp) {
        try {
          if (getApps().length === 0) {
            console.log("Firebase: Creating new app instance")
            firebaseApp = initializeApp(firebaseConfig)
          } else {
            console.log("Firebase: Using existing app instance")
            firebaseApp = getApp()
          }
          console.log("Firebase: App initialized successfully")

          // Wait a bit more to ensure app is fully ready
          await new Promise((resolve) => setTimeout(resolve, 300))
        } catch (appError) {
          console.error("Firebase: App initialization failed:", appError)
          throw appError
        }
      }

      // Initialize Auth after app is ready
      if (!firebaseAuth && firebaseApp) {
        try {
          console.log("Firebase: Initializing auth with ready app...")
          firebaseAuth = getAuth(firebaseApp)

          // Verify auth instance is valid
          if (!firebaseAuth) {
            throw new Error("Auth instance is null after initialization")
          }

          console.log("Firebase: Auth initialized successfully")

          // Additional verification delay
          await new Promise((resolve) => setTimeout(resolve, 200))
        } catch (authError) {
          console.error("Firebase: Auth initialization failed:", authError)
          throw authError
        }
      }

      // Initialize Firestore after app is ready
      if (!firebaseFirestore && firebaseApp) {
        try {
          console.log("Firebase: Initializing Firestore with ready app...")
          firebaseFirestore = getFirestore(firebaseApp)

          // Verify Firestore instance is valid
          if (!firebaseFirestore) {
            throw new Error("Firestore instance is null after initialization")
          }

          console.log("Firebase: Firestore initialized successfully")

          // Additional verification delay
          await new Promise((resolve) => setTimeout(resolve, 200))
        } catch (firestoreError) {
          console.error("Firebase: Firestore initialization failed:", firestoreError)
          throw firestoreError
        }
      }

      console.log("Firebase: Full initialization completed successfully")
      return { app: firebaseApp, auth: firebaseAuth, firestore: firebaseFirestore }
    } catch (error) {
      console.error("Firebase: Initialization error:", error)
      // Reset promise so we can try again
      initializationPromise = null
      throw error
    }
  })()

  return initializationPromise
}

// Helper function to get auth instance safely
export const getFirebaseAuth = async (): Promise<Auth | null> => {
  try {
    // Don't even try on server side
    if (typeof window === "undefined") {
      return null
    }

    console.log("Firebase: Getting auth instance...")
    const { auth } = await initializeFirebaseInternal()
    return auth
  } catch (error) {
    console.error("Firebase: Error getting auth instance:", error)
    return null
  }
}

// Helper function to get Firestore instance safely
export const getFirestoreInstance = async (): Promise<Firestore | null> => {
  try {
    // Don't even try on server side
    if (typeof window === "undefined") {
      return null
    }

    console.log("Firebase: Getting Firestore instance...")
    const { firestore } = await initializeFirebaseInternal()
    return firestore
  } catch (error) {
    console.error("Firebase: Error getting Firestore instance:", error)
    return null
  }
}

// Helper function to get auth token safely
export const getAuthToken = async (): Promise<string | null> => {
  try {
    const auth = await getFirebaseAuth()
    if (!auth || !auth.currentUser) {
      console.log("No auth instance or current user")
      return null
    }

    const token = await auth.currentUser.getIdToken()
    console.log("Firebase auth token retrieved successfully")
    return token
  } catch (error) {
    console.error("Error getting auth token:", error)
    return null
  }
}

// Helper function to get current user safely
export const getCurrentUser = async (): Promise<User | null> => {
  try {
    const auth = await getFirebaseAuth()
    return auth?.currentUser || null
  } catch (error) {
    console.error("Error getting current user:", error)
    return null
  }
}

// Helper function to sign in with email and password
export const signInWithEmail = async (email: string, password: string): Promise<User | null> => {
  try {
    const auth = await getFirebaseAuth()
    if (!auth) {
      throw new Error("Firebase Auth not available")
    }

    const { signInWithEmailAndPassword } = await import("firebase/auth")
    const result = await signInWithEmailAndPassword(auth, email, password)
    return result.user
  } catch (error) {
    console.error("Sign in error:", error)
    throw error
  }
}

// Helper function to create user with email and password
export const createUserWithEmail = async (email: string, password: string): Promise<User | null> => {
  try {
    const auth = await getFirebaseAuth()
    if (!auth) {
      throw new Error("Firebase Auth not available")
    }

    const { createUserWithEmailAndPassword } = await import("firebase/auth")
    const result = await createUserWithEmailAndPassword(auth, email, password)
    return result.user
  } catch (error) {
    console.error("Create user error:", error)
    throw error
  }
}

// Helper function to sign in with Google
export const signInWithGoogle = async (): Promise<User | null> => {
  try {
    const auth = await getFirebaseAuth()
    if (!auth) {
      throw new Error("Firebase Auth not available")
    }

    const { signInWithPopup, GoogleAuthProvider } = await import("firebase/auth")
    const provider = new GoogleAuthProvider()
    provider.addScope("email")
    provider.addScope("profile")

    // Add debugging info
    console.log("🔍 Google OAuth Debug Info:", {
      currentURL: window.location.href,
      origin: window.location.origin,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    })

    const result = await signInWithPopup(auth, provider)
    console.log("Google sign in successful:", result.user.email)
    return result.user
  } catch (error) {
    console.error("Google sign in error:", error)
    // Log additional error details for redirect URI issues
    if (error instanceof Error && error.message.includes("redirect_uri_mismatch")) {
      console.error("🚨 Redirect URI Mismatch Details:", {
        error: error.message,
        currentDomain: window.location.origin,
        expectedRedirectURI: `${window.location.origin}/__/auth/handler`,
        firebaseAuthDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
      })
    }
    throw error
  }
}

// Helper function to sign out
export const signOutUser = async (): Promise<void> => {
  try {
    const auth = await getFirebaseAuth()
    if (!auth) {
      throw new Error("Firebase Auth not available")
    }

    const { signOut } = await import("firebase/auth")
    await signOut(auth)
    console.log("User signed out successfully")
  } catch (error) {
    console.error("Sign out error:", error)
    throw error
  }
}

// Helper function to listen to auth state changes
export const onAuthStateChange = async (callback: (user: User | null) => void): Promise<(() => void) | null> => {
  try {
    const auth = await getFirebaseAuth()
    if (!auth) {
      console.log("Firebase Auth not available for state listener")
      return null
    }

    const { onAuthStateChanged } = await import("firebase/auth")
    return onAuthStateChanged(auth, callback)
  } catch (error) {
    console.error("Error setting up auth state listener:", error)
    return null
  }
}

// Reset function for testing/debugging
export const resetFirebase = () => {
  console.log("Firebase: Resetting initialization state")
  firebaseApp = null
  firebaseAuth = null
  firebaseFirestore = null
  initializationPromise = null
}

// Export null initially - will be set when needed
export const auth = null
export const firestore = null
export default firebaseConfig
