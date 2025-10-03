import { Test, TestingModule } from '@nestjs/testing';
import { DataImportService } from './data-import.service';

describe('DataImportService', () => {
  let service: DataImportService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DataImportService],
    }).compile();

    service = module.get<DataImportService>(DataImportService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
