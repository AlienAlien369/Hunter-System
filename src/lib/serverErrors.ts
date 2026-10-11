import { t } from '../i18n';
import { en, type MessageKey } from '../i18n/messages/en';

// The API answers in English. These are its fixed, user-facing messages, shown in the hunter's language.
// Anything not listed (or a future message) is shown as the server wrote it.
export const SERVER_ERRORS: Record<string, MessageKey> = {
  'Username and password are required': 'srv.00',
  'Invalid credentials': 'srv.01',
  'Username already exists': 'srv.02',
  'Username must be at least 3 characters': 'srv.03',
  'Password must be at least 6 characters': 'srv.04',
  'New password must be at least 6 characters': 'srv.05',
  'New password must be different from the current one': 'srv.06',
  'Current password is incorrect': 'srv.07',
  'Username or recovery code is incorrect': 'srv.08',
  'Username and recovery code are required': 'srv.09',
  'Enter the month and year you were born': 'srv.10',
  'You must accept the Terms and Privacy Policy': 'srv.11',
  'Enter a valid email address': 'srv.12',
  'Type your username to confirm': 'srv.13',
  'This hunter name is already taken': 'srv.14',
  'Name must be at least 2 characters': 'srv.15',
  'Name must be 30 characters or less': 'srv.16',
  'Hunter name has already been set and cannot be changed': 'srv.17',
  'Too many requests': 'srv.18',
  'Something went wrong': 'srv.19',
  'Failed to login': 'srv.20',
  'Failed to register user': 'srv.21',
};

export function serverErrorText(message: string): string {
  const key = SERVER_ERRORS[message];
  return key && key in en ? t(key) : message;
}
