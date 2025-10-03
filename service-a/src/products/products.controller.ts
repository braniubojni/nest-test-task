import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  Delete,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto, SearchProductsDto } from './dto/product.dto';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new product' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Product created successfully',
  })
  async create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Create multiple products' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Products created successfully',
  })
  async createBulk(@Body() products: CreateProductDto[]) {
    return this.productsService.createBulk(products);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search products with filters and pagination' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Products retrieved successfully',
  })
  async search(@Query() searchDto: SearchProductsDto) {
    return this.productsService.search(searchDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get product by ID' })
  async findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete product' })
  async delete(@Param('id') id: string) {
    return this.productsService.delete(id);
  }
}
