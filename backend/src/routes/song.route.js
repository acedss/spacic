import Router from 'express'
import { getTestSong, getAllSongs } from '../controllers/song.controller.js'

const router = Router()

router.get('/', getAllSongs)
router.get('/test-get-presigned-url', getTestSong)

export default router