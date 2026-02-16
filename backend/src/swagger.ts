export const swaggerDocument = {
  openapi: '3.0.0',
  info: { title: 'Share Anywhere API', version: '1.0.0' },
  servers: [{ url: '/api/v1', description: 'API v1' }],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'Authorization',
        description: 'Bearer <your-api-key>',
      },
    },
  },
  paths: {
    '/files': {
      get: {
        summary: 'List files',
        security: [{ ApiKeyAuth: [] }],
        parameters: [{ name: 'folderId', in: 'query', schema: { type: 'string' } }],
        responses: { 200: { description: 'List of files' } },
      },
    },
    '/files/upload-url': {
      post: {
        summary: 'Get presigned upload URL',
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { fileName: { type: 'string' }, size: { type: 'number' }, folderId: { type: 'string' } },
                required: ['fileName', 'size'],
              },
            },
          },
        },
        responses: { 200: { description: 'Upload URL and file ID' } },
      },
    },
    '/files/{id}/download-url': {
      get: {
        summary: 'Get presigned download URL',
        security: [{ ApiKeyAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Download URL' } },
      },
    },
  },
};
