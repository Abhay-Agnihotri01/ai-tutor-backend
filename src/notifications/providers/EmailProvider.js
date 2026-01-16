class EmailProvider {
  constructor() {
    this.provider = process.env.EMAIL_PROVIDER || 'smtp';
  }

  async sendEmail(to, subject, html, text = null) {
    switch (this.provider) {
      case 'smtp':
        return await this.sendViaSMTP(to, subject, html, text);
      case 'sendgrid':
        return await this.sendViaSendGrid(to, subject, html, text);
      case 'mailgun':
        return await this.sendViaMailgun(to, subject, html, text);
      default:
        throw new Error(`Unsupported email provider: ${this.provider}`);
    }
  }

  async sendViaSMTP(to, subject, html, text) {
    const nodemailer = await import('nodemailer');
    
    const transporter = nodemailer.default.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    const mailOptions = {
      from: `"LearnHub" <${process.env.SMTP_USER}>`,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, '')
    };

    return await transporter.sendMail(mailOptions);
  }

  async sendViaSendGrid(to, subject, html, text) {
    const sgMail = await import('@sendgrid/mail');
    sgMail.default.setApiKey(process.env.SENDGRID_API_KEY);

    const msg = {
      to: Array.isArray(to) ? to : [to],
      from: process.env.SMTP_USER,
      subject,
      text: text || html.replace(/<[^>]*>/g, ''),
      html
    };

    return await sgMail.default.send(msg);
  }

  async sendViaMailgun(to, subject, html, text) {
    const formData = await import('form-data');
    const Mailgun = await import('mailgun.js');
    
    const mailgun = new Mailgun.default(formData.default);
    const mg = mailgun.client({
      username: 'api',
      key: process.env.MAILGUN_API_KEY
    });

    return await mg.messages.create(process.env.MAILGUN_DOMAIN, {
      from: `LearnHub <noreply@${process.env.MAILGUN_DOMAIN}>`,
      to: Array.isArray(to) ? to : [to],
      subject,
      text: text || html.replace(/<[^>]*>/g, ''),
      html
    });
  }

  async sendBulkEmail(recipients, subject, html, text = null) {
    const results = [];
    const batchSize = 50; // Process in batches to avoid rate limits

    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      const batchPromises = batch.map(recipient => 
        this.sendEmail(recipient, subject, html, text)
          .catch(error => ({ error, recipient }))
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Add delay between batches
      if (i + batchSize < recipients.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }
}

export default EmailProvider;