import { Module } from '@nestjs/common';
import { ReadFileController } from './read-file.controller';
import { ReadFileService } from './read-file.service';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', 'uploads'),
    }),
  ],
  controllers: [ReadFileController],
  providers: [ReadFileService],
})
export class ReadFileModule {}
