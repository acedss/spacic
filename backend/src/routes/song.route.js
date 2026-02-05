import Router from 'express'
import { getTestSong } from '../controllers/song.controller.js'

const router = Router()

router.get('/test-get-presigned-url', getTestSong)

export default router