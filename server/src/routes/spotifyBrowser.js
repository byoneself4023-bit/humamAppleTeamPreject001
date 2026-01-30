import express from 'express'
import { chromium } from 'playwright'
import { query, queryOne, execute } from '../config/db.js'

const router = express.Router()

const SPOTIFY_API_URL = 'https://api.spotify.com/v1'

// 브라우저 세션 저장소
let browserSessions = {} // { visitorId: { browser, context, accessToken } }

// POST /api/spotify/browser/login - Playwright로 Spotify 로그인
router.post('/login', async (req, res) => {
    const { visitorId, email, password } = req.body

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' })
    }

    const sessionKey = visitorId || 'default'

    try {
        console.log('[Spotify Browser] Starting login process...')

        // 브라우저 시작
        const browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        })

        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        })

        const page = await context.newPage()

        // 토큰 캡처를 위한 request interceptor
        let capturedToken = null

        page.on('request', request => {
            const auth = request.headers()['authorization']
            if (auth && auth.startsWith('Bearer ') && !capturedToken) {
                const token = auth.replace('Bearer ', '')
                // Spotify API 토큰인지 확인 (BQ로 시작)
                if (token.startsWith('BQ')) {
                    capturedToken = token
                    console.log('[Spotify Browser] Token captured!')
                }
            }
        })

        // Spotify 로그인 페이지로 이동
        await page.goto('https://accounts.spotify.com/login', { waitUntil: 'networkidle' })

        // 쿠키 동의 처리 (있는 경우)
        try {
            const cookieButton = page.locator('button[id="onetrust-accept-btn-handler"]')
            if (await cookieButton.isVisible({ timeout: 2000 })) {
                await cookieButton.click()
            }
        } catch (e) {
            // 쿠키 버튼 없으면 무시
        }

        // 이메일 입력
        await page.fill('input[id="login-username"]', email)

        // 비밀번호 입력
        await page.fill('input[id="login-password"]', password)

        // 로그인 버튼 클릭
        await page.click('button[id="login-button"]')

        // 로그인 결과 대기
        try {
            // 성공: Spotify 웹 플레이어로 리다이렉트
            await page.waitForURL('**/open.spotify.com/**', { timeout: 15000 })
            console.log('[Spotify Browser] Login successful, redirected to web player')
        } catch (e) {
            // 에러 메시지 확인
            const errorMsg = await page.locator('span[data-testid="login-error-message"]').textContent().catch(() => null)
            if (errorMsg) {
                await browser.close()
                return res.status(401).json({ error: errorMsg })
            }

            // 2FA 등 다른 화면인지 확인
            const currentUrl = page.url()
            if (currentUrl.includes('challenge')) {
                await browser.close()
                return res.status(401).json({ error: '2FA or CAPTCHA required. Please use token method.' })
            }

            throw new Error('Login timeout')
        }

        // 토큰이 캡처될 때까지 대기
        if (!capturedToken) {
            // 웹 플레이어에서 API 호출 유도
            await page.goto('https://open.spotify.com/collection/playlists', { waitUntil: 'networkidle' })
            await page.waitForTimeout(3000)
        }

        if (!capturedToken) {
            // localStorage에서 토큰 추출 시도
            const localStorageData = await page.evaluate(() => {
                const data = {}
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i)
                    if (key && key.includes('token')) {
                        data[key] = localStorage.getItem(key)
                    }
                }
                return data
            })
            console.log('[Spotify Browser] LocalStorage tokens:', Object.keys(localStorageData))
        }

        if (!capturedToken) {
            await browser.close()
            return res.status(500).json({ error: 'Failed to capture access token' })
        }

        // 사용자 정보 가져오기
        const userResponse = await fetch(`${SPOTIFY_API_URL}/me`, {
            headers: { 'Authorization': `Bearer ${capturedToken}` }
        })

        if (!userResponse.ok) {
            await browser.close()
            return res.status(401).json({ error: 'Token validation failed' })
        }

        const profile = await userResponse.json()

        // 세션 저장
        browserSessions[sessionKey] = {
            browser,
            context,
            accessToken: capturedToken,
            connectedAt: Date.now(),
            user: profile
        }

        console.log(`[Spotify Browser] Connected: ${profile.display_name}`)

        res.json({
            success: true,
            user: {
                id: profile.id,
                displayName: profile.display_name,
                email: profile.email,
                image: profile.images?.[0]?.url
            }
        })

    } catch (error) {
        console.error('[Spotify Browser] Login error:', error)
        res.status(500).json({ error: error.message })
    }
})

// GET /api/spotify/browser/status - 브라우저 세션 상태 확인
router.get('/status', async (req, res) => {
    const { visitorId } = req.query
    const sessionKey = visitorId || 'default'

    const session = browserSessions[sessionKey]
    if (!session || !session.accessToken) {
        return res.json({ connected: false })
    }

    // 토큰 유효성 검사
    try {
        const response = await fetch(`${SPOTIFY_API_URL}/me`, {
            headers: { 'Authorization': `Bearer ${session.accessToken}` }
        })

        if (!response.ok) {
            // 세션 정리
            if (session.browser) {
                await session.browser.close().catch(() => {})
            }
            delete browserSessions[sessionKey]
            return res.json({ connected: false, error: 'Token expired' })
        }

        const profile = await response.json()

        res.json({
            connected: true,
            user: {
                id: profile.id,
                displayName: profile.display_name,
                image: profile.images?.[0]?.url
            },
            connectedAt: session.connectedAt
        })
    } catch (error) {
        res.json({ connected: false, error: error.message })
    }
})

// POST /api/spotify/browser/logout - 브라우저 세션 종료
router.post('/logout', async (req, res) => {
    const { visitorId } = req.body
    const sessionKey = visitorId || 'default'

    const session = browserSessions[sessionKey]
    if (session) {
        if (session.browser) {
            await session.browser.close().catch(() => {})
        }
        delete browserSessions[sessionKey]
    }

    res.json({ success: true })
})

// GET /api/spotify/browser/playlists - 플레이리스트 가져오기
router.get('/playlists', async (req, res) => {
    const { visitorId, limit = 50, offset = 0 } = req.query
    const sessionKey = visitorId || 'default'

    const session = browserSessions[sessionKey]
    if (!session || !session.accessToken) {
        return res.status(401).json({ error: 'Not connected' })
    }

    try {
        const response = await fetch(
            `${SPOTIFY_API_URL}/me/playlists?limit=${limit}&offset=${offset}`,
            { headers: { 'Authorization': `Bearer ${session.accessToken}` } }
        )

        if (!response.ok) {
            if (response.status === 401) {
                delete browserSessions[sessionKey]
                return res.status(401).json({ error: 'Token expired' })
            }
            throw new Error(`Spotify API error: ${response.status}`)
        }

        const data = await response.json()

        const playlists = data.items.map(p => ({
            id: p.id,
            name: p.name,
            description: p.description,
            image: p.images?.[0]?.url,
            trackCount: p.tracks?.total || 0,
            owner: p.owner?.display_name
        }))

        res.json({
            playlists,
            total: data.total,
            hasMore: !!data.next
        })
    } catch (error) {
        console.error('[Spotify Browser] Playlists error:', error)
        res.status(500).json({ error: error.message })
    }
})

// POST /api/spotify/browser/import - 플레이리스트 가져오기
router.post('/import', async (req, res) => {
    const { visitorId, playlistId, userId } = req.body
    const sessionKey = visitorId || 'default'

    if (!userId) {
        return res.status(400).json({ error: 'userId is required' })
    }

    const session = browserSessions[sessionKey]
    if (!session || !session.accessToken) {
        return res.status(401).json({ error: 'Not connected' })
    }

    const accessToken = session.accessToken

    try {
        // 1. Get playlist info
        const playlistResponse = await fetch(`${SPOTIFY_API_URL}/playlists/${playlistId}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        })

        if (!playlistResponse.ok) {
            throw new Error('Failed to fetch playlist')
        }

        const playlistData = await playlistResponse.json()

        // 2. Get all tracks
        let allTracks = []
        let trackOffset = 0

        while (true) {
            const tracksResponse = await fetch(
                `${SPOTIFY_API_URL}/playlists/${playlistId}/tracks?limit=100&offset=${trackOffset}`,
                { headers: { 'Authorization': `Bearer ${accessToken}` } }
            )

            if (!tracksResponse.ok) break

            const tracksData = await tracksResponse.json()
            const tracks = tracksData.items
                .filter(item => item.track)
                .map(item => item.track)

            allTracks = allTracks.concat(tracks)

            if (!tracksData.next) break
            trackOffset += 100
        }

        console.log(`[Spotify Browser] Importing "${playlistData.name}" with ${allTracks.length} tracks`)

        // 3. Create playlist in DB
        const result = await execute(`
            INSERT INTO playlists (user_id, title, description, cover_image, source_type, external_id, space_type, status_flag)
            VALUES (?, ?, ?, ?, 'spotify', ?, 'PMS', 'active')
        `, [
            userId,
            playlistData.name,
            playlistData.description || '',
            playlistData.images?.[0]?.url || null,
            playlistId
        ])

        const newPlaylistId = result.insertId

        // 4. Insert tracks
        let importedCount = 0
        for (let i = 0; i < allTracks.length; i++) {
            const t = allTracks[i]

            try {
                let existingTrack = await queryOne(`
                    SELECT track_id FROM tracks WHERE spotify_id = ? OR (isrc = ? AND isrc IS NOT NULL)
                `, [t.id, t.external_ids?.isrc])

                let trackId

                if (existingTrack) {
                    trackId = existingTrack.track_id
                } else {
                    const trackResult = await execute(`
                        INSERT INTO tracks (title, artist, album, duration, isrc, spotify_id, artwork, popularity)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        t.name,
                        t.artists?.map(a => a.name).join(', '),
                        t.album?.name,
                        Math.floor(t.duration_ms / 1000),
                        t.external_ids?.isrc || null,
                        t.id,
                        t.album?.images?.[0]?.url || null,
                        t.popularity || null
                    ])
                    trackId = trackResult.insertId
                }

                await execute(`
                    INSERT INTO playlist_tracks (playlist_id, track_id, order_index)
                    VALUES (?, ?, ?)
                `, [newPlaylistId, trackId, i])

                importedCount++
            } catch (trackError) {
                console.error(`[Spotify Browser] Failed to import track:`, trackError.message)
            }
        }

        res.json({
            success: true,
            playlistId: newPlaylistId,
            title: playlistData.name,
            importedTracks: importedCount,
            totalTracks: allTracks.length
        })
    } catch (error) {
        console.error('[Spotify Browser] Import error:', error)
        res.status(500).json({ error: error.message })
    }
})

export default router
