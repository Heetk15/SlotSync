import logging

logger = logging.getLogger("email_service")

async def send_email(to_email: str, subject: str, body: str):
    """
    Mock email service that logs the email to the terminal.
    In a real production app, this would use an SMTP client, SendGrid, Resend, etc.
    """
    email_content = f"""
    ==================================================
    [MOCK EMAIL DISPATCH]
    TO:      {to_email}
    SUBJECT: {subject}
    --------------------------------------------------
    {body}
    ==================================================
    """
    # Print it to the console so it's highly visible in Docker logs
    print(email_content)
    # Also log it for good measure
    logger.info(f"Email successfully dispatched to {to_email}")
