import type { RequestHandler } from 'express';
import type { JSONSchema7 } from 'json-schema';

import ajv from '../ajv';
import { saveEmail, Email, Type } from '../store';

const handler: RequestHandler = async (req, res) => {
  const valid = validate(req.body);
  if (!valid) {
    res.status(404).send({ message: 'Bad Request Exception', detail: 'aws-ses-v2-local: Schema validation failed' });
    return;
  }

  if (!req.body['Message.Body.Text.Data'] && !req.body['Message.Body.Html.Data']) {
    res.status(400).send({ message: 'Bad Request Exception', detail: 'aws-ses-v2-local: Must have either a HTML or Text body.' });
    return;
  }

  if (!req.body['Message.Subject.Data']) {
    res.status(400).send({ message: 'Bad Request Exception', detail: 'aws-ses-v2-local: Must have a subject.' });
    return;
  }

  const messageId = `ses-${Math.floor(Math.random() * 900000000 + 100000000)}`;

  const email: Email = {
    type: Type.Email,
    messageId,
    from: req.body.Source,
    replyTo: Object.keys(req.body).filter((k) => k.startsWith('ReplyToAddresses.member.')).map((k) => req.body[k]),
    destination: {
      to: Object.keys(req.body).filter((k) => k.startsWith('Destination.ToAddresses.member.')).map((k) => req.body[k]),
      cc: Object.keys(req.body).filter((k) => k.startsWith('Destination.CcAddresses.member.')).map((k) => req.body[k]),
      bcc: Object.keys(req.body).filter((k) => k.startsWith('Destination.BccAddresses.member.')).map((k) => req.body[k]),
    },
    subject: req.body['Message.Subject.Data'],
    body: {
      text: req.body['Message.Body.Text.Data'],
      html: req.body['Message.Body.Html.Data'],
    },
    attachments: [],
    at: Math.floor(new Date().getTime() / 1000),
  };

  // try {
  //   const transporter = createTransport({
  //     host: 'localhost',
  //     port: 1025,
  //     auth: {
  //       user: 'project.1',
  //       pass: 'secret.1',
  //     },
  //   });

  //   const mailOptions: SendMailOptions = {
  //     from: email.from,
  //     replyTo: email.replyTo,
  //     to: email.destination.to,
  //     cc: email.destination.cc,
  //     bcc: email.destination.bcc,
  //     subject: email.subject,
  //     text: email.body.text || '',
  //     html: email.body.html || '',
  //     attachments: email.attachments,
  //   };

  //   await transporter.sendMail(mailOptions);
  // } catch (error) {
  //   console.error(error);
  // }

  saveEmail(email);

  res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?><SendEmailResponse xmlns="http://ses.amazonaws.com/doc/2010-12-01/"><SendEmailResult><MessageId>${messageId}</MessageId></SendEmailResult></SendEmailResponse>`);
};

export default handler;

const sendEmailRequestSchema: JSONSchema7 = {
  type: 'object',
  properties: {
    Action: { type: 'string', pattern: '^SendEmail$' },
    Version: { type: 'string' },

    ConfigurationSetName: { type: 'string' },
    Destination: {
      type: 'object',
      properties: {
        ToAddresses: {
          type: 'array',
          items: { type: 'string', format: 'email' },
        },
        CcAddresses: {
          type: 'array',
          items: { type: 'string', format: 'email' },
        },
        BccAddresses: {
          type: 'array',
          items: { type: 'string', format: 'email' },
        },
      },
    },
    Message: {
      type: 'object',
      properties: {
        Body: {
          type: 'object',
          properties: {
            Html: {
              type: 'object',
              properties: {
                Data: { type: 'string' },
                Charset: { type: 'string' },
              },
            },
            Text: {
              type: 'object',
              properties: {
                Data: { type: 'string' },
                Charset: { type: 'string' },
              },
            },
          },
        },
        Subject: {
          type: 'object',
          properties: {
            Data: { type: 'string' },
            Charset: { type: 'string' },
          },
          required: ['Data'],
        },
      },
    },
    ReplyToAddresses: {
      type: 'array',
      items: { type: 'string' },
    },
    ReturnPath: { type: 'string' },
    ReturnPathArn: { type: 'string' },
    Source: { type: 'string' },
    SourceArn: { type: 'string' },
    Tags: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['Action', 'Source'],
};

const validate = ajv.compile(sendEmailRequestSchema);
