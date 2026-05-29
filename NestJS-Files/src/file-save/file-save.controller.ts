import {
  Controller,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { FileSaveService } from './file-save.service';
import { FileValidationPipePipe } from './file-validation-pipe/file-validation-pipe.pipe';

@Controller('file-save')
export class FileSaveController {
  constructor(private readonly fileSaveService: FileSaveService) {
    this.fileSaveService = fileSaveService;
  }
  @Post('/upload/:folderId')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: `./uploads/temp`,
        filename: (req, file, cb) => {
          cb(null, file.originalname);
        },
      }),
    }),
  )
  async saveOneFile(
    @UploadedFile(new FileValidationPipePipe()) file: Express.Multer.File,
    @Param('folderId') folderId: string,
  ) {
    return this.fileSaveService.saveOneFile(file, folderId);
  }
  @Post('/upload/profile/:folderId')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: `./uploads/temp`,
        filename: (req, file, cb) => {
          cb(null, file.originalname);
        },
      }),
    }),
  )
  async saveProfile(
    @Param('folderId') folderId: string,
    @UploadedFile(new FileValidationPipePipe()) file: Express.Multer.File,
  ) {
    return this.fileSaveService.saveProfile(file, folderId);
  }
}
