// Test script for the system prompt generator API
// Run this with: node test-api.js

const testSystemPromptAPI = async () => {
  try {
    console.log('🧪 Testing System Prompt Generator API...')
    
    const response = await fetch('http://localhost:3000/api/generate-system-prompt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rssUrl: 'https://randyadams.substack.com/feed',
        substackUrl: 'https://randyadams.substack.com',
        additionalRestrictions: 'cryptocurrency trading advice',
        workflowVariables: 'N8n automation workflows'
      })
    })

    const data = await response.json()
    
    console.log('📊 API Response Status:', response.status)
    console.log('📋 Response Data:', JSON.stringify(data, null, 2))
    
    if (data.success) {
      console.log('✅ Test Passed!')
      console.log('📝 Generated System Prompt Length:', data.data.systemPrompt.length)
      console.log('👤 Creator Name:', data.data.variables.creator_name)
      console.log('📚 Topics:', data.data.variables.post_topics.join(', '))
      console.log('🎯 Expertise:', data.data.variables.creator_domain_expertise)
    } else {
      console.log('❌ Test Failed:', data.error)
    }
    
  } catch (error) {
    console.error('💥 Test Error:', error.message)
  }
}

// Run the test if this is a Node.js environment
if (typeof window === 'undefined') {
  testSystemPromptAPI()
} else {
  console.log('This test is for Node.js environment only')
}
