import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product } from './schemas/product.schema';
import { CreateProductDto, SearchProductsDto } from './dto/product.dto';
import { EventPublisherService } from '../shared/services/event-publisher.service';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectModel(Product.name) private productModel: Model<Product>,
    private readonly eventPublisher: EventPublisherService,
  ) {}

  async create(createProductDto: CreateProductDto): Promise<Product> {
    try {
      const product = new this.productModel(createProductDto);
      const saved = await product.save();

      await this.eventPublisher.publishEvent({
        eventType: 'PRODUCT_CREATED',
        entityId: String(saved._id),
        entityType: 'Product',
        action: 'CREATE',
        data: { productId: saved.productId, title: saved.title },
        timestamp: new Date(),
      });

      return saved;
    } catch (error) {
      this.logger.error(`Failed to create product: ${error.message}`);
      throw error;
    }
  }

  async createBulk(
    products: CreateProductDto[],
  ): Promise<{ inserted: number; failed: number }> {
    let inserted = 0;
    let failed = 0;

    for (const productDto of products) {
      try {
        await this.create(productDto);
        inserted++;
      } catch (error) {
        failed++;
        this.logger.warn(
          `Failed to insert product ${productDto.productId}: ${error.message}`,
        );
      }
    }

    await this.eventPublisher.publishEvent({
      eventType: 'PRODUCTS_BULK_CREATED',
      entityType: 'Product',
      action: 'BULK_CREATE',
      data: { inserted, failed, total: products.length },
      timestamp: new Date(),
    });

    return { inserted, failed };
  }

  async search(searchDto: SearchProductsDto) {
    const {
      search,
      category,
      brand,
      minPrice,
      maxPrice,
      page = 1,
      limit = 10,
      sortBy,
      sortOrder,
    } = searchDto;

    const filter: any = {};

    if (search) {
      filter.$text = { $search: search };
    }

    if (category) {
      filter.category = category;
    }

    if (brand) {
      filter.brand = brand;
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.price = {};
      if (minPrice !== undefined) filter.price.$gte = minPrice;
      if (maxPrice !== undefined) filter.price.$lte = maxPrice;
    }

    const skip = (page - 1) * limit;
    const sort: any = {};
    if (sortBy) {
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
    }

    const [products, total] = await Promise.all([
      this.productModel.find(filter).sort(sort).skip(skip).limit(limit).exec(),
      this.productModel.countDocuments(filter),
    ]);

    await this.eventPublisher.publishEvent({
      eventType: 'PRODUCTS_SEARCHED',
      entityType: 'Product',
      action: 'SEARCH',
      data: { filters: searchDto, resultsCount: products.length },
      timestamp: new Date(),
    });

    return {
      data: products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.productModel.findById(id);
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    await this.eventPublisher.publishEvent({
      eventType: 'PRODUCT_VIEWED',
      entityId: id,
      entityType: 'Product',
      action: 'VIEW',
      timestamp: new Date(),
    });

    return product;
  }

  async delete(id: string): Promise<void> {
    const result = await this.productModel.findByIdAndDelete(id);
    if (!result) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    await this.eventPublisher.publishEvent({
      eventType: 'PRODUCT_DELETED',
      entityId: id,
      entityType: 'Product',
      action: 'DELETE',
      timestamp: new Date(),
    });
  }
}
