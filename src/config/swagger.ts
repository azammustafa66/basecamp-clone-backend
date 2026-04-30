import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Basecamp Clone API',
      version: '1.0.0',
      description: 'REST API for the Basecamp clone — projects, tasks, subtasks, and notes.',
    },
    // 👇 THIS IS THE FIX 👇
    servers: [
      {
        url:
          process.env.NODE_ENV === 'production'
            ? 'https://basecamp-clone-backend-1.onrender.com'
            : 'http://localhost:3000/api/v1',
        description:
          process.env.NODE_ENV === 'production' ? 'Production Server' : 'Local Development Server',
      },
    ],
    // 👆👆👆👆
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description:
            'Paste your access token here. Alternatively send it as the `accessToken` cookie.',
        },
      },
      schemas: {
        ApiResponse: {
          type: 'object',
          properties: {
            statusCode: { type: 'integer', example: 200 },
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Operation successful' },
            data: { type: 'object' },
          },
        },
        ApiError: {
          type: 'object',
          properties: {
            statusCode: { type: 'integer', example: 400 },
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Bad Request' },
            errors: { type: 'array', items: { type: 'string' } },
          },
        },
        User: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '664a1c2f3e4b5a6d7f8e9b0c' },
            userName: { type: 'string', example: 'johndoe' },
            email: { type: 'string', example: 'john@example.com' },
            fullName: { type: 'string', example: 'John Doe' },
            role: { type: 'string', enum: ['admin', 'member'], example: 'member' },
            isEmailVerified: { type: 'boolean', example: true },
            avatar: {
              type: 'object',
              properties: {
                url: { type: 'string' },
                localPath: { type: 'string' },
              },
            },
          },
        },
        Project: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '664a1c2f3e4b5a6d7f8e9b0c' },
            name: { type: 'string', example: 'Website Redesign' },
            description: { type: 'string', example: 'Redesign the company website' },
            createdBy: {
              type: 'array',
              items: { $ref: '#/components/schemas/User' },
            },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Task: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            title: { type: 'string', example: 'Design homepage' },
            description: { type: 'string' },
            project: { type: 'string' },
            assignedBy: { $ref: '#/components/schemas/User' },
            assignedTo: {
              type: 'array',
              items: { $ref: '#/components/schemas/User' },
            },
            status: {
              type: 'string',
              enum: ['todo', 'in_progress', 'done'],
              example: 'todo',
            },
            attachments: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  url: { type: 'string' },
                  mimeType: { type: 'string' },
                  size: { type: 'number' },
                },
              },
            },
          },
        },
        SubTask: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            title: { type: 'string', example: 'Write copy for hero section' },
            task: { type: 'string' },
            isCompleted: { type: 'boolean', example: false },
            createdBy: { $ref: '#/components/schemas/User' },
          },
        },
        Note: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            project: { type: 'string' },
            content: { type: 'string', example: 'Meeting notes from Monday standup' },
            createdBy: { $ref: '#/components/schemas/User' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
