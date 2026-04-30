"""Email alert service — uses stdlib smtplib, no extra dependencies."""
from __future__ import annotations

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any

from app.core.config import get_settings

logger = logging.getLogger(__name__)


def _build_html(
    user_name: str,
    opportunities: list[dict[str, Any]],
    locale: str,
) -> str:
    is_bn = locale == "bn"
    subject_line = "আপনার সেক্টরের নতুন সুযোগ এসেছে!" if is_bn else "New opportunities in your sectors!"
    greeting = f"প্রিয় {user_name}," if is_bn else f"Dear {user_name},"
    intro = (
        "আপনার পছন্দের সেক্টরে নতুন সুযোগ এসেছে। নিচে দেখুন:"
        if is_bn
        else "New opportunities have arrived in your selected sectors. Check them out below:"
    )
    cta_label = "বিস্তারিত দেখুন" if is_bn else "View details"
    country_label = "দেশ" if is_bn else "Country"
    deadline_label = "শেষ তারিখ" if is_bn else "Deadline"
    source_label = "সূত্র" if is_bn else "Source"
    footer_text = "সুযোগ বিডি | আপনার বিদেশি সুযোগের বিশ্বস্ত প্ল্যাটফর্ম"
    unsub_text = (
        "সতর্কতা বন্ধ করতে আপনার অ্যাকাউন্টের Alerts সেটিংস পরিবর্তন করুন"
        if is_bn
        else "To stop alerts, change your Alerts settings in your account"
    )

    opp_blocks = ""
    for opp in opportunities:
        title_en = opp.get("title", "")
        title_bn = opp.get("title_bn", "") or ""
        country = opp.get("country", "") or ""
        deadline = opp.get("deadline", "") or ""
        url = opp.get("url", "#")
        source_name = opp.get("source_name", "") or ""

        title_display = title_bn if (is_bn and title_bn) else title_en
        title_secondary = title_en if (is_bn and title_bn) else ""

        opp_blocks += f"""
        <div style="border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:16px;background:#fff;">
          <p style="margin:0 0 4px;font-size:16px;font-weight:700;color:#1a202c;">{title_display}</p>
          {"<p style='margin:0 0 8px;font-size:13px;color:#718096;'>" + title_secondary + "</p>" if title_secondary else ""}
          <p style="margin:0 0 4px;font-size:13px;color:#4a5568;">
            <strong>{country_label}:</strong> {country}
            {"&nbsp;&nbsp;<strong>" + deadline_label + ":</strong> " + deadline if deadline else ""}
          </p>
          {"<p style='margin:0 0 8px;font-size:12px;color:#718096;'>" + source_label + ": " + source_name + "</p>" if source_name else ""}
          <a href="{url}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:8px 16px;border-radius:6px;font-size:13px;font-weight:600;margin-top:8px;">{cta_label}</a>
        </div>"""

    return f"""<!DOCTYPE html>
<html lang="{'bn' if is_bn else 'en'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>{subject_line}</title>
</head>
<body style="font-family:Arial,sans-serif;background:#f7fafc;margin:0;padding:0;">
  <div style="max-width:600px;margin:32px auto;background:#f7fafc;padding:0 16px;">
    <div style="background:#4f46e5;border-radius:8px 8px 0 0;padding:24px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:22px;">সুযোগ বিডি</h1>
      <p style="color:#c7d2fe;margin:4px 0 0;font-size:13px;">sudokkho.xyz</p>
    </div>
    <div style="background:#fff;padding:24px;border:1px solid #e2e8f0;border-top:none;">
      <p style="font-size:15px;color:#1a202c;margin:0 0 4px;">{greeting}</p>
      <p style="font-size:14px;color:#4a5568;margin:0 0 20px;">{intro}</p>
      {opp_blocks}
    </div>
    <div style="padding:16px;text-align:center;">
      <p style="font-size:12px;color:#718096;margin:0 0 4px;">{footer_text}</p>
      <p style="font-size:11px;color:#a0aec0;margin:0;">{unsub_text}</p>
    </div>
  </div>
</body>
</html>"""


def send_alert_email(
    to_email: str,
    user_name: str,
    opportunities: list[dict[str, Any]],
    locale: str = "bn",
) -> bool:
    """Send HTML alert email via SMTP. Returns True on success."""
    settings = get_settings()
    if not settings.smtp_host:
        logger.warning("email_service_no_smtp_host: SMTP not configured, skipping email to %s", to_email)
        return False

    is_bn = locale == "bn"
    subject = "আপনার সেক্টরের নতুন সুযোগ এসেছে!" if is_bn else "New opportunities in your sectors!"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from
    msg["To"] = to_email

    html_body = _build_html(user_name, opportunities, locale)
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        if settings.smtp_tls:
            server = smtplib.SMTP(settings.smtp_host, settings.smtp_port)
            server.ehlo()
            server.starttls()
            server.ehlo()
        else:
            server = smtplib.SMTP(settings.smtp_host, settings.smtp_port)
        if settings.smtp_user and settings.smtp_password:
            server.login(settings.smtp_user, settings.smtp_password)
        server.sendmail(settings.smtp_from, [to_email], msg.as_string())
        server.quit()
        logger.info("email_sent to=%s subject=%s", to_email, subject)
        return True
    except Exception as exc:
        logger.error("email_send_failed to=%s error=%s", to_email, exc)
        return False
