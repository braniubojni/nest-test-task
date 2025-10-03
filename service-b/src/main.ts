import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, p) => {
    logger.error(reason, 'Unhandled Rejection at Promise', p);
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (err) => {
    logger.error(err, 'Uncaught Exception thrown');
  });

  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.enableCors();

  const config = new DocumentBuilder()
    .setTitle('Service B - Audit Logs & Reporting API')
    .setDescription(
      'Microservice for event consumption, log management, and reporting',
    )
    .setVersion('1.0')
    .addTag('logs')
    .addTag('reports')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
  const PORT = process.env.PORT || 3001;

  await app.listen(PORT, () => {
    logger.log(`Service B running on: http://localhost:${PORT}`);
    logger.log(
      `Swagger docs: http://localhost:${process.env.PORT || 3000}/api`,
    );
  });
}
bootstrap();
