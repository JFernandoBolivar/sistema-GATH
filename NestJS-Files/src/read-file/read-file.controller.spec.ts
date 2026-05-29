import { Test, TestingModule } from '@nestjs/testing';
import { ReadFileController } from './read-file.controller';

describe('ReadFileController', () => {
  let controller: ReadFileController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReadFileController],
    }).compile();

    controller = module.get<ReadFileController>(ReadFileController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
