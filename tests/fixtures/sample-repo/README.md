# Sample Repository

This is a sample repository used for testing the Code Reader MCP system.

## Structure

- `index.ts` - Main entry point
- `utils/` - Utility functions
  - `greeting.ts` - Greeting functions
- `math/` - Math utilities
  - `calculator.ts` - Calculator class

## Usage

```typescript
import { greet } from './utils/greeting';
import { Calculator } from './math/calculator';

greet('World');

const calc = new Calculator();
console.log(calc.add(2, 3)); // 5
```

## Features

1. Simple greeting utilities
2. Basic calculator operations
3. Error handling for edge cases
