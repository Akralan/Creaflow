import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import type { ObjectStorage } from "./types";

let client: S3Client | null = null;

function getClient(): S3Client {
  if (!client) {
    const endpoint = process.env.R2_ENDPOINT;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    if (!endpoint || !accessKeyId || !secretAccessKey) {
      throw new Error(
        "R2_ENDPOINT, R2_ACCESS_KEY_ID et R2_SECRET_ACCESS_KEY doivent être définis dans l'environnement."
      );
    }
    client = new S3Client({
      endpoint,
      region: "auto",
      credentials: { accessKeyId, secretAccessKey },
    });
  }
  return client;
}

function getBucket(): string {
  const bucket = process.env.R2_BUCKET;
  if (!bucket) {
    throw new Error("R2_BUCKET n'est pas défini dans l'environnement.");
  }
  return bucket;
}

// Aucune transformation des bytes ici, jamais — cf. docs/SPEC_RESSOURCES_VISUELLES.md §6.2 (AI Act) :
// une image générée par Nano Banana doit être uploadée telle quelle pour ne pas dépouiller un
// éventuel filigrane/métadonnées embarqués par l'API. Le redimensionnement (sharp) n'a sa place que
// dans les services d'ingestion, jamais dans ce module.
export const r2Storage: ObjectStorage = {
  async upload(key, body, contentType) {
    await getClient().send(
      new PutObjectCommand({
        Bucket: getBucket(),
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    );
  },

  async download(key) {
    const response = await getClient().send(new GetObjectCommand({ Bucket: getBucket(), Key: key }));
    if (!response.Body) {
      throw new Error(`Objet introuvable sur R2 : "${key}".`);
    }
    const bytes = await response.Body.transformToByteArray();
    return Buffer.from(bytes);
  },

  getPublicUrl(key) {
    const base = process.env.R2_PUBLIC_BASE_URL;
    if (!base) {
      throw new Error("R2_PUBLIC_BASE_URL n'est pas défini dans l'environnement.");
    }
    return `${base.replace(/\/$/, "")}/${key}`;
  },

  async delete(key) {
    await getClient().send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }));
  },
};
