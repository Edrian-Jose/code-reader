import { Router, type Request, type Response } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';

const router = Router();

// Serve OpenAPI specification
router.get('/openapi.yaml', (_req: Request, res: Response): void => {
  try {
    const openapiPath = join(process.cwd(), 'openapi.yaml');
    const openapiContent = readFileSync(openapiPath, 'utf-8');

    res.setHeader('Content-Type', 'text/yaml; charset=utf-8');
    res.send(openapiContent);
  } catch (error) {
    res.status(404).json({
      errors: [
        {
          status: '404',
          code: 'NOT_FOUND',
          title: 'OpenAPI Specification Not Found',
          detail: 'The OpenAPI specification file could not be found',
        },
      ],
    });
  }
});

// Redirect /api-docs to API.md documentation
router.get('/api-docs', (_req: Request, res: Response): void => {
  res.redirect('https://github.com/your-org/code-reader/blob/main/API.md');
});

export default router;
