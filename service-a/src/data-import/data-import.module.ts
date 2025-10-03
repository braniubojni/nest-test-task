import { Module } from '@nestjs/common';
import { DataImportService } from './data-import.service';
import { DataImportController } from './data-import.controller';
import { HttpModule } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { Product, ProductSchema } from 'src/products/schemas/product.schema';
import { SharedModule } from 'src/shared/shared.module';

@Module({
  imports: [
    HttpModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        baseURL: configService.get('EXTERNAL_API_URL'),
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([{ name: Product.name, schema: ProductSchema }]),
    SharedModule,
  ],
  providers: [DataImportService],
  controllers: [DataImportController],
})
export class DataImportModule {}
