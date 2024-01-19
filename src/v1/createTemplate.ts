import type { RequestHandler } from 'express';
import type { JSONSchema7 } from 'json-schema';

import ajv from '../ajv';
import { TemplateV1, hasTemplate, setTemplate } from '../store';

const handler: RequestHandler = async (req, res) => {
  const valid = validate(req.body);
  if (!valid) {
    res.status(404).send({ message: 'Bad Request Exception', detail: 'aws-ses-v2-local: Schema validation failed' });
    return;
  }

  const templateName = req.body['Template.TemplateName'];
  if (!hasTemplate(templateName)) {
    res.status(400).send({ type: 'BadRequestException', message: 'Bad Request Exception', detail: `aws-ses-v2-local: Unable to find the template: ${templateName}.` });
    return;
  }

  const template: TemplateV1 = {
    templateName: req.body['Template.TemplateName'],
    subjectPart: req.body['Template.SubjectPart'],
    textPart: req.body['Template.TextPart'],
    htmlPart: req.body['Template.HtmlPart'],
  };

  setTemplate(template.templateName, template);

  res.status(200).send('<?xml version="1.0" encoding="UTF-8"?>');
};

export default handler;

const sendEmailRequestSchema: JSONSchema7 = {
  type: 'object',
  properties: {
    Action: { type: 'string', pattern: '^CreateTemplate$' },
    Version: { type: 'string' },

    ConfigurationSetName: { type: 'string' },
    Template: {
      type: 'object',
      properties: {
        TemplateName: { type: 'string' },
        SubjectPart: { type: 'string' },
        TextPart: { type: 'string' },
        HtmlPart: { type: 'string' },
      },
      required: ['TemplateName', 'SubjectPart'],
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
};

const validate = ajv.compile(sendEmailRequestSchema);
