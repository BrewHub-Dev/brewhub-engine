import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp";


if (!process.env.CLOUDINARY_URL) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}


async function compressBuffer(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize({ width: 1200, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
}

export async function uploadImageBuffer(
  buffer: Buffer,
  options: { folder?: string; publicId?: string } = {}
): Promise<{ url: string; publicId: string; width: number; height: number }> {
  const compressed = await compressBuffer(buffer);

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder ?? "brewhub/items",
        public_id: options.publicId,
        resource_type: "image",
        format: "webp",
      },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error("Upload failed"));
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
        });
      }
    );
    uploadStream.end(compressed);
  });
}

export async function deleteImage(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId);
}
