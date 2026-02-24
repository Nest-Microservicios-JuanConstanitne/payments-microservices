import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { envs } from './config';
import { Logger, ValidationPipe } from '@nestjs/common';

async function bootstrap() {

  const logger = new Logger("Main")

  const app = await NestFactory.create(AppModule, {
    rawBody: true
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.NATS,
    options: {
      servers: envs.natsServers
    },
  }, {
    inheritAppConfig: true
  });

  // Creamos una aplicacion hibrida SERVER NATS RES API
  await app.startAllMicroservices();

  await app.listen(envs.port);

  logger.log(`Payments Microservices running on port ${envs.port}`);


}
bootstrap();
