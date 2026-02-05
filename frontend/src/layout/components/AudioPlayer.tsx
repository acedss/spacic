import { useEffect, useRef } from "react";
import { axiosInstance } from "@/lib/axios";
import { Button } from "@/components/ui/button";


const AudioPlayer = () => {
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        const fetchAudioUrl = async () => {
            try {
                const response = await axiosInstance.get('/songs/test-get-presigned-url');
                const audioUrl = response.data.audioUrl;
                console.log("Fetched Audio URL:", audioUrl);
                if (audioRef.current) {
                    audioRef.current.src = audioUrl;
                }
            } catch (error) {
                console.error("Fetch Audio URL Error:", error);
            }
        }
        fetchAudioUrl();
    });


    // Trả về thẻ audio ẩn
    // return <audio ref={audioRef} />;
    return (
        <>
            <audio ref={audioRef} />
            {/* play btn */}
            <Button onClick={() => audioRef.current?.play()}>
                Play Audio
            </Button>
        </>);
};

export default AudioPlayer;