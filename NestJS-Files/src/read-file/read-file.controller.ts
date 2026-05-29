import { Controller, Get, Param } from '@nestjs/common';
import { ReadFileService } from './read-file.service';
@Controller('read-file')
export class ReadFileController {
  constructor(private readonly readServiceFile: ReadFileService) {
    this.readServiceFile = readServiceFile;
  }
  @Get(':folderId')
  async findFile(@Param('folderId') folderId: string) {
    return await this.readServiceFile.findFile(folderId);
  }
  @Get('profile/:folderId')
  async findProfile(@Param('folderId') folderId: string) {
    return await this.readServiceFile.findProfile(folderId);
  }
}
