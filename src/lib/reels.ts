export interface Reel {
  id: string;
  /** The video file (compressed copy stored on Cloudinary). */
  video: string;
  /** A still frame shown until the video plays. */
  poster: string;
  /** The reel on Instagram: opened when the video is clicked. */
  url: string;
  label: string;
}

const base = "https://res.cloudinary.com/hmnstq5i/video/upload";
const poster = (version: string, id: string) => `${base}/so_1,w_540,f_jpg,q_auto/${version}/chique-bags/reels/${id}.jpg`;

/** The reels shown at the bottom of the homepage. To change them, edit this list. */
export const REELS: Reel[] = [
  {
    id: "reel001",
    video: `${base}/v1794814985/chique-bags/reels/reel001.mp4`,
    poster: poster("v1794814985", "reel001"),
    url: "https://www.instagram.com/reel/DdEtroqhCGx/",
    label: "Chique Bags reel 1",
  },
  {
    id: "reel002",
    video: `${base}/v1794814992/chique-bags/reels/reel002.mp4`,
    poster: poster("v1794814992", "reel002"),
    url: "https://www.instagram.com/reel/DfP2pmgB0tD/",
    label: "Chique Bags reel 2",
  },
  {
    id: "reel003",
    video: `${base}/v1794814995/chique-bags/reels/reel003.mp4`,
    poster: poster("v1794814995", "reel003"),
    url: "https://www.instagram.com/reel/DfPQCV3Pqvk/",
    label: "Chique Bags reel 3",
  },
];
