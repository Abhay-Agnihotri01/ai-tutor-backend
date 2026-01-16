import express from 'express';
import { addToWishlist, getWishlist, removeFromWishlist, checkWishlistStatus } from '../controllers/wishlistController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.post('/add', addToWishlist);
router.get('/', getWishlist);
router.delete('/remove/:courseId', removeFromWishlist);
router.get('/status/:courseId', checkWishlistStatus);

export default router;