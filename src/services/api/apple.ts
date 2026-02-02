
const DEVELOPER_TOKEN = "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IldlYlBsYXlLaWQifQ.eyJpc3MiOiJBTVBXZWJQbGF5IiwiaWF0IjoxNzY4NTIxMTkyLCJleHAiOjE3NzU3Nzg3OTIsInJvb3RfaHR0cHNfb3JpZ2luIjpbImFwcGxlLmNvbSJdfQ.iZTD-bdGzofBHTdPBDcuXR8SGhObN6HYWBgYfPteY_457FtNd1xb-V6NZSuJgSyVcOzJh8LEIZWXHDD48UMP6Q"
// Token provided by user
const APPLE_MUSIC_TOKEN = DEVELOPER_TOKEN

// Types based on usage in ExternalMusicSpace.tsx and API response
export interface AppleMusicItem {
    id: string
    type: 'songs' | 'albums' | 'playlists'
    attributes: {
        name: string
        artistName: string
        albumName?: string
        artwork?: { url: string }
        editorialNotes?: { short: string }
        previews?: { url: string }[]
        url: string
        releaseDate?: string
    }
}

// Internal helper for raw fetch
const fetchApple = async (url: string) => {
    const response = await fetch(url, {
        headers: {
            "authorization": `Bearer ${APPLE_MUSIC_TOKEN}`,
            "sec-ch-ua": "\"Not(A:Brand\";v=\"8\", \"Chromium\";v=\"144\", \"Google Chrome\";v=\"144\"",
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": "\"Windows\""
        },
        referrer: "https://music.apple.com/",
        method: "GET",
        mode: "cors",
        credentials: "include"
    });

    if (!response.ok) {
        throw new Error(`Apple API Error: ${response.status}`)
    }

    return response.json()
}

export const appleApi = {
    getEditorialGroupings: async () => {
        const url = `/apple-proxy/editorial/kr/groupings?art%5Burl%5D=c%2Cf&extend=artistUrl%2CeditorialArtwork%2CplainEditorialNotes&extend%5Bstation-events%5D=editorialVideo&fields%5Balbums%5D=artistName%2CartistUrl%2Cartwork%2CcontentRating%2CeditorialArtwork%2CplainEditorialNotes%2Cname%2CplayParams%2CreleaseDate%2Curl%2CtrackCount&fields%5Bartists%5D=name%2Curl%2Cartwork%2CeditorialArtwork&format%5Bresources%5D=map&include%5Balbums%5D=artists&include%5Bmusic-videos%5D=artists&include%5Bsongs%5D=artists&include%5Bstations%5D=events%2Cradio-show&l=ko&name=music&omit%5Bresource%3Aartists%5D=autos&platform=web&relate%5Bsongs%5D=albums&tabs=subscriber`
        return fetchApple(url)
    }
}

// Re-implement appleMusicApi for compatibility with ExternalMusicSpace.tsx
export const appleMusicApi = {
    getNewReleases: async () => {
        try {
            // Use the editorial endpoint to simulate new releases data via the proxy
            const response = await appleApi.getEditorialGroupings()
            const resources = response.resources || {}

            // Extract items from resources (Editorial often returns Albums)
            // Use defaults if undefined to prevent iteratior errors
            const songs = Object.values(resources.songs || {}) as AppleMusicItem[]
            const playlists = Object.values(resources.playlists || {}) as AppleMusicItem[]
            const albums = Object.values(resources.albums || {}) as AppleMusicItem[]

            return { songs, playlists, albums }
        } catch (e) {
            console.error("Apple Music Fetch Error", e);
            return { songs: [], playlists: [], albums: [] };
        }
    },

    getTracks: async (id: string, type: 'playlists' | 'albums') => {
        try {
            const url = `/apple-proxy/catalog/kr/${type}/${id}/tracks`
            const response = await fetchApple(url)

            return (response.data || []) as AppleMusicItem[]
        } catch (e) {
            console.warn(`Failed to fetch tracks for ${type}/${id}`, e)
            return []
        }
    }
}
