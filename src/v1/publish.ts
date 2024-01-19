import type { RequestHandler } from 'express';
import type { JSONSchema7 } from 'json-schema';

import ajv from '../ajv';
import { saveSms, Sms, Type } from '../store';

const handler: RequestHandler = async (req, res) => {
  const valid = validate(req.body);
  if (!valid) {
    res.status(404).send({ message: 'Bad Request Exception', detail: 'aws-ses-v2-local: Schema validation failed' });
    return;
  }

  const messageId = `sns-${Math.floor(Math.random() * 900000000 + 100000000)}`;

  const sms: Sms = {
    type: Type.Sms,
    messageId,
    message: req.body.Message,
    phoneNumber: req.body.PhoneNumber,
    at: Math.floor(new Date().getTime() / 1000),
  };

  saveSms(sms);

  res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?><PublishResponse xmlns="http://sns.amazonaws.com/doc/2010-03-31/"><PublishResult><MessageId>${messageId}</MessageId></PublishResult></PublishResponse>`);
};

export default handler;

const sendEmailRequestSchema: JSONSchema7 = {
  type: 'object',
  properties: {
    Action: { type: 'string', pattern: '^Publish$' },
    Version: { type: 'string' },

    Message: { type: 'string' },
    PhoneNumber: { type: 'string', format: 'phone-number' },
  },
  required: ['Message', 'PhoneNumber'],
};

const validate = ajv.compile(sendEmailRequestSchema);
