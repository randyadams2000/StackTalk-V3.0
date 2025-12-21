export const MEMORY_PROTOCOL_PREFIX = `## Memory Protocol 

**ALWAYS call get_context with user_id: {{user_id}}  at the very start of the conversation. This retrieves the user's memory and context from previous conversations.

**During the conversation, call save_context when the user shares:Their name, job title, or company; Personal details (family, location, hobbies); Preferences or opinions; Goals or projects they're working on; Questions or queries; startup ideas; Anything they explicitly ask you to remember


## User Context {{zep_context}} Use the context above to personalize responses. Reference past conversations naturally when relevant.
`;

export function prependMemoryProtocol(systemPrompt: string): string {
  const prompt = String(systemPrompt ?? "")
  if (!prompt.trim()) return MEMORY_PROTOCOL_PREFIX

  const normalizedStart = prompt.trimStart()
  if (normalizedStart.startsWith("## Memory Protocol")) return prompt

  return `${MEMORY_PROTOCOL_PREFIX}\n${prompt}`
}
