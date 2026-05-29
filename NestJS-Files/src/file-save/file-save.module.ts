import { Module } from '@nestjs/common';
import { FileSaveController } from './file-save.controller';
import { FileSaveService } from './file-save.service';
import { MulterModule } from '@nestjs/platform-express';

@Module({
  imports: [
    MulterModule.register({
      dest: './uploads',
    }),
  ],
  controllers: [FileSaveController],
  providers: [FileSaveService],
})
export class FileSaveModule {}
