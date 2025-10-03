import { Test, TestingModule } from '@nestjs/testing';
import { DataImportController } from './data-import.controller';

describe('DataImportController', () => {
  let controller: DataImportController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DataImportController],
    }).compile();

    controller = module.get<DataImportController>(DataImportController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
