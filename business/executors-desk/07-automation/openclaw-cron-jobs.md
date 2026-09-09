# OpenClaw cron jobs

If you run OpenClaw (this repo), the skill in `openclaw-skill/executors-desk-ops/` replaces n8n for jobs 6 to 9 and 11 in `automation-map.md`. Copy the skill folder into your OpenClaw workspace skills directory, set the env vars listed in its frontmatter, then add the jobs below. Delivery goes to whatever channel you use (WhatsApp, Telegram, Slack); replace `--channel`/`--to`.

```bash
# Daily pin at 09:10 local time
openclaw cron add --name "exec-desk pin-daily" --cron "10 9 * * *" --tz "America/New_York" \
  --session isolated --message "Use the executors-desk-ops skill: run job 1 (daily pin). Report one line." \
  --announce --channel telegram --to "<owner-chat-id>"

# Weekly article draft, Monday 06:00
openclaw cron add --name "exec-desk article-weekly" --cron "0 6 * * 1" --tz "America/New_York" \
  --session isolated --message "Use the executors-desk-ops skill: run job 2 (weekly article draft). Do not publish; ask me to approve." \
  --announce --channel telegram --to "<owner-chat-id>"

# Weekly KPI report, Sunday 18:00
openclaw cron add --name "exec-desk weekly-report" --cron "0 18 * * 0" --tz "America/New_York" \
  --session isolated --message "Use the executors-desk-ops skill: run job 3 (weekly report) and send me the summary." \
  --announce --channel telegram --to "<owner-chat-id>"

# Weekly Etsy check, Wednesday 08:00
openclaw cron add --name "exec-desk weekly-etsy-check" --cron "0 8 * * 3" --tz "America/New_York" \
  --session isolated --message "Use the executors-desk-ops skill: run job 4 (Etsy check). Propose changes; do not apply." \
  --announce --channel telegram --to "<owner-chat-id>"

# Support triage every hour during the day
openclaw cron add --name "exec-desk support-hourly" --cron "0 8-20 * * *" --tz "America/New_York" \
  --session isolated --message "Use the executors-desk-ops skill: run job 5 (support triage) on unread help@ mail." \
  --announce --channel telegram --to "<owner-chat-id>"
```

Or wire the Gmail push hook (docs/automation/gmail-pubsub.md) to trigger job 5 on arrival instead of hourly.

Approval flow: when the article job messages you, reply "publish B4" in the same chat; the main session picks it up and the skill moves the file to `status: published` and posts it through systeme.io's blog API (or tells you to paste it, if the API is not enabled on your plan).
