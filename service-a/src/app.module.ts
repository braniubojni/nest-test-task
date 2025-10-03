import { Module } from '@nestjs/common';
import { ProductsModule } from './products/products.module';
import { DataImportModule } from './data-import/data-import.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SharedModule } from './shared/shared.module';
import { MongooseModule } from '@nestjs/mongoose';
import { getMongoConfig } from './common/configs/mongo.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: `.env.${process.env.NODE_ENV}`,
      isGlobal: true,
    }),
    MongooseModule.forRoot(getMongoConfig(new ConfigService())),
    SharedModule,
    ProductsModule,
    DataImportModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
