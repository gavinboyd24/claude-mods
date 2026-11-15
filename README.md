# claude-mods

Three Claude Code mods by gavinboyd24.

- **model-router**: picks Haiku, Sonnet or Opus for each message. Commands: `/router auto`, `/router off`, `/router haiku`, `/router sonnet`, `/router opus`.
- **dashboard**: a to-do list, your active plugins and mods, and skills you can use. Commands: `/todo add <thing>`, `/todo done <n>`, `/panel`.
- **buddy**: a little orange buddy above your prompt. Commands: `/buddy hide`, `/buddy show`.

## Install (in Terminal, one line per mod)

```bash
claude plugin marketplace add gavinboyd24/claude-mods
```

```bash
claude plugin install model-router@claude-mods
```

```bash
claude plugin install dashboard@claude-mods
```

```bash
claude plugin install buddy@claude-mods
```

Private repo: the install works only if your Mac is signed in to GitHub.
