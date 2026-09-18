#!/usr/bin/env python3
"""
Reads data/tasks.json (kept up to date by the app's multi-device sync) and
emails a morning digest: overdue tasks, tasks due today, and tasks due this
week.

Scheduled twice in the workflow (7h and 8h UTC) to cover both sides of
Daylight Saving Time — this script checks the real Paris-local hour and
only sends once, at the right moment, skipping the other trigger.

Required env vars:
  GMAIL_ADDRESS       the Gmail account to send from
  GMAIL_APP_PASSWORD  a 16-char Gmail "App Password" (not the normal password)
  DIGEST_RECIPIENT    who receives the digest (e.g. tom.remy@selfee.fr)

Optional env vars:
  TASKS_PATH    path to the synced tasks file (default: data/tasks.json)
  SEND_HOUR     Paris-local hour to actually send at (default: 9)
"""
import html
import json
import os
import smtplib
from datetime import date, datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from zoneinfo import ZoneInfo

GMAIL_ADDRESS = os.environ["GMAIL_ADDRESS"]
GMAIL_APP_PASSWORD = os.environ["GMAIL_APP_PASSWORD"]
RECIPIENT = os.environ["DIGEST_RECIPIENT"]
TASKS_PATH = os.environ.get("TASKS_PATH", "data/tasks.json")
SEND_HOUR = int(os.environ.get("SEND_HOUR", "9"))


def load_tasks():
    if not os.path.exists(TASKS_PATH):
        return []
    with open(TASKS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def bucket_tasks(tasks, today):
    open_tasks = [t for t in tasks if not t.get("archived") and not t.get("deleted")]
    overdue, due_today, due_week = [], [], []
    for t in open_tasks:
        due_str = t.get("due")
        if not due_str:
            continue
        try:
            due_date = date.fromisoformat(due_str)
        except ValueError:
            continue
        diff = (due_date - today).days
        if diff < 0:
            overdue.append(t)
        elif diff == 0:
            due_today.append(t)
        elif diff <= 7:
            due_week.append(t)
    return overdue, due_today, due_week, len(open_tasks)


def format_task_line(t):
    client = t.get("client") or ""
    project = t.get("project") or ""
    tag = " / ".join(x for x in [client, project] if x)
    suffix = f" — {tag}" if tag else ""
    return f"  - {t.get('title', '(sans titre)')}{suffix}"


def build_body(overdue, due_today, due_week, total_open, today):
    lines = [f"Bilan du {today.strftime('%d/%m/%Y')}", ""]

    def section(title, items):
        if not items:
            return
        lines.append(f"{title} ({len(items)})")
        lines.extend(format_task_line(t) for t in items)
        lines.append("")

    section("En retard", overdue)
    section("Dues aujourd'hui", due_today)
    section("Cette semaine", due_week)

    if not overdue and not due_today and not due_week:
        lines.append("Rien d'urgent pour le moment.")
        lines.append("")

    lines.append(f"Total tâches ouvertes : {total_open}")
    return "\n".join(lines)


def main():
    paris_now = datetime.now(ZoneInfo("Europe/Paris"))
    if paris_now.hour != SEND_HOUR:
        print(f"Il est {paris_now.hour}h a Paris, pas {SEND_HOUR}h — on saute ce declenchement.")
        return

    tasks = load_tasks()
    today = paris_now.date()
    overdue, due_today, due_week, total_open = bucket_tasks(tasks, today)

    subject = f"Bilan taches — {len(overdue)} en retard, {len(due_today)} aujourd'hui"
    body = build_body(overdue, due_today, due_week, total_open, today)

    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = subject
    msg["From"] = GMAIL_ADDRESS
    msg["To"] = RECIPIENT

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(GMAIL_ADDRESS, GMAIL_APP_PASSWORD)
        server.send_message(msg)

    print(f"Digest envoye a {RECIPIENT}")


if __name__ == "__main__":
    main()
