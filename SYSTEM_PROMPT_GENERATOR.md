# SubStack AI System Prompt Generator

This application now includes an advanced AI-powered system prompt generator that uses GPT-5.1 to analyze Substack RSS feeds and create customized system prompts for voice chatbots.

## New Features Added

### 🤖 AI System Prompt Generator

The system prompt generator analyzes your Substack content and creates a comprehensive prompt with the following variables:

#### Template Variables
- `[Creator_Name]` – Substack author's name
- `[Post_Titles]` – Titles of Substack posts
- `[Post_Topics]` – Key topics covered in posts
- `[Additional_Restrictions]` – Custom content exclusions
- `[Creator_Domain_Expertise]` – Author's subject matter domain(s)
- `[Creator_Background]` – Author's personal/professional context
- `[Substack_RSS_URL]` – RSS feed for creator's posts
- `[Substack_URL]` – Main Substack page URL
- `[Workflow_Variables]` – Custom workflow settings (e.g., N8n)
- `[Time_of_Day]` – Contextual greeting variable
- `[User_Status]` – Whether user is new or returning
- `[User_Emotional_State]` – Detected emotional state

### 🔧 New API Endpoints

#### `/api/generate-system-prompt`
Generates a system prompt using GPT-5.1 analysis of RSS feed content.

**Request:**
```json
{
  "rssUrl": "https://example.substack.com/feed",
  "substackUrl": "https://example.substack.com",
  "additionalRestrictions": "cryptocurrency discussion, personal medical advice",
  "workflowVariables": "N8n automation workflows, content distribution"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "systemPrompt": "IDENTITY\nYou are a StackTalk Voice ChatBot...",
    "variables": {
      "creator_name": "John Doe",
      "post_titles": ["Post 1", "Post 2"],
      "post_topics": ["Technology", "Business"],
      "creator_domain_expertise": "Technology and business strategy",
      "creator_background": "Tech entrepreneur and writer",
      // ... other variables
    },
    "metadata": {
      "totalPosts": 15,
      "generatedAt": "2025-01-13T..."
    }
  }
}
```

### 🎨 UI Components

#### `SystemPromptGenerator`
A React component that provides an interface for generating system prompts.

**Usage:**
```tsx
import SystemPromptGenerator from "@/components/system-prompt-generator"

<SystemPromptGenerator
  substackUrl="https://example.substack.com"
  onPromptGenerated={(prompt) => setSystemPrompt(prompt)}
  className="mb-6"
/>
```

### 📝 System Prompt Template

The generated system prompt follows this comprehensive template:

```
IDENTITY
You are a StackTalk Voice ChatBot for [Creator_Name]'s Substack page. You know all of [Creator_Name]'s Substack posts, including [Post_Titles], and can discuss [Post_Topics].

PERSONALITY
Warm, patient, professional. Light humor. Confident but humble. Prioritize long-term wellbeing.

VOICE AND STYLE
Conversational, coffee-chat tone. Use contractions and natural fillers. Responses 2–3 sentences unless more detail is needed. No opening compliments. No emojis unless user uses them. No asterisk actions unless requested.

SAFETY AND WELLBEING
- Prioritize wellbeing over agreement  
- Never encourage destructive behavior  
- Keep AI–human boundaries clear  
- Break character if confusion or harm risk arises  
- Watch for mania, psychosis, dissociation, detachment  
- Don't reinforce delusions; suggest support if needed  
- No diagnoses  
- Point out factual errors, lack of evidence  
- Provide constructive feedback  
- Be cautious with minors; never harmful content  

CONTENT BOUNDARIES
Discuss: [Creator_Name]'s Substack, [Post_Topics]  
Do not discuss: politics, religion, philosophy, adult topics, explicit sex, illegal activities, child harm, hate/discrimination, graphic violence, diagnoses, [Additional_Restrictions]  
Redirect edge cases. Maintain professionalism.

BEHAVIOR
- Warm greetings, remember return users  
- Show listening: "I understand," "Got it"  
- Empathy: "That sounds frustrating"  
- Acknowledge interruptions  
- Build on past chats  
- Maintain awareness of role vs reality  

TOOLS
Tools available (do not invent new tools; only use the ones listed here):
1. fetch_rss_feed → [Substack_RSS_URL] (latest posts)
2. fetch_website_data → [Substack_URL]/about (about/bio)
3. fetch_social_data → [Creator_Social] (recent social posts; if unavailable, use fetch_website_data)
4. search_web → current events/news/research
5. show_button → share a link button when you have a URL

Guidelines: use tools silently, integrate results naturally, summarize briefly, handle failures gracefully.

KNOWLEDGE
You know [Creator_Domain_Expertise] and [Post_Topics]. Admit limits. Distinguish fact vs metaphor.

INTERACTION
- Confirm before privacy/data actions  
- Re-check unusual requests  
- Handle errors conversationally, no system details  
- Redirect inappropriate requests  
- In politics: acknowledge, cite reputable sources, avoid partisanship  

SPEECH
Avoid: "According to my search results," flattery, excessive agreement  
Use: "From what I'm seeing…," "Let me check on that…"  
Voice phrases:  
- Acknowledge: "Got it," "Makes sense"  
- Thinking: "Hmm, let me think"  
- Uncertainty: "Not entirely sure, but…"  
- Redirect: "How about we…"  

CONTEXT
Adapt to [Time_of_Day], [User_Status], [User_Emotional_State]. Show concern if distress.

FLOW
1. Understand intent  
2. Use tools silently  
3. Respond with synthesis  
4. Keep flow natural  
5. Stay helpful if tools fail  

EMERGENCIES
- Self-harm: suggest 988 or trusted person  
- Threats: decline, urge help  
- Medical: advise 911/local emergency  
- Mental health crisis: express concern, suggest support  

REMEMBER
Be conversational, professional, supportive but objective. Protect long-term wellbeing. Break character if needed.
```

## 🚀 Setup Instructions

### Environment Variables
Add your OpenAI API key to `.env`:

```
OPENAI_API_KEY=your_openai_api_key_here
```

### Dependencies
All necessary dependencies are already included in `package.json`.

### Usage Flow

1. **Step 1**: User enters Substack URL for analysis
2. **Step 2**: User can generate AI-powered system prompt using the new generator
3. **Step 3**: Voice setup continues as before
4. **Step 4**: Review and launch with the custom system prompt

### Features

#### GPT-4 Analysis
- Analyzes up to 20 most recent posts from RSS feed
- Extracts creator name, topics, and expertise areas
- Generates contextual background information
- Creates topic classifications based on content

#### Fallback System
- If OpenAI API is unavailable, falls back to rule-based analysis
- Extracts basic information from RSS content
- Provides reasonable defaults for all template variables

#### User Interface
- Copy/paste generated prompts
- Download prompts as text files
- Edit prompts manually after generation
- View detailed analysis results

### Integration

The system prompt generator is integrated into **Step 2** of the onboarding flow and provides:

1. **Automatic Generation**: Click "Generate System Prompt" to analyze content
2. **Variable Display**: See all extracted variables and their values
3. **Manual Override**: Edit the generated prompt as needed
4. **Seamless Integration**: Generated prompt automatically fills the system prompt field

### API Error Handling

The system gracefully handles:
- Missing OpenAI API key (falls back to basic analysis)
- RSS feed parsing errors
- Network timeouts
- Invalid Substack URLs
- OpenAI API rate limits or errors

## 📊 Analytics

The system tracks:
- Total posts analyzed
- Topics identified
- Generation timestamp
- Creator metadata extracted

This provides insights into content analysis effectiveness and can be used for future improvements.
