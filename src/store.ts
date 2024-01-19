import emlParseJs from 'eml-parse-js';
import { sendEmailToSmtp } from './smtp';

export interface Store {
  emails: Email[],
  templates: Map<string, TemplateV1 | TemplateV2>,
  sms: Sms[],
}

export interface Email {
  type: Type.Email,
  messageId: string,
  from: string,
  replyTo: string[],
  destination: {
    to: string[],
    cc: string[],
    bcc: string[],
  },
  subject: string,
  body: {
    html?: string,
    text?: string,
  },
  attachments: { content: string, contentType: string, filename?: string, size: number }[]
  at: number,
}

export interface TemplateV1 {
  templateName: string,
  subjectPart: string,
  textPart?: string,
  htmlPart?: string,
}

export interface TemplateV2 {
  TemplateContent: {
    Html: string,
    Subject: string,
    Text: string,
  },
  TemplateName: string,
}

export interface Sms {
  type: Type.Sms,
  messageId: string,
  message: string,
  phoneNumber: string,
  at: number,
}

export enum Type {
  Email,
  Sms
}

const store: Store = {
  emails: [],
  templates: new Map(),
  sms: [],
};

export const saveEmail = (email: Email) => {
  store.emails.push(email);
  sendEmailToSmtp(email);
};

export const saveSms = (sms: Sms) => {
  store.sms.push(sms);
};

export const hasTemplate = store.templates.has;
export const getTemplate = store.templates.get;
export const setTemplate = store.templates.set;
export const deleteTemplate = store.templates.delete;

export const clearStore = () => {
  store.emails = [];
  store.templates.clear();
  store.sms = [];
};

const generateUsernameFromEmail = (email: string) => {
  if (!email) {
    return '';
  }
  if (!email.includes('@')) {
    return email;
  }
  const cleanedInput = email
    .split('@')[0]?.replace(/[^\w]/g, ' ').split(' ');
  const capitalizedInput = cleanedInput?.map(
    (word) => word[0].toUpperCase() + word.substring(1),
  ).join(' ');

  return capitalizedInput;
};

export const buildEml = (email: Email) => emlParseJs.buildEml({
  date: new Date(email.at),
  subject: email.subject,
  from: {
    name: generateUsernameFromEmail(email.from),
    email: email.from,
  },
  to: email.destination.to?.map((e) => ({
    name: generateUsernameFromEmail(e),
    email: e,
  })),
  cc: email.destination.bcc?.map((e) => ({
    name: generateUsernameFromEmail(e),
    email: e,
  })),
  headers: {},
  // multipartAlternative?: {
  //   'Content-Type': string,
  // },
  text: email.body.text,
  // textheaders?: BoundaryHeaders,
  html: email.body.html,
  // htmlheaders?: BoundaryHeaders,
  // attachments?: Attachment[],
  // data?: string,
});

// This type doe  sn't give us perfect readonly safety
// But this is probably safe enough for now, given the method name
// and the relatively small project size.
export const getStoreReadonly = (): Readonly<Store> => store;
