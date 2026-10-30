import { prisma } from '@/lib/prisma'
import { PublishStatus, SocialPlatform, MediaType } from '@prisma/client'

export interface CreatePublicationParams {
  userId: string
  title?: string
  caption?: string
  mediaType?: MediaType
  storagePath: string
  publicUrl: string
  fileSize?: number
  platforms: SocialPlatform[]
  status?: PublishStatus
}

export async function createPublicationRecord(params: CreatePublicationParams) {
  return await prisma.publication.create({
    data: {
      userId: params.userId,
      title: params.title,
      caption: params.caption,
      mediaType: params.mediaType || 'VIDEO',
      storagePath: params.storagePath,
      publicUrl: params.publicUrl,
      fileSize: params.fileSize,
      platforms: params.platforms,
      status: params.status || 'PENDING',
    },
  })
}

export async function updatePublicationStatus(
  id: string,
  data: {
    status: PublishStatus
    tiktokPublishId?: string
    metaContainerId?: string
    errorMessage?: string
  }
) {
  return await prisma.publication.update({
    where: { id },
    data: {
      status: data.status,
      ...(data.tiktokPublishId && { tiktokPublishId: data.tiktokPublishId }),
      ...(data.metaContainerId && { metaContainerId: data.metaContainerId }),
      ...(data.errorMessage && { errorMessage: data.errorMessage }),
    },
  })
}
