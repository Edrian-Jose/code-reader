export function greet(name: string): void {
  console.log(`Hello, ${name}!`);
}

export function farewell(name: string): void {
  console.log(`Goodbye, ${name}!`);
}

export function formatGreeting(name: string, formal: boolean = false): string {
  if (formal) {
    return `Good day, ${name}. How may I assist you?`;
  }
  return `Hey ${name}! What's up?`;
}
