import { Test, TestingModule } from '@nestjs/testing';
import { FileSaveService } from './file-save.service';

describe('FileSaveService', () => {
  let service: FileSaveService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FileSaveService],
    }).compile();

    service = module.get<FileSaveService>(FileSaveService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
