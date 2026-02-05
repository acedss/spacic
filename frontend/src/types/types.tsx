export interface Song {
    _id: string;
    title: string;
    artist: string;
    imageUrl: string;
    audioUrl: string; // Vẫn là string, nhưng là Presigned URL
    duration: number;
    albumId: string | null;
}
