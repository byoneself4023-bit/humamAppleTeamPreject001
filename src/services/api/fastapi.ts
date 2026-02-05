/**
 * FastAPI 분석 서비스
 * - 플레이리스트 ID를 받아 AI 분석 수행
 * - FastAPI 서버: http://localhost:8000 (개발) 또는 Nginx 프록시
 */

export interface AnalysisRequest {
    playlistId: number
}

export interface AnalysisResponse {
    success: boolean
    playlistId: number
    score: number          // 0-100
    grade: string          // S, A, B, C, D, F
    recommendation: string // GMS 이동 추천 여부: 'approve' | 'reject' | 'pending'
    reason?: string        // 분석 결과 설명
    genres?: string[]      // 감지된 장르
    mood?: string          // 감지된 분위기
    tags?: string[]        // 추천 태그
}

const FASTAPI_BASE_URL = '/api/fastapi'

export const fastapiService = {
    /**
     * 플레이리스트 AI 분석 요청
     */
    analyze: async (playlistId: number): Promise<AnalysisResponse> => {
        const response = await fetch(`${FASTAPI_BASE_URL}/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ playlistId })
        })

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Analysis failed' }))
            throw new Error(error.message || 'Analysis request failed')
        }

        return response.json()
    },

    /**
     * 분석 상태 조회 (비동기 분석용)
     */
    getStatus: async (playlistId: number): Promise<{ status: string; result?: AnalysisResponse }> => {
        const response = await fetch(`${FASTAPI_BASE_URL}/status/${playlistId}`)
        
        if (!response.ok) {
            throw new Error('Failed to get analysis status')
        }

        return response.json()
    },

    /**
     * 헬스 체크
     */
    health: async (): Promise<{ status: string }> => {
        const response = await fetch(`${FASTAPI_BASE_URL}/health`)
        return response.json()
    }
}
