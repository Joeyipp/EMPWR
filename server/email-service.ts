import sgMail from '@sendgrid/mail';

/**
 * Email service for sending emails using SendGrid
 */
export class EmailService {
  private initialized = false;

  constructor() {
    // Initialize SendGrid if API key is available
    if (process.env.SENDGRID_API_KEY) {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      this.initialized = true;
      console.log('SendGrid email service initialized');
    } else {
      console.warn('SendGrid API key not found. Email service will not work.');
    }
  }

  /**
   * Send a contact form email
   * @param name Sender's name
   * @param email Sender's email
   * @param message Message content
   * @param subject Optional subject line
   * @returns Promise that resolves to true if the email was sent successfully
   */
  async sendContactEmail(
    name: string,
    email: string,
    message: string,
    subject: string = 'New Contact Form Submission'
  ): Promise<boolean> {
    if (!this.initialized) {
      console.error('Cannot send email: SendGrid not initialized');
      return false;
    }

    try {
      // Always send to the configured recipient
      const toEmail = 'joey@knoesis.org';
      
      const msg = {
        to: toEmail,
        from: 'noreply@empwr.ai', // This should be a verified sender in your SendGrid account
        subject: subject,
        text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
        html: `
          <strong>Name:</strong> ${name}<br>
          <strong>Email:</strong> ${email}<br>
          <br>
          <strong>Message:</strong><br>
          ${message.replace(/\n/g, '<br>')}
        `,
      };

      await sgMail.send(msg);
      console.log(`Contact email sent successfully to ${toEmail}`);
      return true;
    } catch (error) {
      console.error('Error sending contact email:', error);
      return false;
    }
  }
}

// Export a singleton instance
export const emailService = new EmailService();