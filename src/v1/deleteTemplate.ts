import type { RequestHandler } from 'express';

import { deleteTemplate, hasTemplate } from '../store';

const handler: RequestHandler = async (req, res) => {
  const templateName = req.body.TemplateName;
  if (!hasTemplate(templateName)) {
    res.status(400).send({ type: 'BadRequestException', message: 'Bad Request Exception', detail: `aws-ses-v2-local: Unable to find the template: ${templateName}.` });
    return;
  }

  deleteTemplate(req.body.TemplateName);

  res.status(200).send('<?xml version="1.0" encoding="UTF-8"?>');
};

export default handler;
