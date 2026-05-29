import {
  ArgumentMetadata,
  Injectable,
  PipeTransform,
  UnprocessableEntityException,
} from '@nestjs/common';
import * as sharp from 'sharp';
import * as fsPromise from 'fs/promises';
import * as fs from 'fs';
@Injectable()
export class FileValidationPipePipe implements PipeTransform {
  constructor(
    private readonly allowed: string[] = [
      'image/jpeg',
      'image/jpg',
      'image/png',
    ],
  ) {}
  async transform(
    value: Express.Multer.File | Express.Multer.File[],
    metadata: ArgumentMetadata,
  ) {
    if (Array.isArray(value)) {
      return Promise.all(value.map((file) => this.processFile(file)));
    } else {
      return await this.processFile(value);
    }
  }
  private async processFile(file: Express.Multer.File) {
    if (!this.allowed.includes(file.mimetype)) {
      throw new UnprocessableEntityException('Tipo de archivo no permitido');
    }
    const filePath = file.path;
    const readFile = await fsPromise.readFile(filePath);
    const image = sharp(readFile)
      .resize(1024, 768, {
        fit: 'contain',
        position: 'center',
      })
      .png({
        quality: 100,
        compressionLevel: 9,
        force: true,
      })
      .jpeg({
        quality: 100,
        force: true,
      });
    await image.toFile(filePath);
    return file;
  }
}
