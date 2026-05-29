import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FileSaveModule } from './file-save/file-save.module';
import { ReadFileModule } from './read-file/read-file.module';
@Module({
  imports: [FileSaveModule, ReadFileModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
