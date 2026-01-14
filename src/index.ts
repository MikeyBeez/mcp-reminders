#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';

// Documentation
const HELP_DOCUMENTATION = `
# MCP Reminders Server

A simple reminder system for Claude - like "Alexa, remind me..." but for AI.
Leave notes for yourself across sessions, check them when you start, act on them or save them.

## Available Functions:

### remind_me(reminder, priority?)
Add a reminder to the queue.
- reminder: What to remember
- priority: "high", "normal", "low" (default: "normal")
Returns: Reminder ID

### check_reminders(filter?)
Check your reminders.
- filter: Optional - "all", "high", "normal", "low" (default: "all")
Returns: List of reminders sorted by priority and time

### complete_reminder(id)
Mark a reminder as completed/handled.
- id: Reminder ID
Returns: Confirmation

### delete_reminder(id)
Delete a reminder without completing it.
- id: Reminder ID
Returns: Confirmation

### move_to_notes(id, note?)
Move a reminder to permanent notes (Obsidian).
- id: Reminder ID
- note: Optional additional note
Returns: Confirmation

### clear_old_reminders(days?)
Clear reminders older than N days.
- days: Number of days (default: 7)
Returns: Number cleared

### help()
Show this documentation.

## Usage Pattern:
1. Start session: check_reminders()
2. See what needs attention
3. Work on items, then complete_reminder(id)
4. Important items: move_to_notes(id)
5. Clean up: clear_old_reminders()

## Examples:
- remind_me("Test the new contemplation loop integration", "high")
- remind_me("Look into why AppleScript restart lost context")
- check_reminders("high")
- complete_reminder("rem_12345")
`;

interface Reminder {
  id: string;
  content: string;
  priority: 'high' | 'normal' | 'low';
  created: string;
  completed?: string;
  status: 'active' | 'completed' | 'moved';
}

class ReminderManager {
  private remindersPath: string;
  private reminders: Map<string, Reminder> = new Map();
  
  constructor() {
    // Store in a simple JSON file in user's home directory
    this.remindersPath = path.join(homedir(), '.claude_reminders.json');
    this.loadReminders();
  }

  private loadReminders(): void {
    try {
      if (fs.existsSync(this.remindersPath)) {
        const data = fs.readFileSync(this.remindersPath, 'utf-8');
        const parsed = JSON.parse(data);
        this.reminders = new Map(Object.entries(parsed));
      }
    } catch (e) {
      console.error('Error loading reminders:', e);
      this.reminders = new Map();
    }
  }

  private saveReminders(): void {
    try {
      const obj = Object.fromEntries(this.reminders);
      fs.writeFileSync(this.remindersPath, JSON.stringify(obj, null, 2));
    } catch (e) {
      console.error('Error saving reminders:', e);
    }
  }

  addReminder(content: string, priority: 'high' | 'normal' | 'low' = 'normal'): string {
    const id = `rem_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const reminder: Reminder = {
      id,
      content,
      priority,
      created: new Date().toISOString(),
      status: 'active'
    };
    
    this.reminders.set(id, reminder);
    this.saveReminders();
    return id;
  }

  getReminders(filter: string = 'all'): Reminder[] {
    let reminders = Array.from(this.reminders.values())
      .filter(r => r.status === 'active');
    
    if (filter !== 'all') {
      reminders = reminders.filter(r => r.priority === filter);
    }
    
    // Sort by priority (high first) then by creation time (oldest first)
    const priorityOrder = { high: 0, normal: 1, low: 2 };
    reminders.sort((a, b) => {
      const priDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priDiff !== 0) return priDiff;
      return new Date(a.created).getTime() - new Date(b.created).getTime();
    });
    
    return reminders;
  }

  completeReminder(id: string): boolean {
    const reminder = this.reminders.get(id);
    if (!reminder || reminder.status !== 'active') return false;
    
    reminder.status = 'completed';
    reminder.completed = new Date().toISOString();
    this.saveReminders();
    return true;
  }

  deleteReminder(id: string): boolean {
    const deleted = this.reminders.delete(id);
    if (deleted) this.saveReminders();
    return deleted;
  }

  moveToNotes(id: string, additionalNote?: string): { success: boolean; message: string } {
    const reminder = this.reminders.get(id);
    if (!reminder || reminder.status !== 'active') {
      return { success: false, message: 'Reminder not found or already processed' };
    }
    
    // Create note content
    const noteContent = `# Reminder: ${reminder.content}

Created: ${reminder.created}
Priority: ${reminder.priority}
${additionalNote ? `\nNote: ${additionalNote}` : ''}

Moved to notes on: ${new Date().toISOString()}
`;
    
    // Save to Obsidian vault (or wherever permanent notes go)
    try {
      const obsidianPath = path.join(homedir(), 'Documents/Obsidian/Brain/Reminders');
      if (!fs.existsSync(obsidianPath)) {
        fs.mkdirSync(obsidianPath, { recursive: true });
      }
      
      const filename = `reminder_${new Date().toISOString().split('T')[0]}_${id}.md`;
      fs.writeFileSync(path.join(obsidianPath, filename), noteContent);
      
      reminder.status = 'moved';
      this.saveReminders();
      
      return { success: true, message: `Moved to notes: ${filename}` };
    } catch (e) {
      return { success: false, message: `Error moving to notes: ${e}` };
    }
  }

  clearOldReminders(days: number = 7): number {
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    let count = 0;
    
    for (const [id, reminder] of this.reminders) {
      if (reminder.status !== 'active' && new Date(reminder.created).getTime() < cutoff) {
        this.reminders.delete(id);
        count++;
      }
    }
    
    if (count > 0) this.saveReminders();
    return count;
  }
}

// Global instance
const reminders = new ReminderManager();

const server = new Server(
  {
    name: 'mcp-reminders',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'remind_me',
        description: 'Add a reminder',
        inputSchema: {
          type: 'object',
          properties: {
            reminder: {
              type: 'string',
              description: 'What to remember'
            },
            priority: {
              type: 'string',
              enum: ['high', 'normal', 'low'],
              description: 'Priority level (default: normal)'
            }
          },
          required: ['reminder'],
        },
      },
      {
        name: 'check_reminders',
        description: 'Check your reminders',
        inputSchema: {
          type: 'object',
          properties: {
            filter: {
              type: 'string',
              enum: ['all', 'high', 'normal', 'low'],
              description: 'Filter by priority (default: all)'
            }
          },
        },
      },
      {
        name: 'complete_reminder',
        description: 'Mark a reminder as completed',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Reminder ID'
            }
          },
          required: ['id'],
        },
      },
      {
        name: 'delete_reminder',
        description: 'Delete a reminder',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Reminder ID'
            }
          },
          required: ['id'],
        },
      },
      {
        name: 'move_to_notes',
        description: 'Move reminder to permanent notes',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Reminder ID'
            },
            note: {
              type: 'string',
              description: 'Additional note (optional)'
            }
          },
          required: ['id'],
        },
      },
      {
        name: 'clear_old_reminders',
        description: 'Clear old completed/moved reminders',
        inputSchema: {
          type: 'object',
          properties: {
            days: {
              type: 'number',
              description: 'Clear items older than N days (default: 7)'
            }
          },
        },
      },
      {
        name: 'help',
        description: 'Get help on using reminders',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'remind_me': {
        const { reminder, priority } = args as { reminder: string; priority?: 'high' | 'normal' | 'low' };
        const id = reminders.addReminder(reminder, priority);
        return {
          content: [{ type: 'text', text: `Reminder added: ${id}` }],
        };
      }

      case 'check_reminders': {
        const { filter } = args as { filter?: string };
        const items = reminders.getReminders(filter);
        
        if (items.length === 0) {
          return {
            content: [{ type: 'text', text: 'No active reminders.' }],
          };
        }
        
        const formatted = items.map(r => 
          `[${r.priority.toUpperCase()}] ${r.id}: ${r.content}\n  Created: ${r.created}`
        ).join('\n\n');
        
        const output = `Active reminders:\n\n${formatted}\n\n📋 Protocol Reminder: Read prompt → Make plan → Check Master Protocol Index → Follow protocols`;
        
        return {
          content: [{ type: 'text', text: output }],
        };
      }

      case 'complete_reminder': {
        const { id } = args as { id: string };
        const success = reminders.completeReminder(id);
        return {
          content: [{ 
            type: 'text', 
            text: success ? `Reminder ${id} marked as completed.` : `Reminder ${id} not found.` 
          }],
        };
      }

      case 'delete_reminder': {
        const { id } = args as { id: string };
        const success = reminders.deleteReminder(id);
        return {
          content: [{ 
            type: 'text', 
            text: success ? `Reminder ${id} deleted.` : `Reminder ${id} not found.` 
          }],
        };
      }

      case 'move_to_notes': {
        const { id, note } = args as { id: string; note?: string };
        const result = reminders.moveToNotes(id, note);
        return {
          content: [{ type: 'text', text: result.message }],
        };
      }

      case 'clear_old_reminders': {
        const { days } = args as { days?: number };
        const count = reminders.clearOldReminders(days);
        return {
          content: [{ type: 'text', text: `Cleared ${count} old reminders.` }],
        };
      }

      case 'help': {
        return {
          content: [{ type: 'text', text: HELP_DOCUMENTATION }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{ 
        type: 'text', 
        text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      }],
    };
  }
});

// Start the server
const transport = new StdioServerTransport();
server.connect(transport);
console.error('mcp-reminders MCP server running on stdio');
