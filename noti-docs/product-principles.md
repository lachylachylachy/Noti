# Product Principles

## 1. Threads Are the Core

Threads are the primary object in Noti.

A thread can represent:

- a note
- a task
- a plan
- a coding idea
- a calendar-linked item
- a project decision
- a reminder
- a captured thought

Workspaces are different ways of viewing or acting on threads, not separate disconnected apps.

## 2. Context Shapes the Workspace

The workspace should adapt based on the active thread or user intent.

Examples:

- Coding thread → Code Space appears
- Planning thread → calendar/timeline tools appear
- Reminder thread → reminder controls appear
- Project thread → board or structured view appears
- Meeting/event thread → calendar context appears

The user should not manually assemble their workspace every time. The environment should offer subtle contextual affordances.

## 3. Suggestions Stay Quiet

AI and integrations should be helpful but not dominant.

Good:

- subtle inline chips
- optional actions
- low-visual-weight prompts
- contextual suggestions beneath the composer

Avoid:

- popups
- aggressive assistant panels
- forced automation
- AI taking over the workflow
- noisy recommendations

## 4. Local-First Before Cloud-First

The early product should prioritise a reliable local desktop experience.

Build first:

- local persistence
- stable thread model
- clean state architecture
- consistent workspace rendering

Add later:

- cloud sync
- accounts
- collaboration
- multi-device state

## 5. Familiar, Then Better

Noti should use familiar patterns where useful, then improve them.

Examples:

- Calendar can start from Apple Calendar readability
- Code Space can start from VS Code familiarity
- Threads can borrow conversational flow from ChatGPT
- Boards can borrow clarity from Trello/Linear

The goal is not novelty for novelty’s sake.

## 6. Reduce Cognitive Switching

Noti should reduce the feeling of jumping between tools.

A user should be able to move from thought → plan → code → reminder → calendar context without losing continuity.

## 7. Avoid Feature Pileup

Every feature must have a clear role in the workspace.

Do not add features simply because other productivity apps have them.
