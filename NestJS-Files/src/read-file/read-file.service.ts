import { Injectable, NotFoundException, StreamableFile } from '@nestjs/common';
import * as fs from 'fs';
import * as fsPromise from 'fs/promises';
import { extname, join } from 'path';

@Injectable()
export class ReadFileService {
  async findFile(folderId: string) {
    const MIMETYPES = {
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
    };
    const originFiles = join(__dirname, '..', '..', 'uploads', folderId);
    const listFile = await fsPromise.readdir(join(originFiles));
    const findile = listFile.find(
      (file) =>
        file.endsWith('pdf') ||
        file.endsWith('png') ||
        file.endsWith('jpg') ||
        file.endsWith('jpeg'),
    );
    if (findile != undefined) {
      const directionFile = join(originFiles, findile);
      const file = fs.createReadStream(directionFile);
      const mimetype = MIMETYPES[extname(directionFile)];
      return new StreamableFile(file, {
        type: mimetype,
        disposition: 'inline',
      });
    } else {
      throw new NotFoundException('Archivo no encontrado');
    }
  }
  async findProfile(folderId: string) {
    const MIMETYPES = {
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
    };

    try {
      const uploadsBase = process.cwd(); // Directorio actual del proceso
      const originFiles = join(uploadsBase, 'uploads', folderId, 'profile');
      try {
        await fsPromise.access(originFiles);
      } catch {
        throw new NotFoundException('Directorio de perfil no encontrado');
      }
      const listFile = await fsPromise.readdir(originFiles);
      const findile = listFile.find(
        (file) =>
          file.endsWith('.png') ||
          file.endsWith('.jpg') ||
          file.endsWith('.jpeg') ||
          file.toLowerCase().endsWith('.png') ||
          file.toLowerCase().endsWith('.jpg') ||
          file.toLowerCase().endsWith('.jpeg'),
      );

      if (findile) {
        const directionFile = join(originFiles, findile);
        await fsPromise.access(directionFile);
        const file = fs.createReadStream(directionFile);
        const mimetype =
          MIMETYPES[extname(directionFile).toLowerCase()] ||
          'application/octet-stream';

        return new StreamableFile(file, {
          type: mimetype,
          disposition: 'inline',
        });
      } else {
        throw new NotFoundException('Archivo de imagen no encontrado');
      }
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException('Error al buscar el archivo de perfil');
    }
  }
}
