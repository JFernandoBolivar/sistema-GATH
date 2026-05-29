import { Test, TestingModule } from '@nestjs/testing';
import { FileSaveController } from './file-save.controller';

describe('FileSaveController', () => {
  let controller: FileSaveController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FileSaveController],
    }).compile();

    controller = module.get<FileSaveController>(FileSaveController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
