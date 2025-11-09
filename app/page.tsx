"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LoginModal } from "@/components/auth/login-modal"
import { useAuth } from "@/components/auth/auth-provider"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Sparkles, MessageSquare, Mic, ArrowRight, CheckCircle, Globe, Zap, Brain, Users } from "lucide-react"

export default function LandingPage() {
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { user, loading, signOut, error } = useAuth()
  const router = useRouter()

  // Ensure component is mounted before accessing auth
  useEffect(() => {
    setMounted(true)
  }, [])

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: "smooth" })
    }
  }

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleGetStarted = () => {
    if (user) {
      // User is already logged in, go directly to onboarding
      router.push("/onboarding/step-1")
    } else {
      // Show login modal
      setShowLoginModal(true)
    }
  }

  const handleLoginSuccess = () => {
    setShowLoginModal(false)
    router.push("/onboarding/step-1")
  }

  const handleLogout = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error("Logout failed:", error)
    }
  }

  const features = [
    {
      icon: <Brain className="h-6 w-6" />,
      title: "AI Content Analysis",
      description: "Analyzes your Substack posts to understand your writing style and expertise",
    },
    {
      icon: <MessageSquare className="h-6 w-6" />,
      title: "Intelligent Chat",
      description: "Chat with your AI twin that responds in your voice and knowledge",
    },
    {
      icon: <Mic className="h-6 w-6" />,
      title: "Voice Cloning",
      description: "Your AI twin can speak with your actual voice using advanced voice synthesis",
    },
    {
      icon: <Globe className="h-6 w-6" />,
      title: "Dynamic Variables",
      description: "Automatically generates system variables for personalized AI responses",
    },
  ]

  const steps = [
    {
      number: 1,
      title: "Connect Substack",
      description: "Enter your Substack URL to analyze your content and generate system variables",
    },
    {
      number: 2,
      title: "Profile Setup",
      description: "Customize your AI twin's personality and response style",
    },
    {
      number: 3,
      title: "Voice Clone",
      description: "Record or upload audio to create your personalized voice clone",
    },
    {
      number: 4,
      title: "AI Twin Ready",
      description: "Your AI twin is ready to chat and respond in your voice and style",
    },
  ]

  // Don't render until mounted to avoid hydration issues
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 mb-4">Authentication Error: {error}</div>
          <Button onClick={() => window.location.reload()} className="bg-purple-600 hover:bg-purple-700">
            Reload Page
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Navigation */}
      <nav className="border-b border-gray-800 fixed w-full top-0 bg-gray-900/95 backdrop-blur-sm z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <button onClick={scrollToTop} className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
                <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">S</span>
                </div>
                <span className="text-xl font-bold">StackTalker</span>
              </button>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <button onClick={scrollToTop} className="text-gray-300 hover:text-white transition-colors cursor-pointer">
                Home
              </button>
              <button
                onClick={() => scrollToSection("features")}
                className="text-gray-300 hover:text-white transition-colors cursor-pointer"
              >
                Features
              </button>
              <button
                onClick={() => scrollToSection("how-it-works")}
                className="text-gray-300 hover:text-white transition-colors cursor-pointer"
              >
                How It Works
              </button>
              
            </div>
            <div className="flex items-center space-x-4">
              {user ? (
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-300">Welcome, {user.displayName || user.email}</span>
                  <Button variant="outline" className="bg-transparent" onClick={handleLogout}>
                    Sign Out
                  </Button>
                </div>
              ) : (
                <>
                  <Button
                    variant="outline"
                    className="bg-transparent border-purple-500 text-purple-400 hover:bg-purple-500/10"
                    onClick={() => setShowLoginModal(true)}
                  >
                    Sign In
                  </Button>
                  
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="pt-20">
        {/* Hero Section */}
        <div className="relative overflow-hidden bg-gray-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-24">
            <div className="text-center">
              <Badge variant="secondary" className="mb-4 bg-purple-100 text-purple-800">
                <Sparkles className="h-3 w-3 mr-1" />
                Your voice. Your knowledge. Your Substack.

              </Badge>

              <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
                Your Substack,
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
                  {" "}
                  now talking back.
                </span>
              </h1>

              <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-8 leading-relaxed">
                Create a personalized voice bot in your own voice that discusses your Substack content and engages readers on a deeper level. Set up in minutes, monetize instantly.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Button
                  onClick={handleGetStarted}
                  disabled={isStarting}
                  size="lg"
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 px-8 py-3 text-lg"
                >
                  {isStarting ? (
                    <>
                      <Zap className="mr-2 h-5 w-5 animate-pulse" />
                      Starting...
                    </>
                  ) : (
                    <>
                      Get Started Free
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </>
                  )}
                </Button>

                <div className="flex items-center text-sm text-gray-400">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  No credit card required
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 bg-gray-900">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">Powerful AI Features</h2>
            <p className="text-lg text-gray-300 max-w-2xl mx-auto">
              Everything you need to create an intelligent AI version of yourself
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow bg-gray-800 border-gray-700">
                <CardHeader>
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600 mb-4">
                    {feature.icon}
                  </div>
                  <CardTitle className="text-lg text-white">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-gray-300">{feature.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* How It Works Section */}
        <section id="how-it-works" className="bg-gray-800 py-24">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-white mb-4">How It Works</h2>
              <p className="text-lg text-gray-300 max-w-2xl mx-auto">Create your AI twin in just 4 simple steps</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {steps.map((step, index) => (
                <div key={index} className="text-center">
                  <div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                    {step.number}
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{step.title}</h3>
                  <p className="text-gray-300 text-sm">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section id="cta" className="bg-gradient-to-r from-purple-600 to-blue-600 py-16">
          <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-white mb-4">Ready to Create Your AI Twin?</h2>
            <p className="text-xl text-purple-100 mb-8 max-w-2xl mx-auto">
              Join Substack creators who are already using AI twins to scale their content and engage with their audience 24/7.
            </p>

            <Button
              onClick={handleGetStarted}
              disabled={isStarting}
              size="lg"
              variant="secondary"
              className="bg-white text-purple-600 hover:bg-gray-100 px-8 py-3 text-lg font-semibold"
            >
              {isStarting ? (
                <>
                  <Zap className="mr-2 h-5 w-5 animate-pulse" />
                  Starting Your Journey...
                </>
              ) : (
                <>
                  Start Building Now
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>

            <div className="flex items-center justify-center mt-6 text-purple-100 text-sm">
              <Users className="h-4 w-4 mr-2" />
              Join other Substack creators already using AI twins
            </div>
          </div>
        </section>
      </div>

      {/* Login Modal */}
      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} onSuccess={handleLoginSuccess} />
    </div>
  )
}
