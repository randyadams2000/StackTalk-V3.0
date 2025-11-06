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
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "talk2me-onboarding.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "talk2me-onboarding",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "talk2me-onboarding.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "123456789012",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:123456789012:web:abcdef123456789012345678",
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

    // Debug Firebase configuration
    console.log("🔧 Firebase Config Check:", {
      hasApiKey: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      hasAuthDomain: !!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      hasProjectId: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      hasAppId: !!process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
    })

    const { signInWithPopup, GoogleAuthProvider } = await import("firebase/auth")
    const provider = new GoogleAuthProvider()
    provider.addScope("email")
    provider.addScope("profile")

    // Add debugging info
    console.log("🔍 Google OAuth Debug Info:", {
      currentURL: window.location.href,
      origin: window.location.origin,
      hostname: window.location.hostname,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      isCustomDomain: window.location.hostname === 'stacktalk.app',
      expectedRedirectURI: `${window.location.origin}/__/auth/handler`,
      firebaseConfigComplete: !!(process.env.NEXT_PUBLIC_FIREBASE_API_KEY && 
                                 process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN && 
                                 process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID && 
                                 process.env.NEXT_PUBLIC_FIREBASE_APP_ID)
    })

    console.log("🚀 Attempting Google sign-in...")
    const result = await signInWithPopup(auth, provider)
    console.log("Google sign in successful:", result.user.email)
    return result.user
  } catch (error) {
    console.error("Google sign in error:", error)
    
    // Enhanced error logging
    console.error("🚨 Detailed Error Info:", {
      errorCode: (error as any)?.code,
      errorMessage: (error as any)?.message,
      currentDomain: window.location.origin,
      firebaseAuthDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      allEnvVars: {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? "SET" : "MISSING",
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "MISSING",
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "MISSING",
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ? "SET" : "MISSING"
      }
    })
    
    // Log additional error details for redirect URI issues
    if (error instanceof Error && error.message.includes("redirect_uri_mismatch")) {
      console.error("🚨 Redirect URI Mismatch Details:", {
        error: error.message,
        currentDomain: window.location.origin,
        expectedRedirectURI: `${window.location.origin}/__/auth/handler`,
        firebaseAuthDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
      })
    }
    // Log details for auth domain configuration errors
    if (error instanceof Error && error.message.includes("auth-domain-config-required")) {
      console.error("🚨 Auth Domain Config Required:", {
        error: error.message,
        currentDomain: window.location.origin,
        firebaseAuthDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        requiredActions: [
          "1. Add this domain to Firebase Console → Authentication → Settings → Authorized domains",
          "2. Add OAuth redirect URIs to Google Cloud Console",
          "3. Verify all environment variables are set in Amplify"
        ]
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
