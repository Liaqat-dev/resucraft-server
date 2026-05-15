import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const SibApiV3Sdk = require('@getbrevo/brevo');
console.log(Object.keys(SibApiV3Sdk)); // add this temporarily