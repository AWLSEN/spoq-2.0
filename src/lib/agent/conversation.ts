/**
 * Turn a client-side conversation history into a single prompt string
 * for a one-shot `claude -p` invocation. Multi-turn is achieved by
 * re-invoking with the growing history.
 */

export interface ConversationMessage {
  role: "user" | "agent";
  text: string;
}

export function flattenConversation(messages: ConversationMessage[]): string {
  if (messages.length === 1 && messages[0].role === "user") {
    return messages[0].text;
  }
  const lines: string[] = [];
  for (const m of messages) {
    if (m.role === "user") {
      lines.push(`User: ${m.text}`);
    } else {
      lines.push(`You: ${m.text}`);
    }
  }
  lines.push("You:");
  return lines.join("\n\n");
}
