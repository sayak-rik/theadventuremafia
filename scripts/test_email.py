#!/usr/bin/env python3
"""Quick SMTP check: reads .env and sends a test email."""
import os
import smtplib
import sys
from email.message import EmailMessage
from pathlib import Path


def load_env(path=".env"):
    for line in Path(path).read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, val = line.split("=", 1)
        os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))


def main():
    load_env()
    host = os.environ["SMTP_HOST"]
    port = int(os.environ.get("SMTP_PORT", 587))
    user = os.environ["SMTP_USER"]
    password = os.environ["SMTP_PASS"]
    secure = os.environ.get("SMTP_SECURE", "false").lower() in ("1", "true", "yes")
    mail_from = os.environ.get("MAIL_FROM", user)
    to = "sayak.roy@algo-one.com"

    msg = EmailMessage()
    msg["Subject"] = "SMTP test email"
    msg["From"] = mail_from
    msg["To"] = to
    msg.set_content("This is a test email to verify SMTP is working correctly.")

    print(f"Connecting to {host}:{port} (secure={secure}) as {user} -> {to}")
    if secure:
        server = smtplib.SMTP_SSL(host, port)
    else:
        server = smtplib.SMTP(host, port)
        server.starttls()
    with server:
        server.login(user, password)
        server.send_message(msg)
    print("Test email sent successfully.")


if __name__ == "__main__":
    main()
