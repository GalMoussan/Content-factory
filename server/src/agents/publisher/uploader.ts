/**
 * Uploader — uploads a video to YouTube via the Data API v3.
 */
import fs from 'node:fs';
import { google } from 'googleapis';

interface UploadMetadata {
  readonly videoPath: string;
  readonly title: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly privacyStatus: 'public' | 'private' | 'unlisted';
}

interface UploadResult {
  readonly videoId: string;
  readonly videoUrl: string;
}

/**
 * Upload a video file to YouTube with the given metadata.
 * Returns the YouTube video ID and URL on success.
 */
export async function uploadVideo(
  metadata: UploadMetadata,
  accessToken: string,
): Promise<UploadResult> {
  const youtube = google.youtube({
    version: 'v3',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const response = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title: metadata.title,
        description: metadata.description,
        tags: [...metadata.tags],
        categoryId: '28', // Science & Technology
      },
      status: {
        privacyStatus: metadata.privacyStatus,
      },
    },
    media: {
      body: fs.createReadStream(metadata.videoPath),
    },
  });

  const videoId = response.data.id;
  if (!videoId) {
    throw new Error('YouTube upload succeeded but returned no video ID.');
  }

  return {
    videoId,
    videoUrl: `https://youtube.com/watch?v=${videoId}`,
  };
}
