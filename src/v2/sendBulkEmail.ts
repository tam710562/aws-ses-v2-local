import type { RequestHandler } from 'express';
import type { JSONSchema7 } from 'json-schema';
import { isEmail } from 'class-validator';
import ajv from '../ajv';
import { Email, Type, TemplateV2, getTemplate, hasTemplate, saveEmail } from '../store';

interface Replacement {
  Name: string;
  Value: string;
}

interface BulkEmailResult {
  MessageId: string;
  Error?: string;
  Status: string;
}

interface BulkEmailDefaultContent {
  Template: {
    TemplateArn?: string;
    TemplateData?: string;
    TemplateName: string;
  };
}

interface BulkEmailEntry {
  Destination: {
    BccAddresses?: string [];
    CcAddresses?: string[];
    ToAddresses: string[];
  };
  ReplacementEmailContent?: {
    ReplacementTemplate?: {
      ReplacementTemplateData?: string;
    };
  };
  ReplacementTags?: Replacement[]
}

interface BulkEmailBody {
  BulkEmailEntries: BulkEmailEntry[];
  ConfigurationSetName: string;
  DefaultContent: BulkEmailDefaultContent;
  DefaultEmailTags?: Replacement[];
  FeedbackForwardingEmailAddress: string;
  FeedbackForwardingEmailAddressIdentityArn: string;
  FromEmailAddress: string;
  FromEmailAddressIdentityArn: string;
  ReplyToAddresses: string[];
}

const handler: RequestHandler = (req, res, next) => {
  if (!validate(req.body)) {
    res.status(404).send({ type: 'BadRequestException', message: 'Bad Request Exception', detail: 'aws-ses-v2-local: Schema validation failed' });
    return;
  }
  handleBulk(req, res, next);
};

const handleBulk: RequestHandler = async (req, res) => {
  const body = req.body as unknown as BulkEmailBody;

  if (!body.FromEmailAddress) {
    res.status(400).send({ type: 'BadRequestException', message: 'Bad Request Exception', detail: 'aws-ses-v2-local: Must have a from email address.' });
    return;
  }

  const fromEmailAddress = body.FromEmailAddress;
  const replyToAddresses = body.ReplyToAddresses ?? [];
  const defaultContent = body.DefaultContent;

  // Try to retrieve the template.
  const templateName = defaultContent.Template.TemplateName;
  if (!hasTemplate(templateName)) {
    res.status(400).send({ type: 'BadRequestException', message: 'Bad Request Exception', detail: `aws-ses-v2-local: Unable to find the template: ${templateName}.` });
    return;
  }

  const template = getTemplate(templateName) as TemplateV2;
  const templateSubject = template?.TemplateContent.Subject ?? '';
  const templateHtml = template?.TemplateContent.Html ?? '';
  const templateText = template?.TemplateContent.Text ?? '';

  // Default template replacement data.
  const defaultTemplateData = decodeTemplateData(defaultContent.Template?.TemplateData);

  const results: BulkEmailResult[] = [];
  // Process each destination.
  body.BulkEmailEntries.forEach((entry, index) => {
    const messageId = `ses-${Math.floor(Math.random() * 900000000 + 100000000 + index)}`;

    // Validate destination email address.
    const allEmails = [...entry.Destination.ToAddresses, ...entry.Destination.CcAddresses ?? [], ...entry.Destination.BccAddresses ?? []];
    if (!allEmails.every((e) => isEmail(e))) {
      results.push({
        MessageId: messageId,
        Error: 'Invalid recipient email address(es)',
        Status: 'FAILED',
      });
      return;
    }

    const templateData = decodeTemplateData(entry.ReplacementEmailContent?.ReplacementTemplate?.ReplacementTemplateData);
    const subject = replaceTemplateData(templateSubject, templateData, defaultTemplateData);
    const html = replaceTemplateData(templateHtml, templateData, defaultTemplateData);
    const text = replaceTemplateData(templateText, templateData, defaultTemplateData);

    const email: Email = {
      type: Type.Email,
      messageId,
      from: fromEmailAddress,
      replyTo: replyToAddresses,
      destination: {
        to: entry.Destination.ToAddresses,
        cc: entry.Destination?.CcAddresses ?? [],
        bcc: entry.Destination?.BccAddresses ?? [],
      },
      subject,
      body: {
        html,
        text,
      },
      attachments: [],
      at: Math.floor(new Date().getTime() / 1000),
    };

    saveEmail(email);

    results.push({
      MessageId: messageId,
      Status: 'SUCCESS',
    });
  });

  res.status(200).send({ BulkEmailEntryResults: results });
};

/**
 * Decode template data.
 */
function decodeTemplateData(templateData?: string): Replacement[] {
  const result = templateData ? JSON.parse(templateData) : [];
  return result ?? [];
}

/**
 * Replace template data.
 */
function replaceTemplateData(content: string, replacements: Replacement[] = [], defaultReplacements: Replacement[] = []): string {
  let newContent = content;
  replacements.forEach((item) => {
    newContent = newContent.replaceAll(`{{${item.Name}}}`, item.Value);
  });
  defaultReplacements.forEach((item) => {
    newContent = newContent.replaceAll(`{{${item.Name}}}`, item.Value);
  });
  return newContent;
}

export default handler;

const sendBulkEmailRequestSchema: JSONSchema7 = {
  type: 'object',
  properties: {
    BulkEmailEntries: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          Destination: {
            type: 'object',
            properties: {
              BccAddresses: { type: 'array', items: { type: 'string' } },
              CcAddresses: { type: 'array', items: { type: 'string' } },
              ToAddresses: { type: 'array', items: { type: 'string' } },
            },
            required: ['ToAddresses'],
          },
          ReplacementEmailContent: {
            type: 'object',
            properties: {
              ReplacementTemplate: {
                type: 'object',
                properties: {
                  ReplacementTemplateData: { type: 'string' },
                },
                required: ['ReplacementTemplateData'],
              },
            },
            required: ['ReplacementTemplate'],
          },
          ReplacementTags: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                Name: { type: 'string' },
                Value: { type: 'string' },
              },
              required: ['Name', 'Value'],
            },
          },
        },
        required: ['Destination'],
      },
    },
    ConfigurationSetName: { type: 'string' },
    DefaultContent: {
      type: 'object',
      properties: {
        Template: {
          type: 'object',
          properties: {
            TemplateArn: { type: 'string' },
            TemplateData: { type: 'string' },
            TemplateName: { type: 'string' },
          },
          required: ['TemplateName'],
        },
      },
      required: ['Template'],
    },
    DefaultEmailTags: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          Name: { type: 'string' },
          Value: { type: 'string' },
        },
        required: ['Name', 'Value'],
      },
    },
    FeedbackForwardingEmailAddress: { type: 'string' },
    FeedbackForwardingEmailAddressIdentityArn: { type: 'string' },
    FromEmailAddress: { type: 'string' },
    FromEmailAddressIdentityArn: { type: 'string' },
    ReplyToAddresses: { type: 'array', items: { type: 'string' } },
  },
  required: ['BulkEmailEntries', 'DefaultContent', 'FromEmailAddress'],
};

const validate = ajv.compile(sendBulkEmailRequestSchema);
