import { greet } from './utils/greeting.js';
import { Calculator } from './math/calculator.js';

export function main(): void {
  greet('World');

  const calc = new Calculator();
  console.log('2 + 3 =', calc.add(2, 3));
  console.log('10 - 4 =', calc.subtract(10, 4));
}

main();
