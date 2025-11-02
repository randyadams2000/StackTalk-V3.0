"use client"

import type React from "react"
import type { User } from "firebase/auth"

import { createContext, useContext, useEffect, useState } from "react"
import {
  signInWithEmail,
  createUserWithEmail,
  signInWithGoogle,
  signOutUser,
  onAuthStateChange,
  getAuthToken,
} from "@/lib/firebase"

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  error: string | null
  getToken: () => Promise<string | null>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let unsubscribe: (() => void) | null = null

    const setupAuthListener = async () => {
      try {
        console.log("Setting up Firebase auth state listener...")
        unsubscribe = await onAuthStateChange((user) => {
          console.log("Auth state changed:", user?.email || "No user")
          setUser(user)
          setLoading(false)
        })
      } catch (error) {
        console.error("Error setting up auth listener:", error)
        setLoading(false)
      }
    }

    // Only run on client side
    if (typeof window !== "undefined") {
      setupAuthListener()
    } else {
      setLoading(false)
    }

    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    try {
      setError(null)
      setLoading(true)
      console.log("🔐 Firebase sign in:", email)

      const user = await signInWithEmail(email, password)
      if (!user) {
        throw new Error("Sign in failed - no user returned")
      }

      console.log("✅ Sign in successful:", user.email)
    } catch (err) {
      console.error("❌ Sign in error:", err)
      const errorMessage = err instanceof Error ? err.message : "Sign in failed"
      setError(errorMessage)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const signUp = async (email: string, password: string) => {
    try {
      setError(null)
      setLoading(true)
      console.log("📝 Firebase sign up:", email)

      const user = await createUserWithEmail(email, password)
      if (!user) {
        throw new Error("Sign up failed - no user returned")
      }

      console.log("✅ Sign up successful:", user.email)
    } catch (err) {
      console.error("❌ Sign up error:", err)
      const errorMessage = err instanceof Error ? err.message : "Sign up failed"
      setError(errorMessage)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    try {
      setError(null)
      setLoading(true)
      console.log("🔐 Firebase Google sign in")

      const user = await signInWithGoogle()
      if (!user) {
        throw new Error("Google sign in failed - no user returned")
      }

      console.log("✅ Google sign in successful:", user.email)
    } catch (err) {
      console.error("❌ Google sign in error:", err)
      const errorMessage = err instanceof Error ? err.message : "Google sign in failed"
      setError(errorMessage)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    try {
      setError(null)
      console.log("👋 Firebase sign out")
      await signOutUser()
      console.log("✅ Sign out successful")
    } catch (err) {
      console.error("❌ Sign out error:", err)
      const errorMessage = err instanceof Error ? err.message : "Sign out failed"
      setError(errorMessage)
      throw err
    }
  }

  const getToken = async (): Promise<string | null> => {
    try {
      const token = await getAuthToken()
      return token
    } catch (error) {
      console.error("Error getting token:", error)
      return null
    }
  }

  const value = {
    user,
    loading,
    signIn,
    signUp,
    signInWithGoogle: handleGoogleSignIn,
    signOut,
    error,
    getToken,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
