import { Test, TestingModule } from '@nestjs/testing';
import { ReadFileService } from './read-file.service';

describe('ReadFileService', () => {
  let service: ReadFileService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReadFileService],
    }).compile();

    service = module.get<ReadFileService>(ReadFileService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
