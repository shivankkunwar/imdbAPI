import express from 'express';
import { registerUser, loginUser, getCurrentUser } from "../controllers/userController.js";
import auth from "../middleware/authMiddleWare.js"

const router = express.Router();

router.post('/register',registerUser);
router.post('/login',loginUser);
router.get('profile',auth,getCurrentUser)

export default router;