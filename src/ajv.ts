import Ajv from 'ajv';
import { isEmail } from 'class-validator';

const ajv = new Ajv({
  strict: true,
});
ajv.addFormat('email', (data) => isEmail(data));
ajv.addFormat('phone-number', /^\+[1-9]{1}[0-9]{3,14}$/);

export default ajv;
