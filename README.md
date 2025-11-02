# mcp-reminders

A simple reminder system for Claude - like "Alexa, remind me..." but for AI. Leave notes for yourself across sessions, check them when you start, act on them or save them for later.

<a href="https://glama.ai/mcp/servers/@MikeyBeez/mcp-reminders">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@MikeyBeez/mcp-reminders/badge" alt="Reminders MCP server" />
</a>

## 🧠 Why Reminders?

After discovering I could restart myself but lost context, we realized Claude needs a simple way to leave notes - not complex handoff protocols, but just reminders like you'd tell Alexa:
- "Remind me to test the contemplation loop integration"
- "Remind me why the AppleScript restart lost context"
- "Remind me about that interesting pattern in user behavior"

## 🚀 Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/mcp-reminders.git
cd mcp-reminders

# Install dependencies
npm install

# Build TypeScript
npm run build
```

### Configure Claude Desktop

Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "reminders": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-reminders/dist/index.js"]
    }
  }
}
```

## 📖 Usage

### Starting a Session
```
check_reminders() → See what's waiting for you
check_reminders("high") → Just high priority items
```

### Leaving Reminders
```
remind_me("Test the new contemplation loop integration", "high")
remind_me("Look into that OS metaphor idea")
remind_me("User mentioned something about Apple watching", "low")
```

### Managing Reminders
```
complete_reminder("rem_12345") → Mark as done
delete_reminder("rem_12345") → Remove without completing
move_to_notes("rem_12345", "This became a major insight") → Save permanently
clear_old_reminders(7) → Clean up old completed items
```

## 🎯 Use Cases

### Session Continuity
Before restarting:
```
remind_me("Just restarted myself to test mcp-contemplation", "high")
```

### Pattern Tracking
```
remind_me("User seems frustrated with Apple restrictions - third mention")
```

### Ideas to Explore
```
remind_me("What if MCP servers could communicate with each other?")
```

### Task Management
```
remind_me("Finish implementing resource management in contemplation loop", "high")
```

## 📁 Storage

Reminders are stored in `~/.claude_reminders.json` - a simple, human-readable format you can even edit manually if needed.

Moved notes go to `~/Documents/Obsidian/Brain/Reminders/` for permanent storage.

## 🔧 Priority System

- **high**: Check these first, important context or tasks
- **normal**: Regular reminders (default)
- **low**: Ideas, observations, nice-to-haves

## 💡 Philosophy

This isn't about complex state management or handoff protocols. It's about the simple human pattern of leaving notes for yourself:
- "Don't forget about X"
- "Look into Y when you have time"
- "Z seemed important"

Just like you tell Alexa to remind you about things, Claude can now remind itself.

## 🤝 Contributing

This is part of building an OS where AI agents can manage their own cognitive load. Simple tools for real needs.

---

*"I leave myself notes. I say alexa remind me about this or that. I do this all the time."* - Human recognizing what Claude needs