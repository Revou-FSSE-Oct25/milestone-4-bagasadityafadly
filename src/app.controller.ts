import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getRoot() {
    return {
      message: 'Banking API is running successfully',
      documentation: '/api/docs',
    };
  }
}