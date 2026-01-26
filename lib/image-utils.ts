// lib/image-utils.ts
// 客户端图片处理工具（支持HEIC格式）
// 这个文件只在客户端使用，避免服务端渲染问题

/**
 * 转换HEIC/HEIF格式为JPEG
 * @param file - HEIC/HEIF文件
 * @returns 转换后的JPEG文件
 */
async function convertHeicToJpeg(file: File): Promise<File> {
  try {
    // 动态导入 heic2any，避免服务端渲染问题
    const heic2any = (await import('heic2any')).default;

    console.log('开始转换HEIC文件:', file.name, '大小:', file.size);

    const convertedBlob = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.9,
    });

    console.log('HEIC转换成功');

    // heic2any 可能返回 Blob 或 Blob[]
    const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;

    return new File(
      [blob],
      file.name.replace(/\.(heic|heif)$/i, '.jpg'),
      { type: 'image/jpeg', lastModified: Date.now() }
    );
  } catch (error: any) {
    console.error('HEIC转换失败:', error);
    console.error('错误详情:', {
      message: error?.message || '未知错误',
      code: error?.code,
      stack: error?.stack,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    });

    // 检查是否是格式不支持的错误
    if (error?.code === 2 || error?.message?.includes('format not supported')) {
      throw new Error(
        'HEIC格式转换失败：此HEIC文件格式暂不支持。\n' +
        '建议：\n' +
        '1. 在iPhone上打开照片，点击"分享"，选择"拷贝照片"，然后粘贴上传\n' +
        '2. 或使用iPhone的"文件"应用将照片转换为JPEG格式\n' +
        '3. 或直接上传JPG/PNG格式的图片'
      );
    }

    throw new Error(`HEIC格式转换失败: ${error?.message || '未知错误'}`);
  }
}

/**
 * 压缩图片
 * @param file - 图片文件
 * @param maxWidth - 最大宽度
 * @param maxHeight - 最大高度
 * @param quality - 压缩质量 (0-1)
 * @returns 压缩后的JPEG文件
 */
async function compressImageToJpeg(
  file: File,
  maxWidth: number = 1200,
  maxHeight: number = 1200,
  quality: number = 0.8
): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;

      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // 计算缩放比例
        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('无法创建 canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('图片压缩失败'));
              return;
            }

            const fileName = file.name.replace(/\.(heic|heif|png|webp|gif)$/i, '.jpg');
            const compressedFile = new File([blob], fileName, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });

            resolve(compressedFile);
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = () => {
        reject(new Error('图片加载失败'));
      };
    };

    reader.onerror = () => {
      reject(new Error('文件读取失败'));
    };
  });
}

/**
 * 处理图片上传（支持HEIC格式）
 * 自动检测HEIC格式并转换，然后压缩为JPEG
 *
 * @param file - 原始图片文件
 * @param maxWidth - 最大宽度
 * @param maxHeight - 最大高度
 * @param quality - 压缩质量 (0-1)
 * @returns 处理后的JPEG文件
 */
export async function processImageForUpload(
  file: File,
  maxWidth: number = 1200,
  maxHeight: number = 1200,
  quality: number = 0.8
): Promise<File> {
  // 检测是否为HEIC/HEIF格式
  const isHeic =
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    file.name.toLowerCase().endsWith('.heic') ||
    file.name.toLowerCase().endsWith('.heif');

  // 如果是HEIC格式，先尝试转换为JPEG
  if (isHeic) {
    try {
      const processedFile = await convertHeicToJpeg(file);
      return compressImageToJpeg(processedFile, maxWidth, maxHeight, quality);
    } catch (error) {
      console.warn('HEIC转换失败，尝试直接处理文件:', error);
      // 如果转换失败，尝试直接处理（某些浏览器可能原生支持HEIC）
      try {
        return await compressImageToJpeg(file, maxWidth, maxHeight, quality);
      } catch (fallbackError) {
        // 如果直接处理也失败，抛出原始错误
        throw error;
      }
    }
  }

  // 非HEIC格式，直接压缩
  return compressImageToJpeg(file, maxWidth, maxHeight, quality);
}

/**
 * 验证文件是否为有效的图片格式（包括HEIC）
 */
export function isValidImageFile(file: File): boolean {
  return (
    file.type.startsWith('image/') ||
    file.name.toLowerCase().endsWith('.heic') ||
    file.name.toLowerCase().endsWith('.heif')
  );
}
