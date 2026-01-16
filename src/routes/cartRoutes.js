import express from 'express';
import { addToCart, getCart, removeFromCart, clearCart } from '../controllers/cartController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.post('/add', addToCart);
router.get('/', getCart);
router.delete('/remove/:courseId', removeFromCart);
router.delete('/clear', clearCart);

export default router;