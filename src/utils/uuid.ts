import { v4 as uuidv4, validate as uuidValidate } from 'uuid';

export function generateUUID(): string {
  return uuidv4();
}

export function isValidUUID(id: string): boolean {
  return uuidValidate(id);
}
