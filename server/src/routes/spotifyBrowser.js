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

        // 브라우저 시작 (Stealth 모드)
        const browser = await chromium.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--disable-infobars',
                '--window-size=1920,1080',
                '--start-maximized'
            ]
        })

        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 },
            locale: 'en-US',
            timezoneId: 'America/New_York',
            permissions: ['geolocation'],
            extraHTTPHeaders: {
                'Accept-Language': 'en-US,en;q=0.9'
            }
        })

        const page = await context.newPage()

        // Webdriver 속성 숨기기 (Bot 감지 우회)
        await page.addInitScript(() => {
            // webdriver 속성 제거
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            })

            // plugins 추가
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5]
            })

            // languages 추가
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en']
            })

            // Chrome 객체 추가
            window.chrome = {
                runtime: {}
            }
        })

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

        console.log('[Spotify Browser] Step 1: Entering email...')

        // Step 1: 이메일 입력 (id="username" 또는 data-testid="login-username")
        await page.fill('input[id="username"]', email)

        // Continue 버튼 클릭
        await page.click('button[data-testid="login-button"]')

        // Step 2: 6자리 코드 화면 또는 비밀번호 선택 화면 대기
        console.log('[Spotify Browser] Step 2: Waiting for next screen...')
        await page.waitForTimeout(3000)

        // 현재 URL 로그
        console.log('[Spotify Browser] Current URL:', page.url())

        // 디버깅: 스크린샷 저장
        try {
            await page.screenshot({ path: '/app/spotify_debug.png' })
            console.log('[Spotify Browser] Screenshot saved to /app/spotify_debug.png')
        } catch (e) {
            console.log('[Spotify Browser] Screenshot failed:', e.message)
        }

        // 디버깅: 페이지의 모든 버튼 텍스트 로그
        try {
            const allButtons = await page.locator('button').all()
            console.log('[Spotify Browser] Found', allButtons.length, 'buttons on page')
            for (let i = 0; i < Math.min(allButtons.length, 10); i++) {
                const text = await allButtons[i].textContent().catch(() => 'N/A')
                const dataTestId = await allButtons[i].getAttribute('data-testid').catch(() => 'N/A')
                const encoreId = await allButtons[i].getAttribute('data-encore-id').catch(() => 'N/A')
                console.log(`[Spotify Browser] Button ${i}: text="${text}", data-testid="${dataTestId}", data-encore-id="${encoreId}"`)
            }
        } catch (e) {
            console.log('[Spotify Browser] Button enumeration failed:', e.message)
        }

        // "Log in with a password" 버튼 찾아서 클릭
        // Spotify는 data-encore-id="buttonTertiary" 속성을 사용함
        let passwordLinkClicked = false

        try {
            // 정확한 selector: data-encore-id="buttonTertiary"
            const passwordBtn = page.locator('button[data-encore-id="buttonTertiary"]')
            if (await passwordBtn.isVisible({ timeout: 8000 })) {
                console.log('[Spotify Browser] Found "Log in with a password" button (buttonTertiary)')
                await passwordBtn.click()
                passwordLinkClicked = true
                await page.waitForTimeout(2000)
            }
        } catch (e) {
            console.log('[Spotify Browser] buttonTertiary not found:', e.message)
        }

        // 대안: 텍스트로 찾기
        if (!passwordLinkClicked) {
            try {
                const passwordLink = page.getByRole('button', { name: /password/i })
                if (await passwordLink.isVisible({ timeout: 3000 })) {
                    console.log('[Spotify Browser] Found button with password text via getByRole')
                    await passwordLink.click()
                    passwordLinkClicked = true
                    await page.waitForTimeout(2000)
                }
            } catch (e) {
                console.log('[Spotify Browser] getByRole failed:', e.message)
            }
        }

        console.log('[Spotify Browser] Password link clicked:', passwordLinkClicked)
        console.log('[Spotify Browser] Current URL after click:', page.url())

        // Step 3: 비밀번호 입력 (id="password" 또는 data-testid="login-password")
        console.log('[Spotify Browser] Step 3: Entering password...')
        try {
            await page.waitForSelector('input[id="password"]', { timeout: 15000 })
            await page.fill('input[id="password"]', password)

            // Log in 버튼 클릭
            await page.click('button[data-testid="login-button"]')
        } catch (e) {
            console.error('[Spotify Browser] Password field not found:', e.message)
            // 현재 페이지의 HTML 일부를 로그로 남기기
            const pageContent = await page.content().catch(() => 'Failed to get content')
            console.log('[Spotify Browser] Page excerpt:', pageContent.substring(0, 500))
            await browser.close()
            return res.status(401).json({ error: 'Password field not found. Spotify may require email verification code.' })
        }

        // 로그인 결과 대기
        try {
            // 성공: Spotify 웹 플레이어로 리다이렉트
            await page.waitForURL('**/open.spotify.com/**', { timeout: 20000 })
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
                await session.browser.close().catch(() => { })
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
            await session.browser.close().catch(() => { })
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
