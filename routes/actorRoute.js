import express from 'express';
import {
  getActors,
  getActorById,
  createActor,
  updateActor,
  deleteActor
} from '../controllers/actorController.js';
import auth from '../middleware/authMiddleWare.js';

const router = express.Router();

router.route('/')
  .get(auth, getActors)
  .post(auth, createActor);

router.route('/:id')
  .get(auth, getActorById)
  .put(auth, updateActor)
  .delete(auth, deleteActor);

export default router;