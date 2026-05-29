import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: process.env.NEST_CORS || '',
  });
  await app.listen(process.env.PORT ?? 5000);
}
bootstrap();
